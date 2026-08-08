-- =============================================================================
-- Migration 006 — Notificações multicanal (Prompt 7)
-- Fila assíncrona em notificacoes + RPCs para n8n (WhatsApp / e-mail / push)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Estender tabela notificacoes (fila pendente → enviado)
-- -----------------------------------------------------------------------------

alter table public.notificacoes
  add column if not exists status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'falha', 'cancelado')),
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists erro text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists processado_em timestamptz;

-- Registros anteriores ao Prompt 7: tratar como já processados (só log no banco)
update public.notificacoes
set
  status = 'enviado',
  processado_em = coalesce(processado_em, enviado_em, created_at, now())
where status = 'pendente';

alter table public.notificacoes
  alter column enviado_em drop default;

alter table public.notificacoes
  alter column enviado_em drop not null;

create index if not exists idx_notificacoes_pendentes
  on public.notificacoes (created_at)
  where status = 'pendente';

-- -----------------------------------------------------------------------------
-- 2. Push subscriptions (Web Push PWA)
-- -----------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_self on public.push_subscriptions;
create policy push_subscriptions_self on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Configurações de notificação (custo WhatsApp, remetente, fallback)
-- -----------------------------------------------------------------------------

insert into public.configuracoes_sistema (chave, valor)
values
  (
    'notificacoes',
    jsonb_build_object(
      'custo_whatsapp_utility_brl', 0.037,
      'email_remetente', 'PetID <notificacoes@petid.app>',
      'app_url', 'https://petid.app',
      'fallback_canal', 'email',
      'whatsapp_provedor', 'z-api'
    )
  )
on conflict (chave) do nothing;

-- Leitura anônima não necessária; tutores autenticados leem via policy existente

-- -----------------------------------------------------------------------------
-- 4. Helpers: telefone E.164 Brasil, mensagens por tipo_evento
-- -----------------------------------------------------------------------------

