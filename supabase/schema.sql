-- =============================================================================
-- PetID — Schema inicial Supabase/Postgres
-- Fonte: database.md + architecture.md + security.md
-- Uso: colar no SQL Editor do Supabase (projeto de desenvolvimento)
--
-- Ordem: extensões → tabelas → seeds → funções → índices → view → RLS → cron
-- Se uma execução anterior falhou no meio, rode o arquivo inteiro novamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SEÇÃO 1 — Extensões
-- -----------------------------------------------------------------------------
-- Habilitar também no Dashboard → Database → Extensions, se alguma falhar aqui.

create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- SEÇÃO 2 — Tabelas principais
-- -----------------------------------------------------------------------------

-- 3.1 tutores
create table if not exists public.tutores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  canal_notificacao_preferido text check (
    canal_notificacao_preferido in ('whatsapp', 'email', 'push')
  ),
  foto_url text,
  created_at timestamptz not null default now()
);

-- 3.2 animais
create table if not exists public.animais (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  nome text not null,
  especie text,
  raca text,
  porte text,
  cor text,
  peso numeric,
  caracteristicas text,
  foto_url text,
  qr_payload text not null unique,
  created_at timestamptz not null default now()
);

-- 3.3 organizacoes
create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (
    tipo in ('prefeitura', 'pm', 'bombeiros', 'ccz', 'ong', 'veterinaria')
  ),
  status_aprovacao text not null default 'pendente' check (
    status_aprovacao in ('pendente', 'aprovado', 'rejeitado')
  ),
  regiao_atuacao geography (polygon, 4326),
  created_at timestamptz not null default now()
);

-- 3.4 usuarios_organizacao
create table if not exists public.usuarios_organizacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('admin_org', 'operador')),
  unique (organizacao_id, user_id)
);

-- 3.5 ocorrencias_perdido
create table if not exists public.ocorrencias_perdido (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais (id) on delete cascade,
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  data_perda date not null,
  localizacao geography (point, 4326) not null,
  endereco_aproximado text,
  status text not null default 'aberta' check (
    status in ('aberta', 'reencontrado', 'expirada')
  ),
  retroativa boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3.6 registros_resgate
create table if not exists public.registros_resgate (
  id uuid primary key default gen_random_uuid(),
  registrado_por_user_id uuid references auth.users (id) on delete set null,
  organizacao_id uuid references public.organizacoes (id) on delete set null,
  foto_url text,
  localizacao geography (point, 4326),
  consentimento_localizacao boolean not null default false,
  descricao text,
  porte_estimado text,
  cor_estimada text,
  raca_estimada text,
  embedding vector (512),
  status text not null default 'disponivel' check (
    status in ('disponivel', 'em_analise', 'reencontrado', 'anonimizado')
  ),
  created_at timestamptz not null default now(),
  constraint registros_resgate_localizacao_consentimento check (
    (consentimento_localizacao = true and localizacao is not null)
    or (consentimento_localizacao = false and localizacao is null)
  )
);

-- 3.7 matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias_perdido (id) on delete cascade,
  registro_resgate_id uuid not null references public.registros_resgate (id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  status text not null default 'sugerido' check (
    status in ('sugerido', 'confirmado_tutor', 'descartado')
  ),
  created_at timestamptz not null default now(),
  unique (ocorrencia_id, registro_resgate_id)
);

-- 3.8 notificacoes
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_user_id uuid not null references auth.users (id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'email', 'push')),
  tipo_evento text not null,
  custo_estimado numeric,
  enviado_em timestamptz not null default now()
);

-- 3.9 configuracoes_sistema
create table if not exists public.configuracoes_sistema (
  chave text primary key,
  valor jsonb not null
);

-- -----------------------------------------------------------------------------
-- SEÇÃO 3 — Dados iniciais de configuração (não hardcoded no código)
-- -----------------------------------------------------------------------------

