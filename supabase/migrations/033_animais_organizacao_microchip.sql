-- =============================================================================
-- Migration 033 — Microchip + inventário de animais da organização
-- - animais.microchip (tutor)
-- - registros_resgate.microchip
-- - animais_organizacao (banco da ONG/órgão)
-- - Prefeitura (tipo=prefeitura) lê inventário de todas as orgs aprovadas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Microchip no cadastro do tutor
-- -----------------------------------------------------------------------------

alter table public.animais
  add column if not exists microchip text;

comment on column public.animais.microchip is
  'Número do microchip (ISO 11784/11785 ou nacional). Opcional; único quando preenchido.';

create unique index if not exists idx_animais_microchip_unique
  on public.animais (lower(trim(microchip)))
  where microchip is not null and length(trim(microchip)) > 0;

-- -----------------------------------------------------------------------------
-- 2) Microchip no registro de resgate
-- -----------------------------------------------------------------------------

alter table public.registros_resgate
  add column if not exists microchip text;

create index if not exists idx_registros_resgate_microchip
  on public.registros_resgate (lower(trim(microchip)))
  where microchip is not null and length(trim(microchip)) > 0;

-- -----------------------------------------------------------------------------
-- 3) Inventário institucional
-- -----------------------------------------------------------------------------

create table if not exists public.animais_organizacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  registrado_por_user_id uuid references auth.users (id) on delete set null,
  registro_resgate_id uuid references public.registros_resgate (id) on delete set null,
  nome text,
  especie text,
  raca text,
  porte text,
  cor text,
  sexo text check (sexo is null or sexo in ('macho', 'femea', 'nao_sei')),
  caracteristicas text,
  microchip text,
  foto_url text,
  status text not null default 'sob_cuidados'
    check (status in (
      'sob_cuidados',
      'disponivel_adocao',
      'devolvido',
      'transferido',
      'obito'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_animais_org_organizacao
  on public.animais_organizacao (organizacao_id, created_at desc);

create unique index if not exists idx_animais_org_microchip_unique
  on public.animais_organizacao (lower(trim(microchip)))
  where microchip is not null and length(trim(microchip)) > 0;

create index if not exists idx_animais_org_registro_resgate
  on public.animais_organizacao (registro_resgate_id)
  where registro_resgate_id is not null;

comment on table public.animais_organizacao is
  'Animais sob responsabilidade da organização (ONG, CCZ, etc.). Isolado por organizacao_id; prefeitura tem leitura global.';

alter table public.animais_organizacao enable row level security;

-- -----------------------------------------------------------------------------
-- 4) Helpers de autorização
-- -----------------------------------------------------------------------------

create or replace function public.organizacao_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select uo.organizacao_id
  from public.usuarios_organizacao uo
  join public.organizacoes o on o.id = uo.organizacao_id
  where uo.user_id = auth.uid()
    and o.status_aprovacao = 'aprovado'
  limit 1;
$$;

create or replace function public.usuario_eh_prefeitura_aprovada()
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
      and o.tipo = 'prefeitura'
  )
  or public.is_platform_admin();
$$;

revoke all on function public.organizacao_do_usuario() from public;
revoke all on function public.usuario_eh_prefeitura_aprovada() from public;
grant execute on function public.organizacao_do_usuario() to authenticated;
grant execute on function public.usuario_eh_prefeitura_aprovada() to authenticated;

-- -----------------------------------------------------------------------------
-- 5) RLS animais_organizacao
-- -----------------------------------------------------------------------------

drop policy if exists animais_org_select on public.animais_organizacao;
create policy animais_org_select on public.animais_organizacao
  for select to authenticated
  using (
    public.membro_organizacao_aprovada(organizacao_id)
    or public.usuario_eh_prefeitura_aprovada()
  );

drop policy if exists animais_org_insert on public.animais_organizacao;
create policy animais_org_insert on public.animais_organizacao
  for insert to authenticated
  with check (
    public.membro_organizacao_aprovada(organizacao_id)
    and organizacao_id = public.organizacao_do_usuario()
  );

drop policy if exists animais_org_update on public.animais_organizacao;
create policy animais_org_update on public.animais_organizacao
  for update to authenticated
  using (
    public.membro_organizacao_aprovada(organizacao_id)
    and organizacao_id = public.organizacao_do_usuario()
  )
  with check (
    public.membro_organizacao_aprovada(organizacao_id)
    and organizacao_id = public.organizacao_do_usuario()
  );

