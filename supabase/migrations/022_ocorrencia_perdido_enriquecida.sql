-- PetID — Ocorrência de perda enriquecida (geocoding, coleira, raio, consentimento, foto do dia)
-- Aplicar no SQL Editor após 021.

-- -----------------------------------------------------------------------------
-- 1) Novos campos em ocorrencias_perdido
-- -----------------------------------------------------------------------------

alter table public.ocorrencias_perdido
  add column if not exists horario_perda time,
  add column if not exists horario_desconhecido boolean not null default true,
  add column if not exists com_identificacao text
    check (
      com_identificacao is null
      or com_identificacao in ('sim', 'nao', 'nao_sei')
    ),
  add column if not exists circunstancias text,
  add column if not exists foto_dia_path text,
  add column if not exists raio_busca_km numeric not null default 2
    check (raio_busca_km in (1, 2, 5, 10)),
  add column if not exists contato_alternativo text,
  add column if not exists fonte_localizacao text
    check (
      fonte_localizacao is null
      or fonte_localizacao in ('autocomplete', 'manual', 'gps')
    ),
  add column if not exists consentimento_ocorrencia_em timestamptz,
  add column if not exists consentimento_ocorrencia_contexto jsonb;

comment on column public.ocorrencias_perdido.horario_perda is
  'Horário aproximado da perda (null se desconhecido).';
comment on column public.ocorrencias_perdido.com_identificacao is
  'Se o animal estava com coleira/tag/NFC na perda: sim|nao|nao_sei.';
comment on column public.ocorrencias_perdido.foto_dia_path is
  'Foto opcional “como estava no dia” no bucket pets (além das fotos do perfil).';
comment on column public.ocorrencias_perdido.raio_busca_km is
  'Raio de matching geográfico desta ocorrência (padrão 2km).';
comment on column public.ocorrencias_perdido.contato_alternativo is
  'Contato opcional só para este caso; se null, usa telefone/canal do tutor.';
comment on column public.ocorrencias_perdido.consentimento_ocorrencia_em is
  'Consentimento específico para expor a ocorrência a parceiros/matching.';

-- -----------------------------------------------------------------------------
-- 2) RLS — auditoria (já existente; reforço documental)
-- Tutor: CRUD próprio. Órgão: SELECT se ponto na região. Matching: security definer / service_role.
-- -----------------------------------------------------------------------------

-- Policies já em schema.sql / 005:
--   ocorrencias_tutor_select|insert|update|delete (tutor_id = current_tutor_id)
--   ocorrencias_org_select (organizacao_cobre_ponto)
-- Matching engine NÃO lê via client anon — usa executar_match_* (security definer / service_role).

-- -----------------------------------------------------------------------------
-- 3) RPC abrir_ocorrencia_perdido (assinatura ampliada)
-- -----------------------------------------------------------------------------

drop function if exists public.abrir_ocorrencia_perdido(
  uuid, date, double precision, double precision, text, boolean, jsonb
);

create or replace function public.abrir_ocorrencia_perdido(
  p_animal_id uuid,
  p_data_perda date,
  p_latitude double precision,
  p_longitude double precision,
  p_endereco_aproximado text default null,
  p_retroativa boolean default false,
  p_consentimento_contexto jsonb default '{}'::jsonb,
  p_horario_perda time default null,
  p_horario_desconhecido boolean default true,
  p_com_identificacao text default 'nao_sei',
  p_circunstancias text default null,
  p_foto_dia_path text default null,
  p_raio_busca_km numeric default 2,
  p_contato_alternativo text default null,
  p_fonte_localizacao text default 'autocomplete',
  p_consentimento_ocorrencia boolean default false
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
  v_raio numeric;
  v_id text;
  v_fonte text;
begin
  v_tutor_id := public.current_tutor_id();
  if v_tutor_id is null then
    raise exception 'Apenas tutores autenticados podem abrir ocorrências'
      using errcode = 'P0001';
  end if;

  if coalesce(p_consentimento_ocorrencia, false) is not true then
    raise exception 'Consentimento da ocorrência é obrigatório'
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

  if p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Coordenadas fora do intervalo válido' using errcode = 'P0001';
  end if;

  v_raio := coalesce(p_raio_busca_km, 2);
  if v_raio not in (1, 2, 5, 10) then
    raise exception 'Raio de busca inválido (use 1, 2, 5 ou 10 km)'
      using errcode = 'P0001';
  end if;

  v_id := lower(trim(coalesce(p_com_identificacao, 'nao_sei')));
  if v_id not in ('sim', 'nao', 'nao_sei') then
    raise exception 'Valor inválido para identificação (coleira/tag)'
      using errcode = 'P0001';
  end if;

  v_fonte := lower(trim(coalesce(p_fonte_localizacao, 'autocomplete')));
  if v_fonte not in ('autocomplete', 'manual', 'gps') then
    raise exception 'Fonte de localização inválida' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_endereco_aproximado, '')), '') is null
     and v_fonte = 'autocomplete' then
    raise exception 'Selecione um endereço confirmado na lista'
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
    status,
    horario_perda,
    horario_desconhecido,
    com_identificacao,
    circunstancias,
    foto_dia_path,
    raio_busca_km,
    contato_alternativo,
    fonte_localizacao,
    consentimento_ocorrencia_em,
    consentimento_ocorrencia_contexto
  )
  values (
    p_animal_id,
    v_tutor_id,
    p_data_perda,
    v_localizacao,
    nullif(trim(p_endereco_aproximado), ''),
    coalesce(p_retroativa, false),
    'aberta',
    case when coalesce(p_horario_desconhecido, true) then null else p_horario_perda end,
    coalesce(p_horario_desconhecido, true),
    v_id,
    nullif(trim(p_circunstancias), ''),
    nullif(trim(p_foto_dia_path), ''),
    v_raio,
    nullif(trim(p_contato_alternativo), ''),
    v_fonte,
    now(),
    coalesce(p_consentimento_contexto, '{}'::jsonb) || jsonb_build_object(
      'consentimento_ocorrencia', true,
      'registrado_em', now()
    )
  )
  returning id into v_ocorrencia_id;

  return jsonb_build_object(
    'ocorrencia_id', v_ocorrencia_id,
    'animal_nome', v_animal.nome,
    'status', 'aberta',
    'raio_busca_km', v_raio
  );
