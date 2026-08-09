-- ============================================================
-- Migration 027 — Endereços do tutor (residência/trabalho) +
-- endereço textual na leitura QR/NFC
--
-- - tutor_enderecos: privado (RLS self), pins no mapa do tutor
-- - leituras_qr.endereco_texto: rótulo “onde foi lido” no mapa
-- - coords da leitura com mais precisão (5 casas) para pin útil
-- ============================================================

-- 1) Tabela de endereços privados do tutor
create table if not exists public.tutor_enderecos (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  tipo text not null check (tipo in ('residencia', 'trabalho')),
  cep text,
  logradouro text not null,
  numero text,
  complemento text,
  bairro text,
  cidade text not null,
  estado text not null,
  latitude double precision not null,
  longitude double precision not null,
  consentimento_em timestamptz not null default now(),
  consentimento_contexto jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_enderecos_tutor_tipo_unique unique (tutor_id, tipo),
  constraint tutor_enderecos_estado_uf check (char_length(trim(estado)) = 2),
  constraint tutor_enderecos_lat check (latitude between -90 and 90),
  constraint tutor_enderecos_lng check (longitude between -180 and 180)
);

create index if not exists idx_tutor_enderecos_tutor
  on public.tutor_enderecos (tutor_id);

comment on table public.tutor_enderecos is
  'Endereços privados do tutor (residência/trabalho) para o mapa do app. Nunca expor em RPCs públicos.';

alter table public.tutor_enderecos enable row level security;

drop policy if exists tutor_enderecos_select on public.tutor_enderecos;
create policy tutor_enderecos_select on public.tutor_enderecos
  for select to authenticated
  using (tutor_id = public.current_tutor_id());

drop policy if exists tutor_enderecos_insert on public.tutor_enderecos;
create policy tutor_enderecos_insert on public.tutor_enderecos
  for insert to authenticated
  with check (tutor_id = public.current_tutor_id());

drop policy if exists tutor_enderecos_update on public.tutor_enderecos;
create policy tutor_enderecos_update on public.tutor_enderecos
  for update to authenticated
  using (tutor_id = public.current_tutor_id())
  with check (tutor_id = public.current_tutor_id());

drop policy if exists tutor_enderecos_delete on public.tutor_enderecos;
create policy tutor_enderecos_delete on public.tutor_enderecos
  for delete to authenticated
  using (tutor_id = public.current_tutor_id());

-- Migra endereço único da 026 → residência (se existir)
insert into public.tutor_enderecos (
  tutor_id, tipo, logradouro, bairro, cidade, estado,
  latitude, longitude, consentimento_em, consentimento_contexto
)
select
  t.id,
  'residencia',
  coalesce(nullif(trim(t.endereco_bairro), ''), 'Endereço'),
  t.endereco_bairro,
  t.endereco_cidade,
  upper(trim(t.endereco_estado)),
  t.endereco_latitude,
  t.endereco_longitude,
  coalesce(t.endereco_consentimento_em, now()),
  coalesce(
    t.endereco_consentimento_contexto,
    jsonb_build_object('migrado_de', 'tutores.endereco_*', 'migration', '027')
  )
from public.tutores t
where t.endereco_latitude is not null
  and t.endereco_longitude is not null
  and nullif(trim(coalesce(t.endereco_cidade, '')), '') is not null
  and nullif(trim(coalesce(t.endereco_estado, '')), '') is not null
  and not exists (
    select 1 from public.tutor_enderecos e
    where e.tutor_id = t.id and e.tipo = 'residencia'
  );

-- 2) Endereço textual na leitura da tag
alter table public.leituras_qr
  add column if not exists endereco_texto text;

comment on column public.leituras_qr.endereco_texto is
  'Endereço aproximado/exato obtido por reverse geocode no momento da leitura (visível ao tutor no mapa).';

-- 3) registrar_leitura_qr — endereco_texto no contexto + coords mais precisas
drop function if exists public.registrar_leitura_qr(
  text, boolean, double precision, double precision, jsonb
);