drop policy if exists animais_org_delete on public.animais_organizacao;
create policy animais_org_delete on public.animais_organizacao
  for delete to authenticated
  using (
    public.membro_organizacao_aprovada(organizacao_id)
    and organizacao_id = public.organizacao_do_usuario()
  );

-- -----------------------------------------------------------------------------
-- 6) RPC listagem (prefeitura vê todas; demais só a própria)
-- -----------------------------------------------------------------------------

create or replace function public.listar_animais_organizacao(
  p_organizacao_id uuid default null,
  p_limite integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.organizacao_do_usuario();
  v_limite integer := least(greatest(coalesce(p_limite, 100), 1), 500);
  v_eh_pref boolean := public.usuario_eh_prefeitura_aprovada();
  v_filtro uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória' using errcode = 'P0001';
  end if;

  if v_eh_pref then
    v_filtro := p_organizacao_id; -- null = todas
  else
    if v_org is null then
      raise exception 'Organização não encontrada ou pendente' using errcode = 'P0001';
    end if;
    if p_organizacao_id is not null and p_organizacao_id <> v_org then
      raise exception 'Sem permissão para outra organização' using errcode = 'P0001';
    end if;
    v_filtro := v_org;
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
      from (
        select
          a.id,
          a.organizacao_id,
          o.nome as organizacao_nome,
          o.tipo as organizacao_tipo,
          a.nome,
          a.especie,
          a.raca,
          a.porte,
          a.cor,
          a.sexo,
          a.caracteristicas,
          a.microchip,
          a.foto_url,
          a.status,
          a.registro_resgate_id,
          a.created_at,
          a.updated_at
        from public.animais_organizacao a
        join public.organizacoes o on o.id = a.organizacao_id
        where (v_filtro is null or a.organizacao_id = v_filtro)
          and o.status_aprovacao = 'aprovado'
        order by a.created_at desc
        limit v_limite
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.listar_animais_organizacao(uuid, integer) from public;
grant execute on function public.listar_animais_organizacao(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 7) RPC cadastro direto no inventário
-- -----------------------------------------------------------------------------

create or replace function public.criar_animal_organizacao(
  p_nome text default null,
  p_especie text default null,
  p_raca text default null,
  p_porte text default null,
  p_cor text default null,
  p_sexo text default null,
  p_caracteristicas text default null,
  p_microchip text default null,
  p_foto_path text default null,
  p_status text default 'sob_cuidados'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.organizacao_do_usuario();
  v_id uuid;
  v_chip text := nullif(trim(coalesce(p_microchip, '')), '');
  v_sexo text := nullif(trim(lower(coalesce(p_sexo, ''))), '');
  v_status text := coalesce(nullif(trim(p_status), ''), 'sob_cuidados');
begin
  if v_org is null then
    raise exception 'Organização não encontrada ou pendente' using errcode = 'P0001';
  end if;

  if v_sexo is not null and v_sexo not in ('macho', 'femea', 'nao_sei') then
    raise exception 'Sexo inválido' using errcode = 'P0001';
  end if;

  if v_status not in (
    'sob_cuidados', 'disponivel_adocao', 'devolvido', 'transferido', 'obito'
  ) then
    raise exception 'Status inválido' using errcode = 'P0001';
  end if;

  if v_chip is not null then
    if exists (
      select 1 from public.animais a
      where lower(trim(a.microchip)) = lower(v_chip)
    ) or exists (
      select 1 from public.animais_organizacao ao
      where lower(trim(ao.microchip)) = lower(v_chip)
    ) then
      raise exception 'Microchip já cadastrado na plataforma' using errcode = 'P0001';
    end if;
  end if;

  insert into public.animais_organizacao (
    organizacao_id,
    registrado_por_user_id,
    nome,
    especie,
    raca,
    porte,
    cor,
    sexo,
    caracteristicas,
    microchip,
    foto_url,
    status
  )
  values (
    v_org,
    auth.uid(),
    nullif(trim(coalesce(p_nome, '')), ''),
    nullif(trim(coalesce(p_especie, '')), ''),
    nullif(trim(coalesce(p_raca, '')), ''),
    nullif(trim(coalesce(p_porte, '')), ''),
    nullif(trim(coalesce(p_cor, '')), ''),
    v_sexo,
    nullif(trim(coalesce(p_caracteristicas, '')), ''),
    v_chip,
    nullif(trim(coalesce(p_foto_path, '')), ''),
    v_status
  )
  returning id into v_id;

  return (
    select jsonb_build_object(
      'id', a.id,
      'organizacao_id', a.organizacao_id,
      'nome', a.nome,
      'especie', a.especie,
      'microchip', a.microchip,
      'foto_url', a.foto_url,
      'status', a.status,
      'created_at', a.created_at
    )
    from public.animais_organizacao a
    where a.id = v_id
  );
end;
$$;

revoke all on function public.criar_animal_organizacao(
  text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.criar_animal_organizacao(
  text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 8) Resgate autenticado: microchip + espelho no inventário da org
-- -----------------------------------------------------------------------------

drop function if exists public.registrar_resgate_autenticado(
  text, text, text, text, boolean, double precision, double precision, uuid, jsonb
);

create or replace function public.registrar_resgate_autenticado(
  p_foto_path text,
  p_porte_estimado text,
  p_regiao_aproximada text,
  p_descricao text default null,
  p_consentimento_localizacao boolean default false,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_organizacao_id uuid default null,
  p_consentimento_contexto jsonb default '{}'::jsonb,
  p_microchip text default null
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
  v_chip text := nullif(trim(coalesce(p_microchip, '')), '');
  v_animal_tutor_id uuid;
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

  if v_chip is not null then
    select a.id into v_animal_tutor_id
    from public.animais a
    where lower(trim(a.microchip)) = lower(v_chip)
    limit 1;
  end if;

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
    microchip,
    status
  )
  values (
    auth.uid(),
    p_organizacao_id,
    trim(p_foto_path),
    v_localizacao,
    p_consentimento_localizacao,
    v_contexto,
    nullif(trim(coalesce(p_descricao, '')), ''),
    trim(p_porte_estimado),
    trim(p_regiao_aproximada),
    v_chip,
    'disponivel'
  )
  returning id into v_registro_id;

  -- Espelha no inventário da organização (banco próprio)
  if p_organizacao_id is not null then
    begin
      insert into public.animais_organizacao (
        organizacao_id,
        registrado_por_user_id,
        registro_resgate_id,
        nome,
        porte,
        caracteristicas,
        microchip,
        foto_url,
        status
      )
      values (
        p_organizacao_id,
        auth.uid(),
        v_registro_id,
        null,
        trim(p_porte_estimado),
        nullif(trim(coalesce(p_descricao, '')), ''),
        v_chip,
        trim(p_foto_path),
        'sob_cuidados'
      );
    exception
      when unique_violation then
        -- Microchip já no inventário: só vincula o resgate mais recente
        update public.animais_organizacao ao
        set
          registro_resgate_id = v_registro_id,
          foto_url = coalesce(ao.foto_url, trim(p_foto_path)),
          updated_at = now()
        where ao.organizacao_id = p_organizacao_id
          and v_chip is not null
          and lower(trim(ao.microchip)) = lower(v_chip);
    end;
  end if;

  return jsonb_build_object(
    'registro_id', v_registro_id,
    'microchip', v_chip,
    'animal_tutor_id_por_microchip', v_animal_tutor_id
  );
end;
$$;

revoke all on function public.registrar_resgate_autenticado(
  text, text, text, text, boolean, double precision, double precision, uuid, jsonb, text
) from public;
grant execute on function public.registrar_resgate_autenticado(
  text, text, text, text, boolean, double precision, double precision, uuid, jsonb, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 9) Seed campo microchip no formulário do tutor (merge se já existir config)
-- -----------------------------------------------------------------------------

do $$
declare
  v_valor jsonb;
  v_campos jsonb;
  v_tem boolean;
begin
  select valor into v_valor
  from public.configuracoes_sistema
  where chave = 'campos_formulario_pet';

  if v_valor is null then
    return;
  end if;

  v_campos := coalesce(v_valor->'campos', '[]'::jsonb);

  select exists (
    select 1
    from jsonb_array_elements(v_campos) c
    where c->>'nome' = 'microchip'
  ) into v_tem;

  if v_tem then
    return;
  end if;

  v_campos := v_campos || jsonb_build_array(
    jsonb_build_object(
      'nome', 'microchip',
      'label', 'Número do microchip',
      'tipo', 'text',
      'obrigatorio', false,
      'visivel', true,
      'ordem', 11.5
    )
  );

  update public.configuracoes_sistema
  set valor = jsonb_set(v_valor, '{campos}', v_campos)
  where chave = 'campos_formulario_pet';
end;
$$;