end;
$$;

grant execute on function public.abrir_ocorrencia_perdido(
  uuid, date, double precision, double precision, text, boolean, jsonb,
  time, boolean, text, text, text, numeric, text, text, boolean
) to authenticated;

comment on function public.abrir_ocorrencia_perdido is
  'Abre ocorrência de perda do tutor. Popula localizacao (PostGIS) via lat/lng confirmados. qr_payload do pet não é alterado.';

-- -----------------------------------------------------------------------------
-- 4) Matching usa raio_busca_km da ocorrência (fallback: config global)
-- -----------------------------------------------------------------------------

create or replace function public.executar_match_par(
  p_ocorrencia_id uuid,
  p_registro_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o public.ocorrencias_perdido%rowtype;
  v_r public.registros_resgate%rowtype;
  v_a public.animais%rowtype;
  v_tutor_user uuid;
  v_raio_km numeric;
  v_raio_m double precision;
  v_limiar numeric;
  v_require_geo boolean;
  v_space text;
  v_score_versao text;
  v_sim numeric;
  v_score numeric;
  v_match_id uuid;
  v_notified boolean := false;
  v_porte_ok boolean;
  v_especie_ok boolean;
  v_tem_geo boolean;
  v_dist_m double precision;
begin
  select * into v_o
  from public.ocorrencias_perdido
  where id = p_ocorrencia_id;

  if not found or v_o.status <> 'aberta' then
    return jsonb_build_object('ok', false, 'motivo', 'ocorrencia_invalida');
  end if;

  select * into v_r
  from public.registros_resgate
  where id = p_registro_id;

  if not found
     or v_r.status not in ('disponivel', 'em_analise')
     or v_r.embedding is null then
    return jsonb_build_object('ok', false, 'motivo', 'resgate_invalido');
  end if;

  select * into v_a from public.animais where id = v_o.animal_id;

  if v_a.embedding is null then
    return jsonb_build_object('ok', false, 'motivo', 'animal_sem_embedding');
  end if;

  select coalesce((valor ->> 'km')::numeric, 2)
  into v_raio_km
  from public.configuracoes_sistema
  where chave = 'raio_matching_km';

  -- Raio da ocorrência prevalece sobre o default global
  v_raio_km := coalesce(v_o.raio_busca_km, v_raio_km, 2);

  select coalesce((valor ->> 'percentual')::numeric, 75)
  into v_limiar
  from public.configuracoes_sistema
  where chave = 'score_minimo_notificacao';

  select
    coalesce(valor ->> 'embedding_space_id', 'petid-embed-v1'),
    coalesce(valor ->> 'score_versao', '1.0'),
    coalesce((valor ->> 'require_geo_for_auto_notify')::boolean, true)
  into v_space, v_score_versao, v_require_geo
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  v_raio_m := (coalesce(v_raio_km, 2) * 1000)::double precision;
  v_space := coalesce(v_r.embedding_space_id, v_a.embedding_space_id, v_space);
  v_tem_geo := v_r.localizacao is not null and v_o.localizacao is not null;

  if v_a.embedding_space_id is distinct from v_space
     or v_r.embedding_space_id is distinct from v_space then
    return jsonb_build_object('ok', false, 'motivo', 'embedding_space_incompativel');
  end if;

  if v_tem_geo then
    v_dist_m := st_distance(v_r.localizacao, v_o.localizacao);
    if not st_dwithin(v_r.localizacao, v_o.localizacao, v_raio_m) then
      return jsonb_build_object('ok', false, 'motivo', 'fora_do_raio', 'dist_m', v_dist_m);
    end if;
  else
    v_dist_m := null;
  end if;

  v_sim := greatest(0, least(1, 1 - (v_r.embedding <=> v_a.embedding)));

  v_especie_ok := null;
  if v_r.especie_estimada is not null and v_a.especie is not null then
    v_especie_ok := lower(v_r.especie_estimada) = lower(v_a.especie)
      or (
        (lower(v_r.especie_estimada) in ('cao', 'cão', 'cachorro', 'dog'))
        and (lower(v_a.especie) in ('cao', 'cão', 'cachorro', 'dog', 'cão'))
      )
      or (
        (lower(v_r.especie_estimada) like '%gato%' or lower(v_r.especie_estimada) = 'cat')
        and (lower(v_a.especie) like '%gato%' or lower(v_a.especie) = 'cat')
      );
  end if;

  v_porte_ok := false;
  if v_r.porte_estimado is not null and v_a.porte is not null then
    v_porte_ok := lower(v_r.porte_estimado) = lower(v_a.porte);
  end if;

  v_score := public.calcular_score_match_v1(
    v_sim,
    v_dist_m,
    v_raio_m,
    v_porte_ok,
    coalesce(v_especie_ok, true) and (v_especie_ok is not false),
    v_tem_geo or v_r.localizacao is not null
  );

  if v_especie_ok is false then
    v_score := least(v_score, 40);
  end if;

  insert into public.matches (
    ocorrencia_id,
    registro_resgate_id,
    score,
    status,
    score_versao,
    detalhes
  )
  values (
    p_ocorrencia_id,
    p_registro_id,
    v_score,
    'sugerido',
    v_score_versao,
    jsonb_build_object(
      'sim_visual', v_sim,
      'dist_metros', v_dist_m,
      'tem_geo', v_tem_geo,
      'porte_ok', v_porte_ok,
      'especie_ok', v_especie_ok
    )
  )
  on conflict (ocorrencia_id, registro_resgate_id) do update
    set
      score = case
        when matches.status in ('descartado', 'confirmado_tutor') then matches.score
        else excluded.score
      end,
      score_versao = case
        when matches.status in ('descartado', 'confirmado_tutor') then matches.score_versao
        else excluded.score_versao
      end,
      detalhes = case
        when matches.status in ('descartado', 'confirmado_tutor') then matches.detalhes
        else excluded.detalhes
      end,
      status = matches.status
  returning id into v_match_id;

  if v_score >= v_limiar
     and (not v_require_geo or v_r.localizacao is not null)
  then
    update public.matches
    set notificado_em = now()
    where id = v_match_id
      and status = 'sugerido'
      and notificado_em is null
    returning true into v_notified;

    if coalesce(v_notified, false) then
      select t.user_id into v_tutor_user
      from public.tutores t
      where t.id = v_o.tutor_id;

      if v_tutor_user is not null then
        perform public.enfileirar_notificacao_tutor(
          v_tutor_user,
          'match_sugerido',
          jsonb_build_object(
            'match_id', v_match_id,
            'ocorrencia_id', p_ocorrencia_id,
            'registro_resgate_id', p_registro_id,
            'animal_nome', v_a.nome,
            'score', v_score
          ),
          null
        );
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'match_id', v_match_id,
    'score', v_score,
    'notificado', coalesce(v_notified, false)
  );
