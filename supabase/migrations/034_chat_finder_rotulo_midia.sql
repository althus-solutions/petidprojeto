-- =============================================================================
-- Migration 034 — Chat: rótulo Finder N + mídia (foto/áudio) + pedido de ligação
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Rótulo anônimo do finder (por tutor)
-- -----------------------------------------------------------------------------

alter table public.conversas
  add column if not exists finder_rotulo integer;

comment on column public.conversas.finder_rotulo is
  'Número sequencial do finder na visão do tutor (Finder 1, Finder 2…). Reutilizado pelo mesmo fingerprint.';

-- Backfill: mesmo fingerprint no mesmo tutor = mesmo número
with first_seen as (
  select
    tutor_id,
    finder_fingerprint,
    min(created_at) as first_at
  from public.conversas
  group by tutor_id, finder_fingerprint
),
numbered as (
  select
    tutor_id,
    finder_fingerprint,
    row_number() over (
      partition by tutor_id
      order by first_at
    )::integer as n
  from first_seen
)
update public.conversas c
set finder_rotulo = n.n
from numbered n
where c.tutor_id = n.tutor_id
  and c.finder_fingerprint = n.finder_fingerprint
  and c.finder_rotulo is null;

create or replace function public.atribuir_finder_rotulo(
  p_tutor_id uuid,
  p_fingerprint text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente integer;
  v_novo integer;
begin
  select c.finder_rotulo into v_existente
  from public.conversas c
  where c.tutor_id = p_tutor_id
    and c.finder_fingerprint = p_fingerprint
    and c.finder_rotulo is not null
  order by c.created_at
  limit 1;

  if v_existente is not null then
    return v_existente;
  end if;

  select coalesce(max(c.finder_rotulo), 0) + 1 into v_novo
  from public.conversas c
  where c.tutor_id = p_tutor_id;

  return v_novo;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Tipos de mensagem + mídia
-- -----------------------------------------------------------------------------

alter table public.mensagens
  add column if not exists tipo text not null default 'texto',
  add column if not exists midia_path text;

alter table public.mensagens drop constraint if exists mensagens_tipo_check;
alter table public.mensagens
  add constraint mensagens_tipo_check
  check (tipo in ('texto', 'imagem', 'audio', 'chamada'));

alter table public.mensagens drop constraint if exists mensagens_corpo_check;
-- corpo: obrigatório em texto; opcional/caption em mídia; chamada pode ter texto auxiliar
alter table public.mensagens
  add constraint mensagens_corpo_check
  check (
    (
      tipo = 'texto'
      and length(trim(corpo)) between 1 and 2000
    )
    or (
      tipo in ('imagem', 'audio')
      and midia_path is not null
      and length(trim(midia_path)) > 0
      and length(coalesce(corpo, '')) <= 2000
    )
    or (
      tipo = 'chamada'
      and length(trim(corpo)) between 1 and 500
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Storage chat-midia + tokens de upload (finder anon)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-midia',
  'chat-midia',
  false,
  10485760, -- 10MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.chat_upload_tokens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  finder_fingerprint text not null,
  storage_path text not null unique,
  tipo text not null check (tipo in ('imagem', 'audio')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  usado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_upload_tokens_expires
  on public.chat_upload_tokens (expires_at)
  where not usado;

alter table public.chat_upload_tokens enable row level security;

-- Tutor autentica: upload/leitura na pasta da conversa
drop policy if exists chat_midia_tutor_insert on storage.objects;
create policy chat_midia_tutor_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-midia'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.conversas c
      where c.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists chat_midia_tutor_select on storage.objects;
create policy chat_midia_tutor_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-midia'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.conversas c
      where c.tutor_id = public.current_tutor_id()
    )
  );

-- Finder: insert só com path de token válido
drop policy if exists chat_midia_finder_insert on storage.objects;
create policy chat_midia_finder_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'chat-midia'
    and exists (
      select 1 from public.chat_upload_tokens t
      where t.storage_path = name
        and not t.usado
        and t.expires_at > now()
    )
  );

-- Leitura: tutor (policy acima) + participantes da conversa aberta (UUID da pasta).
-- createSignedUrl exige SELECT na policy; conversa_id é UUID não enumerável.
drop policy if exists chat_midia_conversa_select on storage.objects;
create policy chat_midia_conversa_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'chat-midia'
    and exists (
      select 1 from public.conversas c
      where c.id::text = (storage.foldername(name))[1]
        and c.status = 'aberta'
    )
  );

