-- =============================================================================
-- PetID — Job de retenção / anonimização (Art. 6.1)
-- Prompt 9 — rode após 007_painel_orgaos.sql
--
-- Regras:
--   - Prazo vem de configuracoes_sistema.dias_retencao_sem_dono (nunca hardcoded)
--   - Anonimiza registros_resgate SEM match confirmado_tutor
--   - Agendamento pg_cron só executa se job_retencao.agendamento_ativo = true
--   - Use simular_* / dry_run no admin antes de ativar em produção
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Schema: permitir anonimização (foto_url null + consentimento coerente)
-- -----------------------------------------------------------------------------

alter table public.registros_resgate
  alter column foto_url drop not null;

-- -----------------------------------------------------------------------------
-- 2) Configuração do job (ativado só após dry-run em staging)
-- -----------------------------------------------------------------------------

insert into public.configuracoes_sistema (chave, valor)
values (
  'job_retencao',
  '{
    "agendamento_ativo": false,
    "horario_cron_utc": "0 3 * * *",
    "ultimo_dry_run_em": null,
    "ultimo_dry_run_candidatos": 0,
    "ultimo_execucao_em": null,
    "ultimo_execucao_anonimizados": 0
  }'::jsonb
)
on conflict (chave) do nothing;

insert into public.configuracoes_sistema (chave, valor)
values ('dias_retencao_sem_dono', '{"dias": 30}'::jsonb)
on conflict (chave) do nothing;

-- -----------------------------------------------------------------------------
-- 3) Auditoria das execuções
-- -----------------------------------------------------------------------------

create table if not exists public.retencao_execucoes (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('dry_run', 'aplicar')),
  disparado_por text not null check (
    disparado_por in ('manual_admin', 'pg_cron', 'n8n', 'rpc')
  ),
  disparado_por_user_id uuid references auth.users (id) on delete set null,
  dias_retencao integer not null,
  candidatos integer not null default 0,
  anonimizados integer not null default 0,
  amostra_ids uuid[] not null default '{}',
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_retencao_execucoes_created
  on public.retencao_execucoes (created_at desc);

alter table public.retencao_execucoes enable row level security;

drop policy if exists retencao_execucoes_admin_select on public.retencao_execucoes;
create policy retencao_execucoes_admin_select on public.retencao_execucoes
  for select to authenticated
  using (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 4) Critério compartilhado: elegíveis à retenção
-- -----------------------------------------------------------------------------

create or replace function public.registros_elegiveis_retencao(p_dias integer)
returns table (
  id uuid,
  status text,
  created_at timestamptz,
  tem_foto boolean,
  tem_localizacao boolean,
  tem_embedding boolean,
  organizacao_id uuid,
  registrado_por_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.status,
    r.created_at,
    (r.foto_url is not null and length(trim(r.foto_url)) > 0) as tem_foto,
    (r.localizacao is not null) as tem_localizacao,
    (r.embedding is not null) as tem_embedding,
    r.organizacao_id,
    r.registrado_por_user_id
  from public.registros_resgate r
  where r.status in ('disponivel', 'em_analise')
    and r.created_at < now() - make_interval(days => p_dias)
    and not exists (
      select 1
      from public.matches m
      where m.registro_resgate_id = r.id
        and m.status = 'confirmado_tutor'
    );
$$;

revoke all on function public.registros_elegiveis_retencao(integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5) Núcleo do job (dry_run ou aplicar)
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
      'exclui_match', 'confirmado_tutor'
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

revoke all on function public.executar_retencao_registros_sem_dono(boolean, text, uuid, integer)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6) Wrapper legado do pg_cron (respeita flag agendamento_ativo)
-- -----------------------------------------------------------------------------

create or replace function public.job_retencao_registros_sem_dono()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ativo boolean := false;
  v_result jsonb;
begin
  select coalesce((valor ->> 'agendamento_ativo')::boolean, false)
  into v_ativo
  from public.configuracoes_sistema
  where chave = 'job_retencao';

  if not coalesce(v_ativo, false) then
    raise notice 'job_retencao: agendamento_ativo=false — noop (staging/produção protegida)';
    return;
  end if;

  v_result := public.executar_retencao_registros_sem_dono(
    false,
    'pg_cron',
    null,
    25
  );

  raise notice 'job_retencao: %', v_result;
end;
$$;

revoke all on function public.job_retencao_registros_sem_dono() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7) RPCs admin — dry-run, aplicar, status, toggle
-- -----------------------------------------------------------------------------