insert into public.configuracoes_sistema (chave, valor)
values
  ('raio_matching_km', '{"km": 2}'::jsonb),
  ('score_minimo_notificacao', '{"percentual": 75}'::jsonb),
  ('dias_retencao_sem_dono', '{"dias": 30}'::jsonb),
  (
    'job_retencao',
    '{
      "agendamento_ativo": false,
      "horario_cron_utc": "0 3 * * *"
    }'::jsonb
  )
on conflict (chave) do nothing;

-- -----------------------------------------------------------------------------
-- SEÇÃO 4 — Funções auxiliares (RLS e multi-tenant)
-- Criadas após as tabelas — funções SQL validam relações na criação.
-- -----------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

create or replace function public.current_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.tutores
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.user_organizacao_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select uo.organizacao_id
  from public.usuarios_organizacao uo
  join public.organizacoes o on o.id = uo.organizacao_id
  where uo.user_id = auth.uid()
    and o.status_aprovacao = 'aprovado';
$$;

create or replace function public.organizacao_cobre_ponto(ponto geography)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_organizacao uo
    join public.organizacoes o on o.id = uo.organizacao_id
    where uo.user_id = auth.uid()
      and o.status_aprovacao = 'aprovado'
      and o.regiao_atuacao is not null
      and ponto is not null
      and st_within(ponto::geometry, o.regiao_atuacao::geometry)
  );
$$;

create or replace function public.is_admin_org_of(p_organizacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_organizacao uo
    where uo.organizacao_id = p_organizacao_id
      and uo.user_id = auth.uid()
      and uo.papel = 'admin_org'
  );
$$;

create or replace function public.get_config_int(p_chave text, p_campo text default 'valor')
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (valor ->> p_campo)::integer
  from public.configuracoes_sistema
  where chave = p_chave;
$$;

-- -----------------------------------------------------------------------------
-- SEÇÃO 5 — Índices
-- -----------------------------------------------------------------------------

create index if not exists idx_ocorrencias_perdido_localizacao
  on public.ocorrencias_perdido using gist (localizacao);

create index if not exists idx_registros_resgate_localizacao
  on public.registros_resgate using gist (localizacao);

-- ivfflat: criar após inserir embeddings (mín. ~1000 linhas recomendado).
-- Descomente quando houver dados em registros_resgate:
-- create index if not exists idx_registros_resgate_embedding
--   on public.registros_resgate
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100);

create index if not exists idx_ocorrencias_perdido_status
  on public.ocorrencias_perdido (status);

create index if not exists idx_registros_resgate_status
  on public.registros_resgate (status);

create index if not exists idx_animais_tutor_id
  on public.animais (tutor_id);

create index if not exists idx_ocorrencias_perdido_tutor_id
  on public.ocorrencias_perdido (tutor_id);

create index if not exists idx_registros_resgate_organizacao_id
  on public.registros_resgate (organizacao_id);

create index if not exists idx_matches_ocorrencia_id
  on public.matches (ocorrencia_id);

create index if not exists idx_matches_registro_resgate_id
  on public.matches (registro_resgate_id);

create index if not exists idx_notificacoes_destinatario
  on public.notificacoes (destinatario_user_id);

-- -----------------------------------------------------------------------------
-- SEÇÃO 6 — View pública (sem localização exata)
-- -----------------------------------------------------------------------------

create or replace view public.registros_resgate_publicos
with (security_invoker = true)
as
select
  r.id,
  r.descricao,
  r.porte_estimado,
  r.cor_estimada,
  r.raca_estimada,
  r.status,
  r.created_at,
  case
    when r.consentimento_localizacao and r.localizacao is not null then
      st_astext(st_snaptogrid(r.localizacao::geometry, 0.05))
    else null
  end as regiao_aproximada
from public.registros_resgate r
where r.status = 'disponivel';

grant select on public.registros_resgate_publicos to anon, authenticated;

-- -----------------------------------------------------------------------------
-- SEÇÃO 7 — Row Level Security (RLS)
-- -----------------------------------------------------------------------------

-- 7.1 tutores
alter table public.tutores enable row level security;

create policy tutor_self_select on public.tutores
  for select to authenticated
  using (auth.uid() = user_id or public.is_platform_admin());