-- -----------------------------------------------------------------------------
-- 4) abrir_conversa_pet — atribui rótulo
-- -----------------------------------------------------------------------------

create or replace function public.abrir_conversa_pet(
  p_qr_payload text,
  p_fingerprint text,
  p_leitura_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal public.animais%rowtype;
  v_conversa public.conversas%rowtype;
  v_fp text := nullif(trim(p_fingerprint), '');
  v_rotulo integer;
begin
  if p_qr_payload is null or length(trim(p_qr_payload)) < 8 then
    raise exception 'QR inválido' using errcode = 'P0001';
  end if;
  if v_fp is null or length(v_fp) < 8 then
    raise exception 'Fingerprint inválido' using errcode = 'P0001';
  end if;

  select * into v_animal
  from public.animais
  where qr_payload = trim(p_qr_payload);

  if not found then
    raise exception 'Pet não encontrado' using errcode = 'P0002';
  end if;

  v_rotulo := public.atribuir_finder_rotulo(v_animal.tutor_id, v_fp);

  insert into public.conversas (
    animal_id, tutor_id, finder_fingerprint, leitura_id, finder_rotulo
  )
  values (v_animal.id, v_animal.tutor_id, v_fp, p_leitura_id, v_rotulo)
  on conflict (animal_id, finder_fingerprint) do update
    set
      leitura_id = coalesce(excluded.leitura_id, conversas.leitura_id),
      status = 'aberta',
      finder_rotulo = coalesce(conversas.finder_rotulo, excluded.finder_rotulo),
      updated_at = now()
  returning * into v_conversa;

  return jsonb_build_object(
    'conversa_id', v_conversa.id,
    'animal_id', v_animal.id,
    'animal_nome', v_animal.nome,
    'finder_rotulo', v_conversa.finder_rotulo,
    'status', v_conversa.status
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) listar conversas finder + mensagens com tipo/midia
-- -----------------------------------------------------------------------------

create or replace function public.listar_conversas_finder(p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
begin
  if v_fp is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'animal_id', c.animal_id,
          'animal_nome', a.nome,
          'finder_rotulo', c.finder_rotulo,
          'updated_at', c.updated_at,
          'nao_lidas', (
            select count(*)::int from public.mensagens m
            where m.conversa_id = c.id
              and m.autor = 'tutor'
              and m.lida_em is null
          ),
          'ultima_mensagem', (
            select case
              when m.tipo = 'imagem' then '📷 Foto'
              when m.tipo = 'audio' then '🎤 Áudio'
              when m.tipo = 'chamada' then '📞 Ligação'
              else m.corpo
            end
            from public.mensagens m
            where m.conversa_id = c.id
            order by m.created_at desc
            limit 1
          )
        )
        order by c.updated_at desc
      )
      from public.conversas c
      join public.animais a on a.id = c.animal_id
      where c.finder_fingerprint = v_fp
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.listar_mensagens_finder(
  p_conversa_id uuid,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
  v_ok boolean;
begin
  select exists (
    select 1 from public.conversas c
    where c.id = p_conversa_id
      and c.finder_fingerprint = v_fp
  ) into v_ok;

  if not v_ok then
    raise exception 'Conversa não encontrada' using errcode = 'P0002';
  end if;

  update public.mensagens
  set lida_em = coalesce(lida_em, now())
  where conversa_id = p_conversa_id
    and autor = 'tutor'
    and lida_em is null;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'autor', m.autor,
          'tipo', m.tipo,
          'corpo', m.corpo,
          'midia_path', m.midia_path,
          'created_at', m.created_at,
          'lida_em', m.lida_em
        )
        order by m.created_at
      )
      from public.mensagens m
      where m.conversa_id = p_conversa_id
    ),
    '[]'::jsonb
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) Upload + envio de mídia / chamada
-- -----------------------------------------------------------------------------

