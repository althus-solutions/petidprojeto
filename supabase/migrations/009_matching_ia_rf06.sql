-- =============================================================================
-- PetID — Matching por IA (RF-06 / Prompt 6)
-- Pipeline assíncrono: outbox → AI Provider → persistência → PostGIS+pgvector
-- → matches → enfileirar_notificacao_tutor (reusa Prompt 7)
-- Rode após 008_job_retencao_dados.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Extensões / config AI
-- -----------------------------------------------------------------------------

create extension if not exists vector;
create extension if not exists postgis;

insert into public.configuracoes_sistema (chave, valor)
values (
  'ai_provider',
  '{
    "active_provider": "fake",
    "embedding_space_id": "petid-embed-v1",
    "embedding_dimensions": 512,
    "score_versao": "1.0",
    "schema_version_required": "1.0",
    "require_geo_for_auto_notify": true,
    "providers": {
      "fake": { "enabled": true },
      "ollama": {
        "base_url": "http://127.0.0.1:11434",
        "vision_model": "qwen2.5vl",
        "embedding_model": "nomic-embed-text",
        "prompt_version": "petid-vision-v1"
      }
    },
    "timeouts_ms": { "vision": 60000, "embedding": 30000 },
    "max_retries": 2
  }'::jsonb
)
on conflict (chave) do nothing;

-- -----------------------------------------------------------------------------
-- 2) Animais: embedding simétrico ao resgate
-- -----------------------------------------------------------------------------

alter table public.animais
  add column if not exists embedding vector(512),
  add column if not exists analise_visual jsonb not null default '{}'::jsonb,
  add column if not exists embedding_space_id text,
  add column if not exists embedding_model_id text,
  add column if not exists ia_status text not null default 'pendente'
    check (ia_status in ('pendente', 'processando', 'concluido', 'falha', 'sem_foto')),
  add column if not exists ia_processado_em timestamptz,
  add column if not exists ia_erro text;

-- Resgates: análise tipada + metadados de espaço
alter table public.registros_resgate
  add column if not exists analise_visual jsonb not null default '{}'::jsonb,
  add column if not exists embedding_space_id text,
  add column if not exists embedding_model_id text,
  add column if not exists especie_estimada text,
  add column if not exists idade_estimada text,
  add column if not exists sexo_estimado text;

-- Matches: metadados de score + dedupe de notificação
alter table public.matches
  add column if not exists score_versao text not null default '1.0',
  add column if not exists detalhes jsonb not null default '{}'::jsonb,
  add column if not exists notificado_em timestamptz;

create index if not exists idx_matches_sugeridos_tutor
  on public.matches (created_at desc)
  where status = 'sugerido';

-- -----------------------------------------------------------------------------
-- 3) Outbox de jobs (claim atômico — Art. 3.2)
-- -----------------------------------------------------------------------------

create table if not exists public.matching_jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('resgate', 'animal', 'ocorrencia')),
  entidade_id uuid not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'processando', 'concluido', 'falha')),
  tentativas integer not null default 0,
  max_tentativas integer not null default 3,
  ultimo_erro text,
  claimed_at timestamptz,
  claimed_by text,
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo, entidade_id)
);

create index if not exists idx_matching_jobs_pendentes
  on public.matching_jobs (created_at)
  where status in ('pendente', 'falha');

alter table public.matching_jobs enable row level security;

drop policy if exists matching_jobs_admin_select on public.matching_jobs;
create policy matching_jobs_admin_select on public.matching_jobs
  for select to authenticated
  using (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 4) Enfileirar job (idempotente) + triggers pós-INSERT
-- -----------------------------------------------------------------------------