create policy tutor_self_insert on public.tutores
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy tutor_self_update on public.tutores
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tutor_self_delete on public.tutores
  for delete to authenticated
  using (auth.uid() = user_id or public.is_platform_admin());

-- 7.2 animais
alter table public.animais enable row level security;

create policy animais_tutor_select on public.animais
  for select to authenticated
  using (
    tutor_id = public.current_tutor_id()
    or public.is_platform_admin()
  );

create policy animais_tutor_insert on public.animais
  for insert to authenticated
  with check (tutor_id = public.current_tutor_id());

create policy animais_tutor_update on public.animais
  for update to authenticated
  using (tutor_id = public.current_tutor_id())
  with check (tutor_id = public.current_tutor_id());

create policy animais_tutor_delete on public.animais
  for delete to authenticated
  using (tutor_id = public.current_tutor_id() or public.is_platform_admin());

-- 7.3 organizacoes
alter table public.organizacoes enable row level security;

create policy organizacoes_admin_all on public.organizacoes
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy organizacoes_membro_select on public.organizacoes
  for select to authenticated
  using (
    id in (select public.user_organizacao_ids())
    or public.is_platform_admin()
  );

-- 7.4 usuarios_organizacao
alter table public.usuarios_organizacao enable row level security;

create policy usuarios_org_admin_all on public.usuarios_organizacao
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy usuarios_org_membro_select on public.usuarios_organizacao
  for select to authenticated
  using (
    organizacao_id in (select public.user_organizacao_ids())
    or public.is_platform_admin()
  );

create policy usuarios_org_admin_org_manage on public.usuarios_organizacao
  for all to authenticated
  using (public.is_admin_org_of(organizacao_id))
  with check (public.is_admin_org_of(organizacao_id));

-- 7.5 ocorrencias_perdido
alter table public.ocorrencias_perdido enable row level security;

create policy ocorrencias_tutor_select on public.ocorrencias_perdido
  for select to authenticated
  using (
    tutor_id = public.current_tutor_id()
    or public.is_platform_admin()
  );

create policy ocorrencias_org_select on public.ocorrencias_perdido
  for select to authenticated
  using (public.organizacao_cobre_ponto(localizacao));

create policy ocorrencias_tutor_insert on public.ocorrencias_perdido
  for insert to authenticated
  with check (tutor_id = public.current_tutor_id());

create policy ocorrencias_tutor_update on public.ocorrencias_perdido
  for update to authenticated
  using (tutor_id = public.current_tutor_id())
  with check (tutor_id = public.current_tutor_id());

create policy ocorrencias_tutor_delete on public.ocorrencias_perdido
  for delete to authenticated
  using (tutor_id = public.current_tutor_id() or public.is_platform_admin());

-- 7.6 registros_resgate
alter table public.registros_resgate enable row level security;

-- Inserção pública/anônima (resgate sem conta)
create policy resgate_insert_publico on public.registros_resgate
  for insert to anon, authenticated
  with check (
    registrado_por_user_id is null
    or registrado_por_user_id = auth.uid()
    or organizacao_id in (select public.user_organizacao_ids())
  );

-- Órgão vê registros da própria organização ou anônimos na sua região
create policy resgate_org_select on public.registros_resgate
  for select to authenticated
  using (
    public.is_platform_admin()
    or organizacao_id in (select public.user_organizacao_ids())
    or (
      organizacao_id is null
      and consentimento_localizacao
      and public.organizacao_cobre_ponto(localizacao)
    )
  );

-- Tutor vê resgates vinculados a matches das suas ocorrências
create policy resgate_tutor_select_via_match on public.registros_resgate
  for select to authenticated
  using (
    exists (
      select 1
      from public.matches m
      join public.ocorrencias_perdido o on o.id = m.ocorrencia_id
      where m.registro_resgate_id = registros_resgate.id
        and o.tutor_id = public.current_tutor_id()
    )
  );

create policy resgate_org_update on public.registros_resgate
  for update to authenticated
  using (
    organizacao_id in (select public.user_organizacao_ids())
    or public.is_platform_admin()
  )
  with check (
    organizacao_id in (select public.user_organizacao_ids())
    or public.is_platform_admin()
  );