create or replace function public.preparar_upload_chat_midia(
  p_conversa_id uuid,
  p_fingerprint text,
  p_tipo text,
  p_extensao text default 'webm'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
  v_tipo text := lower(trim(p_tipo));
  v_ext text := lower(regexp_replace(coalesce(p_extensao, 'webm'), '[^a-z0-9]', '', 'g'));
  v_path text;
  v_token_id uuid;
begin
  if v_tipo not in ('imagem', 'audio') then
    raise exception 'Tipo de mídia inválido' using errcode = 'P0001';
  end if;

  if v_ext is null or length(v_ext) = 0 or length(v_ext) > 8 then
    v_ext := case when v_tipo = 'imagem' then 'jpg' else 'webm' end;
  end if;

  if not exists (
    select 1 from public.conversas c
    where c.id = p_conversa_id
      and c.finder_fingerprint = v_fp
      and c.status = 'aberta'
  ) then
    raise exception 'Conversa não encontrada ou encerrada' using errcode = 'P0002';
  end if;

  v_path := p_conversa_id::text || '/' || gen_random_uuid()::text || '.' || v_ext;

  insert into public.chat_upload_tokens (
    conversa_id, finder_fingerprint, storage_path, tipo
  )
  values (p_conversa_id, v_fp, v_path, v_tipo)
  returning id into v_token_id;

  return jsonb_build_object(
    'upload_token_id', v_token_id,
    'storage_path', v_path,
    'tipo', v_tipo
  );
end;
$$;

create or replace function public.enviar_mensagem_midia_finder(
  p_conversa_id uuid,
  p_fingerprint text,
  p_upload_token_id uuid,
  p_caption text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
  v_token public.chat_upload_tokens%rowtype;
  v_msg public.mensagens%rowtype;
  v_caption text := left(trim(coalesce(p_caption, '')), 2000);
begin
  select * into v_token
  from public.chat_upload_tokens t
  where t.id = p_upload_token_id
    and t.conversa_id = p_conversa_id
    and t.finder_fingerprint = v_fp
    and not t.usado
    and t.expires_at > now();

  if not found then
    raise exception 'Upload expirado ou inválido' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.conversas c
    where c.id = p_conversa_id
      and c.finder_fingerprint = v_fp
      and c.status = 'aberta'
  ) then
    raise exception 'Conversa não encontrada ou encerrada' using errcode = 'P0002';
  end if;

  insert into public.mensagens (conversa_id, autor, tipo, corpo, midia_path)
  values (
    p_conversa_id,
    'finder',
    v_token.tipo,
    coalesce(nullif(v_caption, ''), case when v_token.tipo = 'imagem' then 'Foto' else 'Áudio' end),
    v_token.storage_path
  )
  returning * into v_msg;

  update public.chat_upload_tokens
  set usado = true
  where id = v_token.id;

  return jsonb_build_object(
    'id', v_msg.id,
    'autor', v_msg.autor,
    'tipo', v_msg.tipo,
    'corpo', v_msg.corpo,
    'midia_path', v_msg.midia_path,
    'created_at', v_msg.created_at
  );
end;
$$;

create or replace function public.enviar_mensagem_chamada_finder(
  p_conversa_id uuid,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
  v_msg public.mensagens%rowtype;
begin
  if not exists (
    select 1 from public.conversas c
    where c.id = p_conversa_id
      and c.finder_fingerprint = v_fp
      and c.status = 'aberta'
  ) then
    raise exception 'Conversa não encontrada ou encerrada' using errcode = 'P0002';
  end if;

  insert into public.mensagens (conversa_id, autor, tipo, corpo)
  values (
    p_conversa_id,
    'finder',
    'chamada',
    'Pediu uma ligação. Responda com um áudio ou compartilhe um contato.'
  )
  returning * into v_msg;

  return jsonb_build_object(
    'id', v_msg.id,
    'autor', v_msg.autor,
    'tipo', v_msg.tipo,
    'corpo', v_msg.corpo,
    'midia_path', v_msg.midia_path,
    'created_at', v_msg.created_at
  );
end;
$$;

-- Trigger aviso QR: atribui finder_rotulo (preserva lógica da 032)
create or replace function public.abrir_chat_aviso_leitura_qr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leitura_id uuid;
  v_fp text;
  v_animal_id uuid;
  v_tutor_id uuid;
  v_animal_nome text;
  v_endereco text;
  v_conversa_id uuid;
  v_corpo text;
  v_ja_existe boolean;
  v_rotulo integer;
begin
  if new.tipo_evento is distinct from 'qr_lido'
     and new.tipo_evento is distinct from 'qr_lido_com_localizacao' then
    return new;
  end if;

  begin
    v_leitura_id := (new.payload ->> 'leitura_id')::uuid;
  exception
    when others then
      return new;
  end;

  if v_leitura_id is null then
    return new;
  end if;

  select
    l.animal_id,
    l.tutor_id,
    a.nome,
    nullif(trim(coalesce(l.endereco_texto, '')), ''),
    nullif(trim(coalesce(l.consentimento_contexto ->> 'fingerprint', '')), '')
  into
    v_animal_id,
    v_tutor_id,
    v_animal_nome,
    v_endereco,
    v_fp
  from public.leituras_qr l
  join public.animais a on a.id = l.animal_id
  where l.id = v_leitura_id;

  if v_animal_id is null or v_tutor_id is null then
    return new;
  end if;

  if v_fp is null or length(v_fp) < 8 then
    return new;
  end if;

  v_rotulo := public.atribuir_finder_rotulo(v_tutor_id, v_fp);

  insert into public.conversas (
    animal_id, tutor_id, finder_fingerprint, leitura_id, finder_rotulo
  )
  values (v_animal_id, v_tutor_id, v_fp, v_leitura_id, v_rotulo)
  on conflict (animal_id, finder_fingerprint) do update
    set
      leitura_id = coalesce(excluded.leitura_id, conversas.leitura_id),
      finder_rotulo = coalesce(conversas.finder_rotulo, excluded.finder_rotulo),
      status = 'aberta',
      updated_at = now()
  returning id into v_conversa_id;

  select exists (
    select 1
    from public.mensagens m
    where m.conversa_id = v_conversa_id
      and m.autor = 'finder'
      and (
        m.corpo like '%tag MyPetID%'
        or m.corpo like '%tag PetID%'
      )
      and m.created_at > now() - interval '2 minutes'
  ) into v_ja_existe;

  if v_ja_existe then
    return new;
  end if;

  if new.tipo_evento = 'qr_lido_com_localizacao' then
    if v_endereco is not null then
      v_corpo := format(
        'Confirmei o resgate de %s pela tag MyPetID. Local aproximado: %s',
        v_animal_nome,
        v_endereco
      );
    else
      v_corpo := format(
        'Confirmei o resgate de %s pela tag MyPetID. Compartilhei a localização aproximada.',
        v_animal_nome
      );
    end if;
  else
    v_corpo := format(
      'Confirmei o resgate de %s pela tag MyPetID.',
      v_animal_nome
    );
  end if;

  if length(v_corpo) > 2000 then
    v_corpo := left(v_corpo, 1997) || '...';
  end if;

  insert into public.mensagens (conversa_id, autor, corpo)
  values (v_conversa_id, 'finder', v_corpo);

  return new;
end;
$$;

comment on function public.abrir_chat_aviso_leitura_qr() is
  'Após notificação de leitura QR, cria conversa + mensagem automática (Finder N + marca MyPetID).';

grant execute on function public.atribuir_finder_rotulo(uuid, text) to authenticated;
grant execute on function public.preparar_upload_chat_midia(uuid, text, text, text) to anon, authenticated;
grant execute on function public.enviar_mensagem_midia_finder(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.enviar_mensagem_chamada_finder(uuid, text) to anon, authenticated;
