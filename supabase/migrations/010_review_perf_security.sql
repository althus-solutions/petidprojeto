-- =============================================================================
-- PetID — Revisão técnica: performance, concorrência, índices, retenção
-- Rode após 009_matching_ia_rf06.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Config operacional de matching (limites e timeout de jobs)
-- -----------------------------------------------------------------------------

update public.configuracoes_sistema
set valor = valor || jsonb_build_object(
  'max_candidatos_por_execucao', 200,
  'job_processando_timeout_minutos', 15
)
where chave = 'ai_provider'
  and not (valor ? 'max_candidatos_por_execucao');

-- -----------------------------------------------------------------------------
-- 2) Índices de performance (PostGIS, pgvector, filtros de matching)
-- -----------------------------------------------------------------------------

create index if not exists idx_organizacoes_regiao_atuacao
  on public.organizacoes using gist (regiao_atuacao)
  where regiao_atuacao is not null;

create index if not exists idx_ocorrencias_abertas_animal
  on public.ocorrencias_perdido (animal_id)
  where status = 'aberta';

create index if not exists idx_ocorrencias_abertas_localizacao
  on public.ocorrencias_perdido using gist (localizacao)
  where status = 'aberta';

create index if not exists idx_animais_embedding_ativo
  on public.animais (embedding_space_id)
  where embedding is not null;

create index if not exists idx_resgates_embedding_busca
  on public.registros_resgate (embedding_space_id, status, created_at desc)
  where embedding is not null
    and status in ('disponivel', 'em_analise');

create index if not exists idx_matches_ocorrencia_status
  on public.matches (ocorrencia_id, status, score desc);

create index if not exists idx_retencao_resgates_created
  on public.registros_resgate (created_at)
  where status in ('disponivel', 'em_analise');

-- HNSW: eficiente em volumes baixos/médios; trocar para IVFFlat se > ~500k vetores
create index if not exists idx_animais_embedding_hnsw
  on public.animais using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null;

create index if not exists idx_resgates_embedding_hnsw
  on public.registros_resgate using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null;

-- -----------------------------------------------------------------------------
-- 3) Reclaim de jobs travados em "processando" (crash da Edge / n8n)
-- -----------------------------------------------------------------------------