end;
$$;

create or replace function public.executar_matching_para_resgate(p_registro_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.registros_resgate%rowtype;
  v_space text;
  v_raio_km numeric;
  v_raio_m double precision;
  v_max integer;
  v_candidatos integer := 0;
  v_upserts integer := 0;
  v_notificados integer := 0;
  r record;
  v_one jsonb;
begin
  select * into v_r from public.registros_resgate where id = p_registro_id;
  if not found then
    raise exception 'Resgate não encontrado' using errcode = 'P0002';
  end if;

  if v_r.status = 'anonimizado' or v_r.embedding is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_embedding_ou_anonimizado');
  end if;

  select coalesce((valor ->> 'km')::numeric, 2)
  into v_raio_km
  from public.configuracoes_sistema
  where chave = 'raio_matching_km';

  select coalesce(
    (valor ->> 'max_candidatos_por_execucao')::integer,
    200
  )
  into v_max
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  v_max := least(greatest(coalesce(v_max, 200), 1), 500);
  v_raio_m := (coalesce(v_raio_km, 2) * 1000)::double precision;
  v_space := coalesce(v_r.embedding_space_id, 'petid-embed-v1');

  for r in
    select
      o.id as ocorrencia_id,
      case
        when v_r.localizacao is not null and o.localizacao is not null
          then st_distance(v_r.localizacao, o.localizacao)
        else null
      end as dist_m,
      case
        when a.embedding is not null then (1 - (v_r.embedding <=> a.embedding))
        else 0
      end as sim_visual
    from public.ocorrencias_perdido o
    join public.animais a on a.id = o.animal_id
    where o.status = 'aberta'
      and a.embedding is not null
      and coalesce(a.embedding_space_id, v_space) = v_space
      and (
        v_r.localizacao is null
        or o.localizacao is null
        or st_dwithin(
          v_r.localizacao,
          o.localizacao,
          (coalesce(o.raio_busca_km, 2) * 1000)::double precision
        )
      )
    order by (v_r.embedding <=> a.embedding)
    limit v_max
  loop
    v_candidatos := v_candidatos + 1;
    v_one := public.executar_match_par(r.ocorrencia_id, p_registro_id);
    if coalesce((v_one ->> 'ok')::boolean, false) then
      v_upserts := v_upserts + 1;
      if coalesce((v_one ->> 'notificado')::boolean, false) then
        v_notificados := v_notificados + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'registro_id', p_registro_id,
    'candidatos', v_candidatos,
    'upserts', v_upserts,
    'notificados', v_notificados,
    'raio_km', v_raio_km,
    'max_candidatos', v_max
  );
