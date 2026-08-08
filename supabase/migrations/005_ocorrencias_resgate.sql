-- =============================================================================
-- PetID — Ocorrência de perdido + registro de resgate (RF-04, RF-05)
-- Prompt 5 — rode após 004_qr_read_public.sql
-- =============================================================================

create extension if not exists http with schema extensions;

-- -----------------------------------------------------------------------------
-- Colunas extras em registros_resgate (região sem GPS + auditoria de consentimento)
-- -----------------------------------------------------------------------------

alter table public.registros_resgate
  add column if not exists regiao_aproximada text,
  add column if not exists consentimento_contexto jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Tokens temporários para upload anônimo (após CAPTCHA)
-- -----------------------------------------------------------------------------

create table if not exists public.resgates_upload_tokens (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  ip_hash text,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  usado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_resgates_upload_tokens_expires
  on public.resgates_upload_tokens (expires_at)
  where not usado;

alter table public.resgates_upload_tokens enable row level security;

-- Sem policies de client — uso apenas via RPC security definer

-- -----------------------------------------------------------------------------
-- Configurações: CAPTCHA (Turnstile) e rate limit de resgate
-- -----------------------------------------------------------------------------

insert into public.configuracoes_sistema (chave, valor)
values
  (
    'captcha_resgate',
    '{
      "habilitado": true,
      "site_key": "1x00000000000000000000AA",
      "versao_termos_consentimento": "1.0",
      "texto_consentimento": "Autorizo compartilhar a localização aproximada deste registro para ajudar no reencontro do animal."
    }'::jsonb
  ),
  (
    'captcha_resgate_secret',
    '{"secret_key": "1x0000000000000000000000000000000AA"}'::jsonb
  ),
  (
    'rate_limit_resgate',
    '{
      "por_ip_por_hora": 10,
      "por_fingerprint_por_hora": 8
    }'::jsonb
  )
on conflict (chave) do nothing;

drop policy if exists configuracoes_leitura_anon on public.configuracoes_sistema;
create policy configuracoes_leitura_anon on public.configuracoes_sistema
  for select to anon
  using (
    chave in (
      'raio_matching_km',
      'score_minimo_notificacao',
      'pagina_qr',
      'rate_limit_qr_leitura',
      'captcha_resgate',
      'rate_limit_resgate'
    )
  );

-- -----------------------------------------------------------------------------
-- Bucket de fotos de resgate
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resgates',
  'resgates',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload anônimo apenas com token válido (pós-CAPTCHA)
drop policy if exists resgates_anon_insert on storage.objects;
create policy resgates_anon_insert on storage.objects
  for insert to anon
  with check (
    bucket_id = 'resgates'
    and exists (
      select 1
      from public.resgates_upload_tokens t
      where t.storage_path = name
        and not t.usado
        and t.expires_at > now()
    )
  );

-- Órgão autenticado na pasta da organização
drop policy if exists resgates_org_insert on storage.objects;
create policy resgates_org_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resgates'
    and (storage.foldername(name))[1] = 'org'
    and (storage.foldername(name))[2] in (
      select id::text from public.user_organizacao_ids()
    )
  );

drop policy if exists resgates_org_select on storage.objects;
create policy resgates_org_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resgates'
    and (
      (storage.foldername(name))[1] = 'org'
      and (storage.foldername(name))[2] in (
        select id::text from public.user_organizacao_ids()
      )
    )
    or public.is_platform_admin()
  );

-- Usuário autenticado (não anônimo) em pasta própria
drop policy if exists resgates_user_insert on storage.objects;
create policy resgates_user_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resgates'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists resgates_user_select on storage.objects;
create policy resgates_user_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resgates'
    and (
      (
        (storage.foldername(name))[1] = 'user'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or public.is_platform_admin()
    )
  );

-- -----------------------------------------------------------------------------
-- CAPTCHA Turnstile (verificação server-side)
-- -----------------------------------------------------------------------------

