-- =============================================================================
-- PetID — Página pública de leitura do QR Code (RF-03)
-- Prompt 4 — rode após 003_pets_storage_and_config.sql
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Configuração da página pública e rate limiting
insert into public.configuracoes_sistema (chave, valor)
values
  (
    'pagina_qr',
    '{
      "titulo": "Você encontrou este pet?",
      "instrucao": "Confira se é o animal certo. O tutor será avisado pela plataforma PetID — não exibimos telefone nem e-mail diretamente.",
      "mensagem_contato": "O tutor receberá uma notificação pelo canal que ele configurou (WhatsApp, e-mail ou push).",
      "texto_consentimento": "Autorizo compartilhar minha localização aproximada com o tutor deste pet, apenas para facilitar o reencontro.",
      "versao_termos_consentimento": "1.0"
    }'::jsonb
  ),
  (
    'rate_limit_qr_leitura',
    '{
      "por_ip_por_hora": 20,
      "por_payload_por_hora": 10,
      "por_fingerprint_por_hora": 15
    }'::jsonb
  )
on conflict (chave) do nothing;

-- Leitura anônima das chaves usadas na rota pública do QR
drop policy if exists configuracoes_leitura_anon on public.configuracoes_sistema;
create policy configuracoes_leitura_anon on public.configuracoes_sistema
  for select to anon
  using (
    chave in (
      'raio_matching_km',
      'score_minimo_notificacao',
      'pagina_qr',
      'rate_limit_qr_leitura'
    )
  );

-- -----------------------------------------------------------------------------
-- Tabela de leituras de QR (consentimento com contexto auditável)
-- -----------------------------------------------------------------------------

create table if not exists public.leituras_qr (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais (id) on delete cascade,
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  consentimento_localizacao boolean not null,
  consentimento_em timestamptz not null default now(),
  consentimento_contexto jsonb not null default '{}'::jsonb,
  localizacao geography (point, 4326),
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint leituras_qr_localizacao_consentimento check (
    (consentimento_localizacao = true and localizacao is not null)
    or (consentimento_localizacao = false and localizacao is null)
  )
);

create index if not exists idx_leituras_qr_animal_created
  on public.leituras_qr (animal_id, created_at desc);

create index if not exists idx_leituras_qr_ip_hash_created
  on public.leituras_qr (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.leituras_qr enable row level security;

drop policy if exists leituras_qr_tutor_select on public.leituras_qr;
create policy leituras_qr_tutor_select on public.leituras_qr
  for select to authenticated
  using (
    tutor_id = public.current_tutor_id()
    or public.is_platform_admin()
  );

-- Inserção apenas via RPC security definer (sem policy de insert para anon)

-- -----------------------------------------------------------------------------
-- Helpers: IP do request e rate limiting
-- -----------------------------------------------------------------------------

create or replace function public.request_client_ip()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception
    when others then
      v_headers := null;
  end;

  if v_headers is null then
    return null;
  end if;

  v_ip := coalesce(
    v_headers ->> 'x-real-ip',
    v_headers ->> 'cf-connecting-ip',
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)
  );

  v_ip := nullif(trim(v_ip), '');
  return v_ip;
end;
$$;

create or replace function public.hash_request_ip()
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case
    when public.request_client_ip() is not null
      then encode(extensions.digest(public.request_client_ip(), 'sha256'), 'hex')
    else null
  end;
$$;

