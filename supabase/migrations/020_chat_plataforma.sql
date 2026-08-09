-- PetID — Chat na plataforma (finder anônimo ↔ tutor)
-- Conversas vinculadas ao animal + fingerprint do dispositivo de quem encontrou.

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais (id) on delete cascade,
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  finder_fingerprint text not null,
  leitura_id uuid references public.leituras_qr (id) on delete set null,
  status text not null default 'aberta'
    check (status in ('aberta', 'encerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (animal_id, finder_fingerprint)
);

create index if not exists conversas_tutor_updated_idx
  on public.conversas (tutor_id, updated_at desc);

create index if not exists conversas_fingerprint_idx
  on public.conversas (finder_fingerprint);

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  autor text not null check (autor in ('tutor', 'finder')),
  corpo text not null check (length(trim(corpo)) between 1 and 2000),
  created_at timestamptz not null default now(),
  lida_em timestamptz
);

create index if not exists mensagens_conversa_created_idx
  on public.mensagens (conversa_id, created_at);

alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;

-- Tutor: só suas conversas
drop policy if exists conversas_tutor_select on public.conversas;
create policy conversas_tutor_select on public.conversas
  for select to authenticated
  using (tutor_id = public.current_tutor_id());

drop policy if exists conversas_tutor_update on public.conversas;
create policy conversas_tutor_update on public.conversas
  for update to authenticated
  using (tutor_id = public.current_tutor_id())
  with check (tutor_id = public.current_tutor_id());

drop policy if exists mensagens_tutor_select on public.mensagens;
create policy mensagens_tutor_select on public.mensagens
  for select to authenticated
  using (
    conversa_id in (
      select c.id from public.conversas c
      where c.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists mensagens_tutor_insert on public.mensagens;
create policy mensagens_tutor_insert on public.mensagens
  for insert to authenticated
  with check (
    autor = 'tutor'
    and conversa_id in (
      select c.id from public.conversas c
      where c.tutor_id = public.current_tutor_id()
        and c.status = 'aberta'
    )
  );

drop policy if exists mensagens_tutor_update on public.mensagens;
create policy mensagens_tutor_update on public.mensagens
  for update to authenticated
  using (
    conversa_id in (
      select c.id from public.conversas c
      where c.tutor_id = public.current_tutor_id()
    )
  );

-- Anon não acessa tabelas direto — só via RPCs security definer

create or replace function public.trg_conversa_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversas
  set updated_at = now()
  where id = new.conversa_id;
  return new;
end;
$$;

drop trigger if exists trg_mensagens_touch_conversa on public.mensagens;
create trigger trg_mensagens_touch_conversa
  after insert on public.mensagens
  for each row
  execute function public.trg_conversa_touch();

-- -----------------------------------------------------------------------------
-- RPCs finder (anon)
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

  insert into public.conversas (animal_id, tutor_id, finder_fingerprint, leitura_id)
  values (v_animal.id, v_animal.tutor_id, v_fp, p_leitura_id)
  on conflict (animal_id, finder_fingerprint) do update
    set
      leitura_id = coalesce(excluded.leitura_id, conversas.leitura_id),
      status = 'aberta',
      updated_at = now()
  returning * into v_conversa;

  return jsonb_build_object(
    'conversa_id', v_conversa.id,
    'animal_id', v_animal.id,
    'animal_nome', v_animal.nome,
    'status', v_conversa.status
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

  -- Marca como lidas as mensagens do tutor
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
          'corpo', m.corpo,
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

create or replace function public.enviar_mensagem_finder(
  p_conversa_id uuid,
  p_fingerprint text,
  p_corpo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
  v_corpo text := nullif(trim(p_corpo), '');
  v_msg public.mensagens%rowtype;
begin
  if v_corpo is null then
    raise exception 'Mensagem vazia' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.conversas c
    where c.id = p_conversa_id
      and c.finder_fingerprint = v_fp
      and c.status = 'aberta'
  ) then
    raise exception 'Conversa não encontrada ou encerrada' using errcode = 'P0002';
  end if;

  insert into public.mensagens (conversa_id, autor, corpo)
  values (p_conversa_id, 'finder', v_corpo)
  returning * into v_msg;

  return jsonb_build_object(
    'id', v_msg.id,
    'autor', v_msg.autor,
    'corpo', v_msg.corpo,
    'created_at', v_msg.created_at
  );
end;
$$;

create or replace function public.contar_nao_lidas_finder(p_fingerprint text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text := nullif(trim(p_fingerprint), '');
  v_count int;
begin
  if v_fp is null then
    return 0;
  end if;

  select count(*)::int into v_count
  from public.mensagens m
  join public.conversas c on c.id = m.conversa_id
  where c.finder_fingerprint = v_fp
    and m.autor = 'tutor'
    and m.lida_em is null;

  return coalesce(v_count, 0);
end;
$$;

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
          'updated_at', c.updated_at,
          'nao_lidas', (
            select count(*)::int from public.mensagens m
            where m.conversa_id = c.id
              and m.autor = 'tutor'
              and m.lida_em is null
          ),
          'ultima_mensagem', (
            select m.corpo from public.mensagens m
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

-- Tutor helpers
create or replace function public.contar_nao_lidas_tutor()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := public.current_tutor_id();
  v_count int;
begin
  if v_tutor is null then
    return 0;
  end if;

  select count(*)::int into v_count
  from public.mensagens m
  join public.conversas c on c.id = m.conversa_id
  where c.tutor_id = v_tutor
    and m.autor = 'finder'
    and m.lida_em is null;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.marcar_mensagens_lidas_tutor(p_conversa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversas c
    where c.id = p_conversa_id
      and c.tutor_id = public.current_tutor_id()
  ) then
    raise exception 'Conversa não encontrada' using errcode = 'P0002';
  end if;

  update public.mensagens
  set lida_em = coalesce(lida_em, now())
  where conversa_id = p_conversa_id
    and autor = 'finder'
    and lida_em is null;
end;
$$;

grant execute on function public.abrir_conversa_pet(text, text, uuid) to anon, authenticated;
grant execute on function public.listar_mensagens_finder(uuid, text) to anon, authenticated;
grant execute on function public.enviar_mensagem_finder(uuid, text, text) to anon, authenticated;
grant execute on function public.contar_nao_lidas_finder(text) to anon, authenticated;
grant execute on function public.listar_conversas_finder(text) to anon, authenticated;
grant execute on function public.contar_nao_lidas_tutor() to authenticated;
grant execute on function public.marcar_mensagens_lidas_tutor(uuid) to authenticated;