-- 7.7 matches
alter table public.matches enable row level security;

create policy matches_tutor_select on public.matches
  for select to authenticated
  using (
    exists (
      select 1
      from public.ocorrencias_perdido o
      where o.id = matches.ocorrencia_id
        and o.tutor_id = public.current_tutor_id()
    )
    or public.is_platform_admin()
  );

create policy matches_org_select on public.matches
  for select to authenticated
  using (
    exists (
      select 1
      from public.ocorrencias_perdido o
      where o.id = matches.ocorrencia_id
        and public.organizacao_cobre_ponto(o.localizacao)
    )
  );

create policy matches_tutor_update on public.matches
  for update to authenticated
  using (
    exists (
      select 1
      from public.ocorrencias_perdido o
      where o.id = matches.ocorrencia_id
        and o.tutor_id = public.current_tutor_id()
    )
  )
  with check (
    exists (
      select 1
      from public.ocorrencias_perdido o
      where o.id = matches.ocorrencia_id
        and o.tutor_id = public.current_tutor_id()
    )
  );

-- Inserção/atualização automática via n8n → service_role (bypassa RLS)

-- 7.8 notificacoes
alter table public.notificacoes enable row level security;

create policy notificacoes_destinatario_select on public.notificacoes
  for select to authenticated
  using (
    destinatario_user_id = auth.uid()
    or public.is_platform_admin()
  );

-- Inserção via n8n/service_role apenas

-- 7.9 configuracoes_sistema
alter table public.configuracoes_sistema enable row level security;

create policy configuracoes_leitura_autenticada on public.configuracoes_sistema
  for select to authenticated
  using (true);

create policy configuracoes_admin_write on public.configuracoes_sistema
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Leitura anônima apenas das chaves necessárias em rotas públicas (opcional)
create policy configuracoes_leitura_anon on public.configuracoes_sistema
  for select to anon
  using (chave in ('raio_matching_km', 'score_minimo_notificacao'));

-- -----------------------------------------------------------------------------
-- SEÇÃO 8 — Job de retenção (pg_cron)
-- -----------------------------------------------------------------------------

-- Job legado (noop se job_retencao.agendamento_ativo = false).
-- Implementação completa: migration 008_job_retencao_dados.sql
create or replace function public.job_retencao_registros_sem_dono()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ativo boolean := false;
  dias integer;
begin
  select coalesce((valor ->> 'agendamento_ativo')::boolean, false)
  into v_ativo
  from public.configuracoes_sistema
  where chave = 'job_retencao';

  if not coalesce(v_ativo, false) then
    raise notice 'job_retencao: agendamento_ativo=false — noop';
    return;
  end if;

  select (valor ->> 'dias')::integer
  into dias
  from public.configuracoes_sistema
  where chave = 'dias_retencao_sem_dono';

  if dias is null or dias <= 0 then
    raise warning 'Parâmetro dias_retencao_sem_dono ausente ou inválido em configuracoes_sistema';
    return;
  end if;

  update public.registros_resgate r
  set
    foto_url = null,
    localizacao = null,
    consentimento_localizacao = false,
    embedding = null,
    descricao = null,
    porte_estimado = null,
    cor_estimada = null,
    raca_estimada = null,
    status = 'anonimizado'
  where r.status in ('disponivel', 'em_analise')
    and r.created_at < now() - make_interval(days => dias)
    and not exists (
      select 1
      from public.matches m
      where m.registro_resgate_id = r.id
        and m.status = 'confirmado_tutor'
    );
end;
$$;

-- Agenda execução diária às 03:00 UTC (requer pg_cron habilitado no projeto)
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
    raise notice 'pg_cron indisponível — agende job_retencao_registros_sem_dono() via n8n';
  end if;
exception
  when others then
    raise notice 'Falha ao agendar pg_cron: % — use n8n como alternativa', sqlerrm;
end;
$cron_setup$;

-- -----------------------------------------------------------------------------
-- SEÇÃO 9 — Grants mínimos
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================