create or replace function public.simular_retencao_admin(p_limite_amostra integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias integer;
  v_result jsonb;
  v_lista jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas admin da plataforma';
  end if;

  select (valor ->> 'dias')::integer
  into v_dias
  from public.configuracoes_sistema
  where chave = 'dias_retencao_sem_dono';

  v_result := public.executar_retencao_registros_sem_dono(
    true,
    'manual_admin',
    auth.uid(),
    coalesce(p_limite_amostra, 25)
  );

  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  into v_lista
  from (
    select *
    from public.registros_elegiveis_retencao(v_dias)
    order by created_at
    limit greatest(coalesce(p_limite_amostra, 25), 1)
  ) t;

  return v_result || jsonb_build_object('candidatos_detalhe', v_lista);
end;
$$;

create or replace function public.aplicar_retencao_admin(p_confirmacao text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas admin da plataforma';
  end if;

  if p_confirmacao is distinct from 'APLICAR_RETENCAO' then
    raise exception
      'Confirmação inválida. Envie p_confirmacao = APLICAR_RETENCAO após dry-run.';
  end if;

  return public.executar_retencao_registros_sem_dono(
    false,
    'manual_admin',
    auth.uid(),
    25
  );
end;
$$;

create or replace function public.obter_status_retencao_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias integer;
  v_cfg jsonb;
  v_candidatos integer := 0;
  v_hist jsonb;
  v_cron jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas admin da plataforma';
  end if;

  select (valor ->> 'dias')::integer
  into v_dias
  from public.configuracoes_sistema
  where chave = 'dias_retencao_sem_dono';

  select coalesce(valor, '{}'::jsonb)
  into v_cfg
  from public.configuracoes_sistema
  where chave = 'job_retencao';

  if v_dias is not null and v_dias > 0 then
    select count(*)::integer
    into v_candidatos
    from public.registros_elegiveis_retencao(v_dias);
  end if;

  select coalesce(jsonb_agg(row_to_json(h)::jsonb order by h.created_at desc), '[]'::jsonb)
  into v_hist
  from (
    select
      id,
      modo,
      disparado_por,
      dias_retencao,
      candidatos,
      anonimizados,
      created_at
    from public.retencao_execucoes
    order by created_at desc
    limit 10
  ) h;

  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'jobid', j.jobid,
          'jobname', j.jobname,
          'schedule', j.schedule,
          'command', j.command,
          'active', j.active
        )
      ),
      '[]'::jsonb
    )
    into v_cron
    from cron.job j
    where j.jobname = 'job-retencao-registros-resgate';
  exception
    when undefined_table then
      v_cron := '[]'::jsonb;
    when others then
      v_cron := jsonb_build_array(
        jsonb_build_object('erro', sqlerrm)
      );
  end;

  return jsonb_build_object(
    'dias_retencao', v_dias,
    'candidatos_atuais', v_candidatos,
    'job_retencao', v_cfg,
    'historico', v_hist,
    'cron', v_cron
  );
end;
$$;

create or replace function public.definir_agendamento_retencao_admin(p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas admin da plataforma';
  end if;

  update public.configuracoes_sistema
  set valor = valor || jsonb_build_object(
    'agendamento_ativo', coalesce(p_ativo, false),
    'atualizado_em', to_jsonb(now())
  )
  where chave = 'job_retencao'
  returning valor into v_cfg;

  if v_cfg is null then
    insert into public.configuracoes_sistema (chave, valor)
    values (
      'job_retencao',
      jsonb_build_object(
        'agendamento_ativo', coalesce(p_ativo, false),
        'horario_cron_utc', '0 3 * * *',
        'atualizado_em', now()
      )
    )
    returning valor into v_cfg;
  end if;

  return jsonb_build_object('ok', true, 'job_retencao', v_cfg);
end;
$$;

-- Invocação via service_role / n8n (sem exigir admin JWT)
create or replace function public.executar_retencao_n8n(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.executar_retencao_registros_sem_dono(
    coalesce(p_dry_run, true),
    'n8n',
    null,
    25
  );
end;
$$;

revoke all on function public.simular_retencao_admin(integer) from public, anon;
revoke all on function public.aplicar_retencao_admin(text) from public, anon;
revoke all on function public.obter_status_retencao_admin() from public, anon;
revoke all on function public.definir_agendamento_retencao_admin(boolean) from public, anon;
revoke all on function public.executar_retencao_n8n(boolean) from public, anon, authenticated;

grant execute on function public.simular_retencao_admin(integer) to authenticated;
grant execute on function public.aplicar_retencao_admin(text) to authenticated;
grant execute on function public.obter_status_retencao_admin() to authenticated;
grant execute on function public.definir_agendamento_retencao_admin(boolean) to authenticated;
grant execute on function public.executar_retencao_n8n(boolean) to service_role;

-- -----------------------------------------------------------------------------
-- 8) Reagendar pg_cron (job no-op enquanto agendamento_ativo=false)
-- -----------------------------------------------------------------------------

do $cron_setup$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'job-retencao-registros-resgate') then
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'job-retencao-registros-resgate';
    end if;

    perform cron.schedule(
      'job-retencao-registros-resgate',
      '0 3 * * *',
      'select public.job_retencao_registros_sem_dono();'
    );
  else
    raise notice 'pg_cron indisponível — use n8n workflow job_retencao_dados';
  end if;
exception
  when others then
    raise notice 'Falha ao agendar pg_cron: % — use n8n como alternativa', sqlerrm;
end;
$cron_setup$;