create or replace function public.verificar_rate_limit_qr(
  p_animal_id uuid,
  p_fingerprint text default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limites jsonb;
  v_por_ip int;
  v_por_payload int;
  v_por_fingerprint int;
  v_ip_hash text;
  v_count_ip int := 0;
  v_count_payload int := 0;
  v_count_fingerprint int := 0;
begin
  select valor into v_limites
  from public.configuracoes_sistema
  where chave = 'rate_limit_qr_leitura';

  v_por_ip := coalesce((v_limites ->> 'por_ip_por_hora')::int, 20);
  v_por_payload := coalesce((v_limites ->> 'por_payload_por_hora')::int, 10);
  v_por_fingerprint := coalesce((v_limites ->> 'por_fingerprint_por_hora')::int, 15);

  v_ip_hash := public.hash_request_ip();

  if v_ip_hash is not null then
    select count(*) into v_count_ip
    from public.leituras_qr
    where ip_hash = v_ip_hash
      and created_at > now() - interval '1 hour';

    if v_count_ip >= v_por_ip then
      raise exception 'Muitas leituras recentes. Tente novamente em alguns minutos.'
        using errcode = 'P0003';
    end if;
  end if;

  select count(*) into v_count_payload
  from public.leituras_qr
  where animal_id = p_animal_id
    and created_at > now() - interval '1 hour';

  if v_count_payload >= v_por_payload then
    raise exception 'Este QR Code foi consultado com muita frequência. Aguarde um pouco.'
      using errcode = 'P0003';
  end if;

  if p_fingerprint is not null and length(trim(p_fingerprint)) > 0 then
    select count(*) into v_count_fingerprint
    from public.leituras_qr
    where consentimento_contexto ->> 'fingerprint' = trim(p_fingerprint)
      and created_at > now() - interval '1 hour';

    if v_count_fingerprint >= v_por_fingerprint then
      raise exception 'Muitas tentativas deste dispositivo. Tente novamente mais tarde.'
        using errcode = 'P0003';
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: metadados públicos do pet (sem contato do tutor)
-- -----------------------------------------------------------------------------

create or replace function public.obter_pet_por_qr(p_qr_payload text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_animal record;
begin
  if p_qr_payload is null or length(trim(p_qr_payload)) < 8 then
    raise exception 'QR Code inválido' using errcode = 'P0001';
  end if;

  select
    a.id,
    a.nome,
    a.especie,
    a.raca,
    a.porte,
    a.cor,
    a.caracteristicas,
    a.foto_url
  into v_animal
  from public.animais a
  where a.qr_payload = trim(p_qr_payload);

  if not found then
    raise exception 'Pet não encontrado para este QR Code' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_animal.id,
    'nome', v_animal.nome,
    'especie', v_animal.especie,
    'raca', v_animal.raca,
    'porte', v_animal.porte,
    'cor', v_animal.cor,
    'caracteristicas', v_animal.caracteristicas,
    'foto_path', v_animal.foto_url,
    'tem_foto', v_animal.foto_url is not null
  );
end;
$$;

grant execute on function public.obter_pet_por_qr(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: registrar leitura + notificar tutor
-- -----------------------------------------------------------------------------

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

  select t.id, t.user_id, t.canal_notificacao_preferido
  into v_tutor
  from public.tutores t
  where t.id = v_animal.tutor_id;

  if not found then
    raise exception 'Tutor não encontrado' using errcode = 'P0002';
  end if;

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
    'consentimento_em', now()
  );

  if p_consentimento_localizacao then
    if p_latitude is null or p_longitude is null then
      raise exception 'Localização obrigatória quando o consentimento é concedido'
        using errcode = 'P0001';
    end if;

    if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
      raise exception 'Coordenadas inválidas' using errcode = 'P0001';
    end if;

    -- Aproximação (~100 m) para proteger quem encontrou
    v_lat := round(p_latitude::numeric, 3);
    v_lng := round(p_longitude::numeric, 3);
    v_localizacao := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;
    v_tipo_evento := 'qr_lido_com_localizacao';
  else
    v_localizacao := null;
    v_tipo_evento := 'qr_lido';
  end if;

  insert into public.leituras_qr (
    animal_id,
    tutor_id,
    consentimento_localizacao,
    consentimento_contexto,
    localizacao,
    ip_hash
  )
  values (
    v_animal.id,
    v_tutor.id,
    p_consentimento_localizacao,
    v_contexto,
    v_localizacao,
    public.hash_request_ip()
  )
  returning id into v_leitura_id;

  v_canal := coalesce(v_tutor.canal_notificacao_preferido, 'email');

  insert into public.notificacoes (
    destinatario_user_id,
    canal,
    tipo_evento
  )
  values (
    v_tutor.user_id,
    v_canal,
    v_tipo_evento
  );

  return jsonb_build_object(
    'leitura_id', v_leitura_id,
    'animal_nome', v_animal.nome,
    'notificado', true,
    'com_localizacao', p_consentimento_localizacao
  );
end;
$$;

grant execute on function public.registrar_leitura_qr(
  text,
  boolean,
  double precision,
  double precision,
  jsonb
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Foto do pet: leitura anônima apenas quando o arquivo pertence a um animal
-- -----------------------------------------------------------------------------

drop policy if exists pets_public_qr_select on storage.objects;
create policy pets_public_qr_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'pets'
    and exists (
      select 1
      from public.animais a
      where a.foto_url = name
    )
  );