end;
$$;

create or replace function public.executar_matching_para_ocorrencia(p_ocorrencia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o public.ocorrencias_perdido%rowtype;
  v_animal public.animais%rowtype;
  v_raio_km numeric;
  v_raio_m double precision;
  v_max integer;
  v_total integer := 0;
  v_upserts integer := 0;
  v_notificados integer := 0;
  v_acc jsonb := '[]'::jsonb;
  r record;
  v_one jsonb;
begin
  select * into v_o from public.ocorrencias_perdido where id = p_ocorrencia_id;
  if not found then
    raise exception 'Ocorrência não encontrada' using errcode = 'P0002';
  end if;

  if v_o.status <> 'aberta' then
    return jsonb_build_object('ok', false, 'motivo', 'ocorrencia_nao_aberta');
  end if;

  select * into v_animal from public.animais where id = v_o.animal_id;
  if v_animal.embedding is null then
    perform public.enfileirar_matching_job('animal', v_animal.id);
    return jsonb_build_object('ok', false, 'motivo', 'animal_sem_embedding', 'requeued_animal', true);
  end if;

  select coalesce((valor ->> 'km')::numeric, 2)
  into v_raio_km
  from public.configuracoes_sistema
  where chave = 'raio_matching_km';

  v_raio_km := coalesce(v_o.raio_busca_km, v_raio_km, 2);

  select coalesce(
    (valor ->> 'max_candidatos_por_execucao')::integer,
    200
  )
  into v_max
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  v_max := least(greatest(coalesce(v_max, 200), 1), 500);
  v_raio_m := (coalesce(v_raio_km, 2) * 1000)::double precision;

  for r in
    select rr.id
    from public.registros_resgate rr
    where rr.status in ('disponivel', 'em_analise')
      and rr.embedding is not null
      and rr.embedding_space_id is not distinct from v_animal.embedding_space_id
      and (
        v_o.localizacao is null
        or rr.localizacao is null
        or st_dwithin(v_o.localizacao, rr.localizacao, v_raio_m)
      )
    order by (v_animal.embedding <=> rr.embedding)
    limit v_max
  loop
    v_total := v_total + 1;
    v_one := public.executar_match_par(p_ocorrencia_id, r.id);
    v_acc := v_acc || jsonb_build_array(v_one);
    if coalesce((v_one ->> 'ok')::boolean, false) then
      v_upserts := v_upserts + 1;
      if coalesce((v_one ->> 'notificado')::boolean, false) then
        v_notificados := v_notificados + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'ocorrencia_id', p_ocorrencia_id,
    'resgates_processados', v_total,
    'upserts', v_upserts,
    'notificados', v_notificados,
    'max_candidatos', v_max,
    'detalhe', v_acc
  );
end;
$$;


revoke all on function public.executar_match_par(uuid, uuid) from public, anon, authenticated;
grant execute on function public.executar_match_par(uuid, uuid) to service_role;