create or replace function public.normalizar_telefone_br(p_telefone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  if p_telefone is null or length(trim(p_telefone)) = 0 then
    return null;
  end if;

  v_digits := regexp_replace(p_telefone, '\D', '', 'g');

  if v_digits ~ '^55' and length(v_digits) >= 12 then
    return v_digits;
  end if;

  if length(v_digits) = 11 or length(v_digits) = 10 then
    return '55' || v_digits;
  end if;

  return null;
end;
$$;

create or replace function public.montar_conteudo_notificacao(
  p_tipo_evento text,
  p_payload jsonb,
  p_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_app_url text := coalesce(p_config ->> 'app_url', 'https://petid.app');
  v_nome text := coalesce(p_payload ->> 'animal_nome', 'seu pet');
  v_assunto text;
  v_corpo text;
  v_maps text;
begin
  case p_tipo_evento
    when 'qr_lido' then
      v_assunto := 'QR Code do PetID foi lido';
      v_corpo := format(
        'Olá! Alguém leu o QR Code de %s no PetID. Acesse %s/tutor para mais detalhes.',
        v_nome,
        v_app_url
      );

    when 'qr_lido_com_localizacao' then
      v_maps := null;
      if (p_payload ? 'latitude') and (p_payload ? 'longitude') then
        v_maps := format(
          'https://www.google.com/maps?q=%s,%s',
          p_payload ->> 'latitude',
          p_payload ->> 'longitude'
        );
      end if;

      v_assunto := 'QR Code lido com localização aproximada';
      v_corpo := format(
        'Alguém leu o QR Code de %s e compartilhou localização aproximada no PetID.',
        v_nome
      );

      if v_maps is not null then
        v_corpo := v_corpo || E'\n\nVer no mapa: ' || v_maps;
      end if;

      v_corpo := v_corpo || format(E'\n\nPainel: %s/tutor', v_app_url);

    when 'match_sugerido' then
      v_assunto := 'Possível match para animal perdido';
      v_corpo := format(
        'Encontramos um animal resgatado que pode ser o %s (score %s%%). Confira em %s/tutor.',
        v_nome,
        coalesce(p_payload ->> 'score', '?'),
        v_app_url
      );

    when 'ocorrencia_aberta' then
      v_assunto := 'Ocorrência de perda registrada';
      v_corpo := format(
        'Sua ocorrência de perda para %s foi registrada. Acompanhe em %s/tutor.',
        v_nome,
        v_app_url
      );

    when 'resgate_registrado' then
      v_assunto := 'Novo resgate na sua região';
      v_corpo := format(
        'Um animal foi registrado como resgatado perto da sua ocorrência. Veja %s/tutor.',
        v_app_url
      );

    else
      v_assunto := 'Notificação PetID';
      v_corpo := format('Você tem uma nova notificação no PetID. Acesse %s/tutor.', v_app_url);
  end case;

  return jsonb_build_object(
    'assunto', v_assunto,
    'corpo_texto', v_corpo,
    'corpo_html', replace(replace(v_corpo, E'\n', '<br>'), '"', '&quot;')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: contexto completo para o workflow n8n enviar mensagem
-- -----------------------------------------------------------------------------

create or replace function public.obter_contexto_notificacao_envio(p_notificacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notif record;
  v_tutor record;
  v_auth_email text;
  v_config jsonb;
  v_conteudo jsonb;
  v_canal text;
  v_push_count integer;
  v_telefone text;
begin
  select n.id, n.destinatario_user_id, n.canal, n.tipo_evento, n.payload, n.status
  into v_notif
  from public.notificacoes n
  where n.id = p_notificacao_id;

  if not found then
    raise exception 'Notificação não encontrada' using errcode = 'P0002';
  end if;

  if v_notif.status <> 'pendente' then
    return jsonb_build_object(
      'ignorar', true,
      'motivo', 'status_nao_pendente',
      'status', v_notif.status
    );
  end if;

  select t.id, t.nome, t.telefone, t.email, t.canal_notificacao_preferido
  into v_tutor
  from public.tutores t
  where t.user_id = v_notif.destinatario_user_id
  limit 1;

  select u.email into v_auth_email
  from auth.users u
  where u.id = v_notif.destinatario_user_id;

  select valor into v_config
  from public.configuracoes_sistema
  where chave = 'notificacoes';

  v_config := coalesce(v_config, '{}'::jsonb);
  v_canal := coalesce(v_notif.canal, v_tutor.canal_notificacao_preferido, 'email');
  v_conteudo := public.montar_conteudo_notificacao(v_notif.tipo_evento, v_notif.payload, v_config);

  select count(*)::integer into v_push_count
  from public.push_subscriptions ps
  where ps.user_id = v_notif.destinatario_user_id;

  v_telefone := public.normalizar_telefone_br(coalesce(v_tutor.telefone, ''));

  -- Push sem inscrição → fallback configurável (padrão e-mail)
  if v_canal = 'push' and v_push_count = 0 then
    v_canal := coalesce(v_config ->> 'fallback_canal', 'email');
  end if;

  -- WhatsApp sem telefone → e-mail
  if v_canal = 'whatsapp' and v_telefone is null then
    v_canal := 'email';
  end if;

  return jsonb_build_object(
    'ignorar', false,
    'notificacao_id', v_notif.id,
    'canal', v_canal,
    'canal_original', coalesce(v_notif.canal, v_tutor.canal_notificacao_preferido),
    'tipo_evento', v_notif.tipo_evento,
    'payload', v_notif.payload,
    'destinatario', jsonb_build_object(
      'user_id', v_notif.destinatario_user_id,
      'nome', coalesce(v_tutor.nome, 'Tutor'),
      'email', coalesce(v_tutor.email, v_auth_email),
      'telefone_e164', v_telefone
    ),
    'mensagem', v_conteudo,
    'push', jsonb_build_object(
      'disponivel', v_push_count > 0,
      'quantidade_inscricoes', v_push_count
    ),
    'custo_estimado_whatsapp_brl', coalesce(
      (v_config ->> 'custo_whatsapp_utility_brl')::numeric,
      0.037
    ),
    'config', v_config
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: confirmar envio (n8n após sucesso no canal)
-- -----------------------------------------------------------------------------

create or replace function public.confirmar_envio_notificacao(
  p_notificacao_id uuid,
  p_canal_efetivo text default null,
  p_custo_estimado numeric default null,
  p_detalhes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_canal_efetivo is not null
    and p_canal_efetivo not in ('whatsapp', 'email', 'push') then
    raise exception 'Canal inválido: %', p_canal_efetivo using errcode = 'P0001';
  end if;

  update public.notificacoes
  set
    status = 'enviado',
    canal = coalesce(p_canal_efetivo, canal),
    custo_estimado = case
      when coalesce(p_canal_efetivo, canal) = 'whatsapp' then p_custo_estimado
      else coalesce(p_custo_estimado, 0)
    end,
    enviado_em = now(),
    processado_em = now(),
    payload = payload || coalesce(p_detalhes, '{}'::jsonb),
    erro = null
  where id = p_notificacao_id
    and status = 'pendente';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'nao_pendente_ou_inexistente');
  end if;

  return jsonb_build_object('ok', true, 'notificacao_id', p_notificacao_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: registrar falha de envio
-- -----------------------------------------------------------------------------

create or replace function public.registrar_falha_notificacao(
  p_notificacao_id uuid,
  p_erro text,
  p_detalhes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.notificacoes
  set
    status = 'falha',
    erro = left(coalesce(p_erro, 'erro desconhecido'), 2000),
    processado_em = now(),
    payload = payload || coalesce(p_detalhes, '{}'::jsonb)
  where id = p_notificacao_id
    and status = 'pendente';

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok', v_updated > 0,
    'notificacao_id', p_notificacao_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: salvar push subscription (tutor autenticado)
-- -----------------------------------------------------------------------------

create or replace function public.salvar_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória' using errcode = 'P0001';
  end if;

  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'Dados de inscrição push incompletos' using errcode = 'P0001';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), trim(p_endpoint), trim(p_p256dh), trim(p_auth), p_user_agent)
  on conflict (user_id, endpoint) do update
  set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent
  returning id into v_id;

  return jsonb_build_object('ok', true, 'subscription_id', v_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: listar subscriptions para Edge Function / n8n (service role)
-- -----------------------------------------------------------------------------

create or replace function public.listar_push_subscriptions_usuario(p_user_id uuid)
returns setof public.push_subscriptions
language sql
security definer
set search_path = public
as $$
  select *
  from public.push_subscriptions
  where user_id = p_user_id;
$$;

grant execute on function public.obter_contexto_notificacao_envio(uuid) to service_role;
grant execute on function public.confirmar_envio_notificacao(uuid, text, numeric, jsonb) to service_role;
grant execute on function public.registrar_falha_notificacao(uuid, text, jsonb) to service_role;
grant execute on function public.listar_push_subscriptions_usuario(uuid) to service_role;
grant execute on function public.salvar_push_subscription(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Atualizar registrar_leitura_qr — enfileirar com payload (status pendente)
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
  v_notificacao_id uuid;
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

    v_lat := round(p_latitude::numeric, 3);
    v_lng := round(p_longitude::numeric, 3);
    v_localizacao := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;
    v_tipo_evento := 'qr_lido_com_localizacao';
  else
    v_lat := null;
    v_lng := null;
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
      'longitude', v_lng
    )
  )
  returning id into v_notificacao_id;

  return jsonb_build_object(
    'leitura_id', v_leitura_id,
    'notificacao_id', v_notificacao_id,
    'animal_nome', v_animal.nome,
    'notificado', true,
    'com_localizacao', p_consentimento_localizacao,
    'canal_preferido', v_canal
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Enfileirar notificação genérica (match, ocorrência — Prompt 6/8)
-- -----------------------------------------------------------------------------

create or replace function public.enfileirar_notificacao_tutor(
  p_destinatario_user_id uuid,
  p_tipo_evento text,
  p_payload jsonb default '{}'::jsonb,
  p_canal_override text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canal text;
  v_id uuid;
begin
  select coalesce(
    p_canal_override,
    t.canal_notificacao_preferido,
    'email'
  )
  into v_canal
  from public.tutores t
  where t.user_id = p_destinatario_user_id
  limit 1;

  v_canal := coalesce(v_canal, p_canal_override, 'email');

  if v_canal not in ('whatsapp', 'email', 'push') then
    v_canal := 'email';
  end if;

  insert into public.notificacoes (
    destinatario_user_id,
    canal,
    tipo_evento,
    status,
    payload
  )
  values (
    p_destinatario_user_id,
    v_canal,
    p_tipo_evento,
    'pendente',
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.enfileirar_notificacao_tutor(uuid, text, jsonb, text) to service_role;