create or replace function public.registrar_leitura_qr(
  p_qr_payload text,
  p_consentimento_localizacao boolean,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_consentimento_contexto jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal record;
  v_tutor record;
  v_lat numeric;
  v_lng numeric;
  v_localizacao geography;
  v_contexto jsonb;
  v_fingerprint text;
  v_leitura_id uuid;
  v_tipo_evento text;
  v_canal text;
  v_notificacao_id uuid;
  v_telefone_whatsapp text;
  v_tem_ocorrencia_aberta boolean;
  v_notificado boolean := false;
  v_endereco_texto text;
begin
  if p_qr_payload is null or length(trim(p_qr_payload)) < 8 then
    raise exception 'QR Code inválido' using errcode = 'P0001';
  end if;

  select a.id, a.tutor_id, a.nome
  into v_animal
  from public.animais a
  where a.qr_payload = trim(p_qr_payload);

  if not found then
    raise exception 'Pet não encontrado para este QR Code' using errcode = 'P0002';
  end if;

  v_fingerprint := nullif(trim(p_consentimento_contexto ->> 'fingerprint'), '');
  perform public.verificar_rate_limit_qr(v_animal.id, v_fingerprint);

  select t.id, t.user_id, t.canal_notificacao_preferido, t.telefone
  into v_tutor
  from public.tutores t
  where t.id = v_animal.tutor_id;

  if not found then
    raise exception 'Tutor não encontrado' using errcode = 'P0002';
  end if;

  v_telefone_whatsapp := public.normalizar_telefone_br(coalesce(v_tutor.telefone, ''));

  select exists (
    select 1
    from public.ocorrencias_perdido o
    where o.animal_id = v_animal.id
      and o.status = 'aberta'
  ) into v_tem_ocorrencia_aberta;

  v_endereco_texto := nullif(trim(coalesce(p_consentimento_contexto ->> 'endereco_texto', '')), '');

  v_contexto := coalesce(p_consentimento_contexto, '{}'::jsonb) || jsonb_build_object(
    'fluxo', 'qr_read',
    'versao_termos', coalesce(
      p_consentimento_contexto ->> 'versao_termos',
      (
        select valor ->> 'versao_termos_consentimento'
        from public.configuracoes_sistema
        where chave = 'pagina_qr'
      ),
      '1.0'
    ),
    'consentimento_em', now(),
    'ocorrencia_aberta', v_tem_ocorrencia_aberta
  );

  if p_consentimento_localizacao then
    if p_latitude is null or p_longitude is null then
      raise exception 'Localização obrigatória quando o consentimento é concedido'
        using errcode = 'P0001';
    end if;

    if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
      raise exception 'Coordenadas inválidas' using errcode = 'P0001';
    end if;

    -- ~1 m — útil para o tutor ir até o ponto; consentimento explícito do finder
    v_lat := round(p_latitude::numeric, 5);
    v_lng := round(p_longitude::numeric, 5);
    v_localizacao := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;
    v_tipo_evento := 'qr_lido_com_localizacao';
  else
    v_lat := null;
    v_lng := null;
    v_localizacao := null;
    v_endereco_texto := null;
    v_tipo_evento := 'qr_lido';
  end if;

  insert into public.leituras_qr (
    animal_id,
    tutor_id,
    consentimento_localizacao,
    consentimento_contexto,
    localizacao,
    endereco_texto,
    ip_hash
  )
  values (
    v_animal.id,
    v_tutor.id,
    p_consentimento_localizacao,
    v_contexto,
    v_localizacao,
    v_endereco_texto,
    public.hash_request_ip()
  )
  returning id into v_leitura_id;

  if v_tem_ocorrencia_aberta then
    v_canal := coalesce(v_tutor.canal_notificacao_preferido, 'email');

    insert into public.notificacoes (
      destinatario_user_id,
      canal,
      tipo_evento,
      status,
      payload
    )
    values (
      v_tutor.user_id,
      v_canal,
      v_tipo_evento,
      'pendente',
      jsonb_build_object(
        'leitura_id', v_leitura_id,
        'animal_id', v_animal.id,
        'animal_nome', v_animal.nome,
        'com_localizacao', p_consentimento_localizacao,
        'latitude', v_lat,
        'longitude', v_lng,
        'endereco_texto', v_endereco_texto
      )
    )
    returning id into v_notificacao_id;

    v_notificado := true;
  else
    v_canal := null;
    v_notificacao_id := null;
    v_telefone_whatsapp := null;
  end if;

  return jsonb_build_object(
    'leitura_id', v_leitura_id,
    'notificacao_id', v_notificacao_id,
    'animal_nome', v_animal.nome,
    'notificado', v_notificado,
    'ocorrencia_aberta', v_tem_ocorrencia_aberta,
    'com_localizacao', p_consentimento_localizacao,
    'canal_preferido', v_canal,
    'tutor_telefone_whatsapp', v_telefone_whatsapp
  );
end;
$$;

grant execute on function public.registrar_leitura_qr(
  text, boolean, double precision, double precision, jsonb
) to anon, authenticated;

comment on function public.registrar_leitura_qr(
  text, boolean, double precision, double precision, jsonb
) is
  'Registra leitura da tag; grava endereco_texto (contexto) e coords; notifica só com ocorrência aberta.';

-- 4) Listagem do mapa inclui endereco da leitura
create or replace function public.listar_ocorrencias_abertas_tutor()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
begin
  v_tutor_id := public.current_tutor_id();
  if v_tutor_id is null then
    raise exception 'Perfil de tutor não encontrado' using errcode = 'P0002';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data order by row_data ->> 'created_at' desc)
      from (
        select jsonb_build_object(
          'id', o.id,
          'animal_id', a.id,
          'animal_nome', a.nome,
          'animal_especie', a.especie,
          'animal_foto_path', a.foto_url,
          'data_perda', o.data_perda,
          'endereco_aproximado', o.endereco_aproximado,
          'status', o.status,
          'retroativa', o.retroativa,
          'created_at', o.created_at,
          'latitude', st_y(o.localizacao::geometry),
          'longitude', st_x(o.localizacao::geometry),
          'localizado', exists (
            select 1
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.consentimento_localizacao = true
              and l.localizacao is not null
              and l.created_at >= o.created_at
          ),
          'ultima_leitura_lat', (
            select st_y(l.localizacao::geometry)
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          'ultima_leitura_lng', (
            select st_x(l.localizacao::geometry)
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          'ultima_leitura_em', (
            select l.created_at
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          'ultima_leitura_endereco', (
            select l.endereco_texto
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          )
        ) as row_data
        from public.ocorrencias_perdido o
        join public.animais a on a.id = o.animal_id
        where o.tutor_id = v_tutor_id
          and o.status = 'aberta'
      ) sub
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.listar_ocorrencias_abertas_tutor() to authenticated;