create or replace function public.reclaim_stale_matching_jobs(
  p_timeout_minutes integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timeout integer;
  v_count integer;
begin
  select coalesce(
    p_timeout_minutes,
    (valor ->> 'job_processando_timeout_minutos')::integer,
    15
  )
  into v_timeout
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  v_timeout := greatest(coalesce(v_timeout, 15), 5);

  update public.matching_jobs
  set
    status = 'pendente',
    claimed_at = null,
    claimed_by = null,
    ultimo_erro = left(
      coalesce(ultimo_erro, '') || ' [reclaimed stale]',
      2000
    ),
    updated_at = now()
  where status = 'processando'
    and claimed_at is not null
    and claimed_at < now() - make_interval(mins => v_timeout);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reclaim_stale_matching_jobs(integer) from public, anon, authenticated;
grant execute on function public.reclaim_stale_matching_jobs(integer) to service_role;

create or replace function public.claim_matching_job(
  p_claimed_by text default 'n8n',
  p_tipos text[] default array['resgate', 'animal', 'ocorrencia']
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.matching_jobs%rowtype;
begin
  perform public.reclaim_stale_matching_jobs(null);

  select *
  into v_job
  from public.matching_jobs
  where status in ('pendente', 'falha')
    and tentativas < max_tentativas
    and tipo = any (p_tipos)
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'fila_vazia');
  end if;

  update public.matching_jobs
  set
    status = 'processando',
    tentativas = tentativas + 1,
    claimed_at = now(),
    claimed_by = coalesce(p_claimed_by, 'n8n'),
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'ok', true,
    'job', jsonb_build_object(
      'id', v_job.id,
      'tipo', v_job.tipo,
      'entidade_id', v_job.entidade_id,
      'tentativas', v_job.tentativas
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Matching par ocorrência×resgate (evita O(n²) e notificação duplicada)
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
        or st_dwithin(v_r.localizacao, o.localizacao, v_raio_m)
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

-- -----------------------------------------------------------------------------
-- 5) Retenção: limpar colunas RF-06 (analise_visual, metadados IA)
-- -----------------------------------------------------------------------------

create or replace function public.executar_retencao_registros_sem_dono(
  p_dry_run boolean default true,
  p_disparado_por text default 'rpc',
  p_disparado_por_user_id uuid default null,
  p_limite_amostra integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias integer;
  v_candidatos integer := 0;
  v_anonimizados integer := 0;
  v_amostra uuid[] := '{}';
  v_execucao_id uuid;
  v_modo text;
begin
  if p_disparado_por not in ('manual_admin', 'pg_cron', 'n8n', 'rpc') then
    raise exception 'disparado_por inválido: %', p_disparado_por;
  end if;

  select (valor ->> 'dias')::integer
  into v_dias
  from public.configuracoes_sistema
  where chave = 'dias_retencao_sem_dono';

  if v_dias is null or v_dias <= 0 then
    raise exception 'Parâmetro dias_retencao_sem_dono ausente ou inválido';
  end if;

  select count(*)::integer
  into v_candidatos
  from public.registros_elegiveis_retencao(v_dias);

  select coalesce(array_agg(e.id order by e.created_at), '{}')
  into v_amostra
  from (
    select id, created_at
    from public.registros_elegiveis_retencao(v_dias)
    order by created_at
    limit greatest(coalesce(p_limite_amostra, 25), 1)
  ) e;

  v_modo := case when p_dry_run then 'dry_run' else 'aplicar' end;

  if not p_dry_run and v_candidatos > 0 then
    update public.registros_resgate r
    set
      foto_url = null,
      localizacao = null,
      consentimento_localizacao = false,
      consentimento_contexto = '{}'::jsonb,
      regiao_aproximada = null,
      embedding = null,
      analise_visual = '{}'::jsonb,
      embedding_space_id = null,
      embedding_model_id = null,
      especie_estimada = null,
      idade_estimada = null,
      sexo_estimado = null,
      descricao = null,
      porte_estimado = null,
      cor_estimada = null,
      raca_estimada = null,
      status = 'anonimizado'
    where r.id in (select e.id from public.registros_elegiveis_retencao(v_dias) e);

    get diagnostics v_anonimizados = row_count;
  end if;

  insert into public.retencao_execucoes (
    modo,
    disparado_por,
    disparado_por_user_id,
    dias_retencao,
    candidatos,
    anonimizados,
    amostra_ids,
    detalhes
  )
  values (
    v_modo,
    p_disparado_por,
    p_disparado_por_user_id,
    v_dias,
    v_candidatos,
    v_anonimizados,
    v_amostra,
    jsonb_build_object(
      'status_elegiveis', jsonb_build_array('disponivel', 'em_analise'),
      'exclui_match', 'confirmado_tutor',
      'limpa_analise_visual', true
    )
  )
  returning id into v_execucao_id;

  update public.configuracoes_sistema
  set valor = valor
    || case
         when p_dry_run then
           jsonb_build_object(
             'ultimo_dry_run_em', to_jsonb(now()),
             'ultimo_dry_run_candidatos', v_candidatos
           )
         else
           jsonb_build_object(
             'ultimo_execucao_em', to_jsonb(now()),
             'ultimo_execucao_anonimizados', v_anonimizados
           )
       end
  where chave = 'job_retencao';

  return jsonb_build_object(
    'ok', true,
    'modo', v_modo,
    'execucao_id', v_execucao_id,
    'dias_retencao', v_dias,
    'candidatos', v_candidatos,
    'anonimizados', v_anonimizados,
    'amostra_ids', to_jsonb(v_amostra),
    'agendamento_ativo', coalesce(
      (
        select (valor ->> 'agendamento_ativo')::boolean
        from public.configuracoes_sistema
        where chave = 'job_retencao'
      ),
      false
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) Listar matches: excluir resgates anonimizados
-- -----------------------------------------------------------------------------

create or replace function public.listar_matches_tutor(
  p_status text default 'sugerido'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := public.current_tutor_id();
  v_out jsonb;
begin
  if v_tutor is null then
    raise exception 'Apenas tutores' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.score desc, t.created_at desc), '[]'::jsonb)
  into v_out
  from (
    select
      m.id,
      m.ocorrencia_id,
      m.registro_resgate_id,
      m.score,
      m.status,
      m.score_versao,
      m.detalhes,
      m.created_at,
      m.notificado_em,
      a.nome as animal_nome,
      a.id as animal_id,
      r.porte_estimado,
      r.cor_estimada,
      r.raca_estimada,
      r.especie_estimada,
      r.regiao_aproximada,
      r.foto_url as resgate_foto_path,
      r.descricao as resgate_descricao
    from public.matches m
    join public.ocorrencias_perdido o on o.id = m.ocorrencia_id
    join public.animais a on a.id = o.animal_id
    join public.registros_resgate r on r.id = m.registro_resgate_id
    where o.tutor_id = v_tutor
      and r.status is distinct from 'anonimizado'
      and (p_status is null or m.status = p_status)
    limit 50
  ) t;

  return v_out;
end;
$$;
