-- Migration 014: após confirmar resgate na tag, devolver telefone do tutor (E.164)
-- para abrir WhatsApp na tela final. Não expor telefone em obter_pet_por_qr.

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
    'canal_preferido', v_canal,
    'tutor_telefone_whatsapp', v_telefone_whatsapp
  );
end;
$$;

comment on function public.registrar_leitura_qr(
  text, boolean, double precision, double precision, jsonb
) is
  'Registra leitura da tag, notifica o tutor e devolve telefone E.164 (se houver) só após confirmação — para CTA WhatsApp na tela final.';