create or replace function public.verificar_turnstile(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_public jsonb;
  v_secret text;
  v_http record;
  v_body jsonb;
begin
  if p_token is null or length(trim(p_token)) < 10 then
    return false;
  end if;

  select valor into v_public
  from public.configuracoes_sistema
  where chave = 'captcha_resgate';

  if coalesce((v_public ->> 'habilitado')::boolean, true) = false then
    return true;
  end if;

  select valor ->> 'secret_key' into v_secret
  from public.configuracoes_sistema
  where chave = 'captcha_resgate_secret';

  if v_secret is null then
    return false;
  end if;

  begin
    select status, content::jsonb as body
    into v_http
    from extensions.http((
      'POST',
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      array[extensions.http_header('Content-Type', 'application/json')],
      'application/json',
      json_build_object('secret', v_secret, 'response', p_token)::text
    )::extensions.http_request);

    if v_http.status <> 200 then
      return false;
    end if;

    return coalesce((v_http.body ->> 'success')::boolean, false);
  exception
    when others then
      -- Fallback dev: chaves de teste Cloudflare (1x...)
      if v_secret like '1x%' and length(p_token) > 20 then
        return true;
      end if;
      return false;
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting de resgate
-- -----------------------------------------------------------------------------

create or replace function public.verificar_rate_limit_resgate(
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
  v_por_fingerprint int;
  v_ip_hash text;
  v_count_ip int := 0;
  v_count_fp int := 0;
begin
  select valor into v_limites
  from public.configuracoes_sistema
  where chave = 'rate_limit_resgate';

  v_por_ip := coalesce((v_limites ->> 'por_ip_por_hora')::int, 10);
  v_por_fingerprint := coalesce((v_limites ->> 'por_fingerprint_por_hora')::int, 8);
  v_ip_hash := public.hash_request_ip();

  if v_ip_hash is not null then
    select count(*) into v_count_ip
    from public.registros_resgate
    where consentimento_contexto ->> 'ip_hash' = v_ip_hash
      and created_at > now() - interval '1 hour';

    if v_count_ip >= v_por_ip then
      raise exception 'Muitos registros recentes. Tente novamente em alguns minutos.'
        using errcode = 'P0003';
    end if;
  end if;

  if p_fingerprint is not null and length(trim(p_fingerprint)) > 0 then
    select count(*) into v_count_fp
    from public.registros_resgate
    where consentimento_contexto ->> 'fingerprint' = trim(p_fingerprint)
      and created_at > now() - interval '1 hour';

    if v_count_fp >= v_por_fingerprint then
      raise exception 'Muitas tentativas deste dispositivo. Aguarde um pouco.'
        using errcode = 'P0003';
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: solicitar upload anônimo (pós-CAPTCHA)
-- -----------------------------------------------------------------------------

create or replace function public.solicitar_upload_resgate_anonimo(
  p_turnstile_token text,
  p_fingerprint text default null,
  p_honeypot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid;
  v_path text;
begin
  if p_honeypot is not null and length(trim(p_honeypot)) > 0 then
    raise exception 'Requisição inválida' using errcode = 'P0001';
  end if;

  if not public.verificar_turnstile(p_turnstile_token) then
    raise exception 'CAPTCHA inválido ou expirado. Tente novamente.'
      using errcode = 'P0001';
  end if;

  perform public.verificar_rate_limit_resgate(p_fingerprint);

  v_token_id := gen_random_uuid();
  v_path := 'anonymous/' || v_token_id::text || '/foto.jpg';

  insert into public.resgates_upload_tokens (id, storage_path, ip_hash)
  values (v_token_id, v_path, public.hash_request_ip());

  return jsonb_build_object(
    'upload_token_id', v_token_id,
    'storage_path', v_path
  );
end;
$$;

grant execute on function public.solicitar_upload_resgate_anonimo(text, text, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: confirmar resgate anônimo
-- -----------------------------------------------------------------------------

create or replace function public.confirmar_resgate_anonimo(
  p_upload_token_id uuid,
  p_porte_estimado text,
  p_regiao_aproximada text,
  p_descricao text default null,
  p_consentimento_localizacao boolean default false,
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
  v_token record;
  v_localizacao geography;
  v_lat numeric;
  v_lng numeric;
  v_contexto jsonb;
  v_registro_id uuid;
begin
  if p_porte_estimado is null or length(trim(p_porte_estimado)) = 0 then
    raise exception 'Porte estimado é obrigatório' using errcode = 'P0001';
  end if;

  if p_regiao_aproximada is null or length(trim(p_regiao_aproximada)) < 3 then
    raise exception 'Informe a região aproximada (bairro/cidade)' using errcode = 'P0001';
  end if;

  select * into v_token
  from public.resgates_upload_tokens
  where id = p_upload_token_id
    and not usado
    and expires_at > now();

  if not found then
    raise exception 'Upload expirado ou inválido. Refaça o CAPTCHA e envie a foto novamente.'
      using errcode = 'P0002';
  end if;

  if p_consentimento_localizacao then
    if p_latitude is null or p_longitude is null then
      raise exception 'Localização obrigatória quando o consentimento é concedido'
        using errcode = 'P0001';
    end if;
    v_lat := round(p_latitude::numeric, 3);
    v_lng := round(p_longitude::numeric, 3);
    v_localizacao := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;
  else
    v_localizacao := null;
  end if;

  v_contexto := coalesce(p_consentimento_contexto, '{}'::jsonb) || jsonb_build_object(
    'fluxo', 'resgate_anonimo',
    'ip_hash', public.hash_request_ip(),
    'consentimento_em', now()
  );

  insert into public.registros_resgate (
    registrado_por_user_id,
    foto_url,
    localizacao,
    consentimento_localizacao,
    consentimento_contexto,
    descricao,
    porte_estimado,
    regiao_aproximada,
    status
  )
  values (
    null,
    v_token.storage_path,
    v_localizacao,
    p_consentimento_localizacao,
    v_contexto,
    nullif(trim(p_descricao), ''),
    trim(p_porte_estimado),
    trim(p_regiao_aproximada),
    'disponivel'
  )
  returning id into v_registro_id;

  update public.resgates_upload_tokens
  set usado = true
  where id = p_upload_token_id;

  return jsonb_build_object(
    'registro_id', v_registro_id,
    'status', 'disponivel'
  );
end;
$$;

grant execute on function public.confirmar_resgate_anonimo(
  uuid, text, text, text, boolean, double precision, double precision, jsonb
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: abrir ocorrência de perdido (tutor)
-- -----------------------------------------------------------------------------

create or replace function public.abrir_ocorrencia_perdido(
  p_animal_id uuid,
  p_data_perda date,
  p_latitude double precision,
  p_longitude double precision,
  p_endereco_aproximado text default null,
  p_retroativa boolean default false,
  p_consentimento_contexto jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal record;
  v_tutor_id uuid;
  v_localizacao geography;
  v_ocorrencia_id uuid;
  v_aberta uuid;
begin
  v_tutor_id := public.current_tutor_id();
  if v_tutor_id is null then
    raise exception 'Apenas tutores autenticados podem abrir ocorrências'
      using errcode = 'P0001';
  end if;

  select id, tutor_id, nome into v_animal
  from public.animais
  where id = p_animal_id;

  if not found then
    raise exception 'Pet não encontrado' using errcode = 'P0002';
  end if;

  if v_animal.tutor_id <> v_tutor_id then
    raise exception 'Você não tem permissão para este pet' using errcode = 'P0001';
  end if;

  if p_data_perda is null then
    raise exception 'Data da perda é obrigatória' using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Localização é obrigatória para abrir a ocorrência'
      using errcode = 'P0001';
  end if;

  select id into v_aberta
  from public.ocorrencias_perdido
  where animal_id = p_animal_id
    and status = 'aberta'
  limit 1;

  if v_aberta is not null then
    raise exception 'Já existe uma ocorrência aberta para este pet'
      using errcode = 'P0001';
  end if;

  v_localizacao := st_setsrid(
    st_makepoint(p_longitude, p_latitude),
    4326
  )::geography;

  insert into public.ocorrencias_perdido (
    animal_id,
    tutor_id,
    data_perda,
    localizacao,
    endereco_aproximado,
    retroativa,
    status
  )
  values (
    p_animal_id,
    v_tutor_id,
    p_data_perda,
    v_localizacao,
    nullif(trim(p_endereco_aproximado), ''),
    coalesce(p_retroativa, false),
    'aberta'
  )
  returning id into v_ocorrencia_id;

  return jsonb_build_object(
    'ocorrencia_id', v_ocorrencia_id,
    'animal_nome', v_animal.nome,
    'status', 'aberta'
  );
end;
$$;

grant execute on function public.abrir_ocorrencia_perdido(
  uuid, date, double precision, double precision, text, boolean, jsonb
) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: registro de resgate autenticado (órgão ou usuário logado — sem CAPTCHA)
-- -----------------------------------------------------------------------------

create or replace function public.registrar_resgate_autenticado(
  p_foto_path text,
  p_porte_estimado text,
  p_regiao_aproximada text,
  p_descricao text default null,
  p_consentimento_localizacao boolean default false,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_organizacao_id uuid default null,
  p_consentimento_contexto jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_localizacao geography;
  v_registro_id uuid;
  v_contexto jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória' using errcode = 'P0001';
  end if;

  if p_foto_path is null or length(trim(p_foto_path)) = 0 then
    raise exception 'Foto é obrigatória' using errcode = 'P0001';
  end if;

  if p_porte_estimado is null or length(trim(p_porte_estimado)) = 0 then
    raise exception 'Porte estimado é obrigatório' using errcode = 'P0001';
  end if;

  if p_regiao_aproximada is null or length(trim(p_regiao_aproximada)) < 3 then
    raise exception 'Região aproximada é obrigatória' using errcode = 'P0001';
  end if;

  if p_organizacao_id is not null
    and p_organizacao_id not in (select public.user_organizacao_ids()) then
    raise exception 'Organização inválida para este usuário' using errcode = 'P0001';
  end if;

  if p_consentimento_localizacao then
    if p_latitude is null or p_longitude is null then
      raise exception 'Localização obrigatória com consentimento' using errcode = 'P0001';
    end if;
    v_localizacao := st_setsrid(
      st_makepoint(p_longitude, p_latitude),
      4326
    )::geography;
  else
    v_localizacao := null;
  end if;

  v_contexto := coalesce(p_consentimento_contexto, '{}'::jsonb) || jsonb_build_object(
    'fluxo', case when p_organizacao_id is not null then 'resgate_orgao' else 'resgate_autenticado' end,
    'user_id', auth.uid(),
    'consentimento_em', now()
  );

  insert into public.registros_resgate (
    registrado_por_user_id,
    organizacao_id,
    foto_url,
    localizacao,
    consentimento_localizacao,
    consentimento_contexto,
    descricao,
    porte_estimado,
    regiao_aproximada,
    status
  )
  values (
    auth.uid(),
    p_organizacao_id,
    trim(p_foto_path),
    v_localizacao,
    p_consentimento_localizacao,
    v_contexto,
    nullif(trim(p_descricao), ''),
    trim(p_porte_estimado),
    trim(p_regiao_aproximada),
    'disponivel'
  )
  returning id into v_registro_id;

  return jsonb_build_object(
    'registro_id', v_registro_id,
    'status', 'disponivel'
  );
end;
$$;

grant execute on function public.registrar_resgate_autenticado(
  text, text, text, text, boolean, double precision, double precision, uuid, jsonb
) to authenticated;