create or replace function public.enfileirar_matching_job(
  p_tipo text,
  p_entidade_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_tipo not in ('resgate', 'animal', 'ocorrencia') then
    raise exception 'tipo de job inválido: %', p_tipo;
  end if;

  insert into public.matching_jobs (tipo, entidade_id, status)
  values (p_tipo, p_entidade_id, 'pendente')
  on conflict (tipo, entidade_id) do update
    set
      status = case
        when matching_jobs.status in ('concluido', 'processando') then matching_jobs.status
        else 'pendente'
      end,
      updated_at = now(),
      ultimo_erro = case
        when matching_jobs.status in ('concluido', 'processando') then matching_jobs.ultimo_erro
        else null
      end
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.trg_enfileirar_job_resgate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.foto_url is not null and length(trim(new.foto_url)) > 0
     and new.status is distinct from 'anonimizado' then
    perform public.enfileirar_matching_job('resgate', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_resgate_matching_job on public.registros_resgate;
create trigger trg_resgate_matching_job
  after insert on public.registros_resgate
  for each row
  execute function public.trg_enfileirar_job_resgate();

create or replace function public.trg_enfileirar_job_animal_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.foto_url is not null and length(trim(new.foto_url)) > 0 then
    if tg_op = 'INSERT'
       or old.foto_url is distinct from new.foto_url then
      perform public.enfileirar_matching_job('animal', new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_animal_matching_job on public.animais;
create trigger trg_animal_matching_job
  after insert or update of foto_url on public.animais
  for each row
  execute function public.trg_enfileirar_job_animal_after();

create or replace function public.trg_enfileirar_job_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aberta' then
    perform public.enfileirar_matching_job('ocorrencia', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ocorrencia_matching_job on public.ocorrencias_perdido;
create trigger trg_ocorrencia_matching_job
  after insert on public.ocorrencias_perdido
  for each row
  execute function public.trg_enfileirar_job_ocorrencia();

-- -----------------------------------------------------------------------------
-- 5) Claim / falha / helpers
-- -----------------------------------------------------------------------------

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

create or replace function public.fail_matching_job(
  p_job_id uuid,
  p_erro text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matching_jobs
  set
    status = 'falha',
    ultimo_erro = left(coalesce(p_erro, 'erro desconhecido'), 2000),
    updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.obter_contexto_job_matching(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.matching_jobs%rowtype;
  v_ai jsonb;
  v_foto text;
  v_bucket text;
  v_path text;
begin
  select * into v_job from public.matching_jobs where id = p_job_id;
  if not found then
    raise exception 'Job não encontrado' using errcode = 'P0002';
  end if;

  select coalesce(valor, '{}'::jsonb)
  into v_ai
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  if v_job.tipo = 'resgate' then
    select r.foto_url into v_foto
    from public.registros_resgate r
    where r.id = v_job.entidade_id;
    v_bucket := 'resgates';
    v_path := v_foto;
  elsif v_job.tipo = 'animal' then
    select a.foto_url into v_foto
    from public.animais a
    where a.id = v_job.entidade_id;
    v_bucket := 'pets';
    v_path := v_foto;
  elsif v_job.tipo = 'ocorrencia' then
    select a.foto_url into v_foto
    from public.ocorrencias_perdido o
    join public.animais a on a.id = o.animal_id
    where o.id = v_job.entidade_id;
    v_bucket := 'pets';
    v_path := v_foto;
  end if;

  return jsonb_build_object(
    'job_id', v_job.id,
    'tipo', v_job.tipo,
    'entidade_id', v_job.entidade_id,
    'status', v_job.status,
    'tentativas', v_job.tentativas,
    'bucket', v_bucket,
    'foto_path', v_path,
    'tem_foto', (v_path is not null and length(trim(v_path)) > 0),
    'ai_provider', v_ai
  );
end;
$$;

-- Refs para a Edge Function gerar signed URL via Storage Admin API
create or replace function public.obter_foto_ref_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx jsonb;
begin
  v_ctx := public.obter_contexto_job_matching(p_job_id);
  return jsonb_build_object(
    'ok', coalesce((v_ctx ->> 'tem_foto')::boolean, false),
    'bucket', v_ctx ->> 'bucket',
    'path', v_ctx ->> 'foto_path',
    'expires_sec', 300
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) Normalização / projeção de PetVisualAnalysis → colunas
-- -----------------------------------------------------------------------------

create or replace function public.aplicar_analise_visual_resgate(
  p_registro_id uuid,
  p_analise jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attrs jsonb := coalesce(p_analise -> 'attributes', '{}'::jsonb);
  v_emb jsonb := coalesce(p_analise -> 'embedding', '{}'::jsonb);
  v_vec text;
  v_dims integer;
  v_expected integer;
  v_space text;
  v_cores text[];
begin
  select coalesce((valor ->> 'embedding_dimensions')::integer, 512),
         coalesce(valor ->> 'embedding_space_id', 'petid-embed-v1')
  into v_expected, v_space
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  v_dims := coalesce((v_emb ->> 'dimensions')::integer, 0);
  if v_dims is distinct from v_expected then
    raise exception 'Dimensão de embedding inválida: % (esperado %)', v_dims, v_expected
      using errcode = 'P0001';
  end if;

  if coalesce(v_emb ->> 'space_id', v_emb ->> 'space', v_space) is distinct from v_space
     and (v_emb ? 'space_id') then
    -- space string cosine vs space_id: prefer space_id se presente
    null;
  end if;

  v_space := coalesce(v_emb ->> 'space_id', v_space);

  select coalesce(array_agg(x), '{}')
  into v_cores
  from jsonb_array_elements_text(coalesce(v_attrs -> 'cores' -> 'values', '[]'::jsonb)) as t(x);

  v_vec := (
    select '[' || string_agg(value::text, ',') || ']'
    from jsonb_array_elements_text(v_emb -> 'vector') as t(value)
  );

  if v_vec is null or v_vec = '[]' then
    raise exception 'Embedding ausente na análise' using errcode = 'P0001';
  end if;

  update public.registros_resgate
  set
    analise_visual = p_analise,
    embedding = v_vec::vector(512),
    embedding_space_id = v_space,
    embedding_model_id = v_emb ->> 'model_id',
    especie_estimada = nullif(v_attrs -> 'especie' ->> 'value', ''),
    raca_estimada = nullif(v_attrs -> 'raca' ->> 'value', ''),
    porte_estimado = coalesce(
      nullif(v_attrs -> 'porte' ->> 'value', ''),
      porte_estimado
    ),
    cor_estimada = case
      when array_length(v_cores, 1) > 0 then array_to_string(v_cores, ', ')
      else cor_estimada
    end,
    idade_estimada = nullif(v_attrs -> 'idade_estimada' ->> 'value', ''),
    sexo_estimado = nullif(v_attrs -> 'sexo' ->> 'value', '')
  where id = p_registro_id
    and status is distinct from 'anonimizado';

  if not found then
    raise exception 'Resgate não encontrado ou anonimizado' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.aplicar_analise_visual_animal(
  p_animal_id uuid,
  p_analise jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attrs jsonb := coalesce(p_analise -> 'attributes', '{}'::jsonb);
  v_emb jsonb := coalesce(p_analise -> 'embedding', '{}'::jsonb);
  v_vec text;
  v_dims integer;
  v_expected integer;
  v_space text;
begin
  select coalesce((valor ->> 'embedding_dimensions')::integer, 512),
         coalesce(valor ->> 'embedding_space_id', 'petid-embed-v1')
  into v_expected, v_space
  from public.configuracoes_sistema
  where chave = 'ai_provider';

  v_dims := coalesce((v_emb ->> 'dimensions')::integer, 0);
  if v_dims is distinct from v_expected then
    raise exception 'Dimensão de embedding inválida: % (esperado %)', v_dims, v_expected
      using errcode = 'P0001';
  end if;

  v_space := coalesce(v_emb ->> 'space_id', v_space);

  v_vec := (
    select '[' || string_agg(value::text, ',') || ']'
    from jsonb_array_elements_text(v_emb -> 'vector') as t(value)
  );

  if v_vec is null or v_vec = '[]' then
    raise exception 'Embedding ausente na análise' using errcode = 'P0001';
  end if;

  update public.animais
  set
    analise_visual = p_analise,
    embedding = v_vec::vector(512),
    embedding_space_id = v_space,
    embedding_model_id = v_emb ->> 'model_id',
    ia_status = 'concluido',
    ia_processado_em = now(),
    ia_erro = null,
    -- preenche metadados só se ainda vazios
    especie = coalesce(especie, nullif(v_attrs -> 'especie' ->> 'value', '')),
    raca = coalesce(raca, nullif(v_attrs -> 'raca' ->> 'value', '')),
    porte = coalesce(porte, nullif(v_attrs -> 'porte' ->> 'value', '')),
    cor = coalesce(
      cor,
      (
        select string_agg(x, ', ')
        from jsonb_array_elements_text(
          coalesce(v_attrs -> 'cores' -> 'values', '[]'::jsonb)
        ) as t(x)
      )
    )
  where id = p_animal_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) Score de negócio (versionado) + matching
-- -----------------------------------------------------------------------------

create or replace function public.calcular_score_match_v1(
  p_sim_visual numeric,
  p_dist_metros double precision,
  p_raio_metros double precision,
  p_porte_ok boolean,
  p_especie_ok boolean,
  p_tem_geo boolean
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_visual numeric;
  v_geo numeric;
  v_meta numeric := 0;
  v_score numeric;
begin
  -- similaridade cosine típica 0..1 (já convertida)
  v_visual := greatest(0, least(1, coalesce(p_sim_visual, 0)));

  if p_tem_geo and p_dist_metros is not null and p_raio_metros > 0 then
    v_geo := greatest(0, 1 - (p_dist_metros / p_raio_metros));
  else
    v_geo := 0.35; -- neutro quando sem GPS no resgate
  end if;

  if p_especie_ok then
    v_meta := v_meta + 0.6;
  elsif p_especie_ok is false then
    v_meta := v_meta - 0.8;
  end if;

  if p_porte_ok then
    v_meta := v_meta + 0.4;
  end if;

  v_meta := greatest(0, least(1, 0.5 + v_meta * 0.25));

  -- pesos: visual 55%, geo 30%, meta 15%
  v_score := (v_visual * 55) + (v_geo * 30) + (v_meta * 15);
  return round(greatest(0, least(100, v_score)), 2);
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
  v_raio_km numeric;
  v_raio_m double precision;
  v_limiar numeric;
  v_require_geo boolean;
  v_space text;
  v_score_versao text;
  v_candidatos integer := 0;
  v_notificados integer := 0;
  v_criados integer := 0;
  r record;
  v_sim numeric;
  v_score numeric;
  v_match_id uuid;
  v_tutor_user uuid;
  v_porte_ok boolean;
  v_especie_ok boolean;
  v_tem_geo boolean;
begin
  select * into v_r from public.registros_resgate where id = p_registro_id;
  if not found then
    raise exception 'Resgate não encontrado' using errcode = 'P0002';
  end if;

  if v_r.status = 'anonimizado' or v_r.embedding is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_embedding_ou_anonimizado');
  end if;

  select
    coalesce((valor ->> 'km')::numeric, 2)
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
  v_tem_geo := v_r.localizacao is not null;
  v_space := coalesce(v_r.embedding_space_id, v_space);

  for r in
    select
      o.id as ocorrencia_id,
      o.tutor_id,
      o.localizacao as o_loc,
      a.id as animal_id,
      a.nome as animal_nome,
      a.embedding as a_emb,
      a.embedding_space_id as a_space,
      a.porte as a_porte,
      a.especie as a_especie,
      t.user_id as tutor_user_id,
      case
        when v_r.localizacao is not null then st_distance(v_r.localizacao, o.localizacao)
        else null
      end as dist_m,
      case
        when a.embedding is not null then (1 - (v_r.embedding <=> a.embedding))
        else 0
      end as sim_visual
    from public.ocorrencias_perdido o
    join public.animais a on a.id = o.animal_id
    join public.tutores t on t.id = o.tutor_id
    where o.status = 'aberta'
      and a.embedding is not null
      and coalesce(a.embedding_space_id, v_space) = v_space
      and (
        v_r.localizacao is null
        or st_dwithin(v_r.localizacao, o.localizacao, v_raio_m)
      )
  loop
    v_candidatos := v_candidatos + 1;
    v_sim := greatest(0, least(1, r.sim_visual));

    v_especie_ok := null;
    if v_r.especie_estimada is not null and r.a_especie is not null then
      v_especie_ok := lower(v_r.especie_estimada) = lower(r.a_especie)
        or (
          (lower(v_r.especie_estimada) in ('cao', 'cão', 'cachorro', 'dog'))
          and (lower(r.a_especie) in ('cao', 'cão', 'cachorro', 'dog', 'cão'))
        )
        or (
          (lower(v_r.especie_estimada) like '%gato%' or lower(v_r.especie_estimada) = 'cat')
          and (lower(r.a_especie) like '%gato%' or lower(r.a_especie) = 'cat')
        );
    end if;

    v_porte_ok := false;
    if v_r.porte_estimado is not null and r.a_porte is not null then
      v_porte_ok := lower(v_r.porte_estimado) = lower(r.a_porte);
    end if;

    v_score := public.calcular_score_match_v1(
      v_sim,
      r.dist_m,
      v_raio_m,
      v_porte_ok,
      coalesce(v_especie_ok, true) and (v_especie_ok is not false),
      v_tem_geo
    );

    -- espécie conflitante: cap score
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
      r.ocorrencia_id,
      p_registro_id,
      v_score,
      'sugerido',
      v_score_versao,
      jsonb_build_object(
        'sim_visual', v_sim,
        'dist_metros', r.dist_m,
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

    v_criados := v_criados + 1;

    -- Notificar se acima do limiar e elegível
    if v_score >= v_limiar
       and v_match_id is not null
       and exists (
         select 1 from public.matches m
         where m.id = v_match_id
           and m.status = 'sugerido'
           and m.notificado_em is null
       )
       and (not v_require_geo or v_tem_geo)
    then
      select t.user_id into v_tutor_user
      from public.tutores t
      where t.id = r.tutor_id;

      if v_tutor_user is not null then
        perform public.enfileirar_notificacao_tutor(
          v_tutor_user,
          'match_sugerido',
          jsonb_build_object(
            'match_id', v_match_id,
            'ocorrencia_id', r.ocorrencia_id,
            'registro_resgate_id', p_registro_id,
            'animal_nome', r.animal_nome,
            'score', v_score
          ),
          null
        );

        update public.matches
        set notificado_em = now()
        where id = v_match_id
          and notificado_em is null;

        v_notificados := v_notificados + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'registro_id', p_registro_id,
    'candidatos', v_candidatos,
    'upserts', v_criados,
    'notificados', v_notificados,
    'raio_km', v_raio_km,
    'limiar', v_limiar,
    'score_versao', v_score_versao
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
  v_total integer := 0;
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
    -- Garante job do animal; matching espera embedding
    perform public.enfileirar_matching_job('animal', v_animal.id);
    return jsonb_build_object('ok', false, 'motivo', 'animal_sem_embedding', 'requeued_animal', true);
  end if;

  for r in
    select rr.id
    from public.registros_resgate rr
    where rr.status in ('disponivel', 'em_analise')
      and rr.embedding is not null
      and rr.embedding_space_id is not distinct from v_animal.embedding_space_id
  loop
    v_one := public.executar_matching_para_resgate(r.id);
    -- filtrar só pares desta ocorrência seria ideal; a RPC já compara todas abertas.
    -- Aceitável no MVP (volume baixo); o UNIQUE evita duplicata.
    v_total := v_total + 1;
    v_acc := v_acc || jsonb_build_array(v_one);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'ocorrencia_id', p_ocorrencia_id,
    'resgates_processados', v_total,
    'detalhe', v_acc
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) Orchestrator RPC: conclui job após análise
-- -----------------------------------------------------------------------------

create or replace function public.concluir_job_matching_com_analise(
  p_job_id uuid,
  p_analise jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.matching_jobs%rowtype;
  v_match jsonb := '{}'::jsonb;
  v_animal_id uuid;
begin
  select * into v_job from public.matching_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job não encontrado' using errcode = 'P0002';
  end if;

  if v_job.tipo = 'ocorrencia' then
    -- Ocorrência: matching usa embedding do animal (análise visual já no job animal)
    select animal_id into v_animal_id
    from public.ocorrencias_perdido
    where id = v_job.entidade_id;

    if exists (
      select 1 from public.animais a
      where a.id = v_animal_id and a.embedding is null and a.foto_url is not null
    ) then
      perform public.enfileirar_matching_job('animal', v_animal_id);
      update public.matching_jobs
      set status = 'pendente', updated_at = now(),
          ultimo_erro = 'aguardando_embedding_animal'
      where id = p_job_id;
      return jsonb_build_object('ok', false, 'motivo', 'aguardando_embedding_animal');
    end if;

    v_match := public.executar_matching_para_ocorrencia(v_job.entidade_id);

    update public.matching_jobs
    set
      status = 'concluido',
      resultado = coalesce(v_match, '{}'::jsonb),
      updated_at = now(),
      ultimo_erro = null
    where id = p_job_id;

    return jsonb_build_object(
      'ok', true,
      'job_id', p_job_id,
      'tipo', v_job.tipo,
      'matching', v_match
    );
  end if;

  if p_analise is null or p_analise = '{}'::jsonb then
    raise exception 'Análise vazia' using errcode = 'P0001';
  end if;

  if v_job.tipo = 'resgate' then
    perform public.aplicar_analise_visual_resgate(v_job.entidade_id, p_analise);
    v_match := public.executar_matching_para_resgate(v_job.entidade_id);

  elsif v_job.tipo = 'animal' then
    perform public.aplicar_analise_visual_animal(v_job.entidade_id, p_analise);
    for v_animal_id in
      select o.id from public.ocorrencias_perdido o
      where o.animal_id = v_job.entidade_id and o.status = 'aberta'
    loop
      v_match := public.executar_matching_para_ocorrencia(v_animal_id);
    end loop;
    if v_match = '{}'::jsonb then
      v_match := jsonb_build_object('ok', true, 'motivo', 'sem_ocorrencia_aberta');
    end if;
  end if;

  update public.matching_jobs
  set
    status = 'concluido',
    resultado = coalesce(v_match, '{}'::jsonb),
    updated_at = now(),
    ultimo_erro = null
  where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'tipo', v_job.tipo,
    'matching', v_match
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9) Tutor: listar / confirmar / descartar matches
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
      and (p_status is null or m.status = p_status)
    limit 50
  ) t;

  return v_out;
end;
$$;

create or replace function public.atualizar_status_match_tutor(
  p_match_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := public.current_tutor_id();
  v_match public.matches%rowtype;
begin
  if v_tutor is null then
    raise exception 'Apenas tutores' using errcode = 'P0001';
  end if;

  if p_status not in ('confirmado_tutor', 'descartado', 'sugerido') then
    raise exception 'Status inválido' using errcode = 'P0001';
  end if;

  select m.* into v_match
  from public.matches m
  join public.ocorrencias_perdido o on o.id = m.ocorrencia_id
  where m.id = p_match_id
    and o.tutor_id = v_tutor;

  if not found then
    raise exception 'Match não encontrado' using errcode = 'P0002';
  end if;

  update public.matches
  set status = p_status
  where id = p_match_id
  returning * into v_match;

  if p_status = 'confirmado_tutor' then
    update public.ocorrencias_perdido
    set status = 'reencontrado'
    where id = v_match.ocorrencia_id
      and status = 'aberta';

    update public.registros_resgate
    set status = 'reencontrado'
    where id = v_match.registro_resgate_id
      and status in ('disponivel', 'em_analise');

    -- Descarta outros sugeridos da mesma ocorrência
    update public.matches
    set status = 'descartado'
    where ocorrencia_id = v_match.ocorrencia_id
      and id <> v_match.id
      and status = 'sugerido';
  end if;

  return jsonb_build_object(
    'ok', true,
    'match_id', v_match.id,
    'status', v_match.status
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10) Grants
-- -----------------------------------------------------------------------------

revoke all on function public.enfileirar_matching_job(text, uuid) from public, anon, authenticated;
revoke all on function public.claim_matching_job(text, text[]) from public, anon, authenticated;
revoke all on function public.fail_matching_job(uuid, text) from public, anon, authenticated;
revoke all on function public.obter_contexto_job_matching(uuid) from public, anon, authenticated;
revoke all on function public.obter_foto_ref_job(uuid) from public, anon, authenticated;
revoke all on function public.aplicar_analise_visual_resgate(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.aplicar_analise_visual_animal(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.executar_matching_para_resgate(uuid) from public, anon, authenticated;
revoke all on function public.executar_matching_para_ocorrencia(uuid) from public, anon, authenticated;
revoke all on function public.concluir_job_matching_com_analise(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.claim_matching_job(text, text[]) to service_role;
grant execute on function public.fail_matching_job(uuid, text) to service_role;
grant execute on function public.obter_contexto_job_matching(uuid) to service_role;
grant execute on function public.obter_foto_ref_job(uuid) to service_role;
grant execute on function public.concluir_job_matching_com_analise(uuid, jsonb) to service_role;
grant execute on function public.executar_matching_para_resgate(uuid) to service_role;
grant execute on function public.executar_matching_para_ocorrencia(uuid) to service_role;
grant execute on function public.aplicar_analise_visual_resgate(uuid, jsonb) to service_role;
grant execute on function public.aplicar_analise_visual_animal(uuid, jsonb) to service_role;

grant execute on function public.listar_matches_tutor(text) to authenticated;
grant execute on function public.atualizar_status_match_tutor(uuid, text) to authenticated;
