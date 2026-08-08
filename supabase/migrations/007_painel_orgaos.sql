-- =============================================================================
-- Migration 007 — Painel de órgãos/ONGs (Prompt 8 / RF-07)
-- Alertas regionais, indicadores e gestão admin de região de atuação
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helpers geográficos e autorização por organizacao_id
-- -----------------------------------------------------------------------------

create or replace function public.membro_organizacao_aprovada(p_organizacao_id uuid)
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
    where uo.organizacao_id = p_organizacao_id
      and uo.user_id = auth.uid()
      and o.status_aprovacao = 'aprovado'
  )
  or public.is_platform_admin();
$$;

create or replace function public.organizacao_cobre_ponto_for_org(
  p_organizacao_id uuid,
  ponto geography
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizacoes o
    where o.id = p_organizacao_id
      and o.status_aprovacao = 'aprovado'
      and o.regiao_atuacao is not null
      and ponto is not null
      and st_within(ponto::geometry, o.regiao_atuacao::geometry)
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. RPC: painel da organização (indicadores + alertas recentes)
-- -----------------------------------------------------------------------------

create or replace function public.obter_painel_organizacao(
  p_organizacao_id uuid,
  p_dias integer default 30,
  p_limite_alertas integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_dias integer := greatest(coalesce(p_dias, 30), 1);
  v_limite integer := least(greatest(coalesce(p_limite_alertas, 25), 1), 100);
  v_desde timestamptz := now() - make_interval(days => v_dias);
  v_indicadores jsonb;
  v_alertas jsonb;
begin
  if not public.membro_organizacao_aprovada(p_organizacao_id) then
    raise exception 'Sem permissão para esta organização' using errcode = 'P0001';
  end if;

  select o.id, o.nome, o.tipo, o.status_aprovacao, (o.regiao_atuacao is not null) as tem_regiao
  into v_org
  from public.organizacoes o
  where o.id = p_organizacao_id;

  if not found then
    raise exception 'Organização não encontrada' using errcode = 'P0002';
  end if;

  if not v_org.tem_regiao then
    return jsonb_build_object(
      'organizacao', jsonb_build_object(
        'id', v_org.id,
        'nome', v_org.nome,
        'tipo', v_org.tipo,
        'tem_regiao_configurada', false
      ),
      'indicadores', jsonb_build_object(
        'periodo_dias', v_dias,
        'perdidos_abertos', 0,
        'perdidos_periodo', 0,
        'resgates_disponiveis', 0,
        'resgates_periodo', 0,
        'resgates_da_organizacao', 0
      ),
      'alertas', '[]'::jsonb,
      'aviso', 'Região de atuação não configurada. Solicite ao administrador da plataforma.'
    );
  end if;

  select jsonb_build_object(
    'periodo_dias', v_dias,
    'perdidos_abertos', (
      select count(*)::integer
      from public.ocorrencias_perdido o
      where o.status = 'aberta'
        and public.organizacao_cobre_ponto_for_org(p_organizacao_id, o.localizacao)
    ),
    'perdidos_periodo', (
      select count(*)::integer
      from public.ocorrencias_perdido o
      where o.created_at >= v_desde
        and public.organizacao_cobre_ponto_for_org(p_organizacao_id, o.localizacao)
    ),
    'resgates_disponiveis', (
      select count(*)::integer
      from public.registros_resgate r
      where r.status = 'disponivel'
        and (
          r.organizacao_id = p_organizacao_id
          or (
            r.organizacao_id is null
            and r.consentimento_localizacao
            and public.organizacao_cobre_ponto_for_org(p_organizacao_id, r.localizacao)
          )
        )
    ),
    'resgates_periodo', (
      select count(*)::integer
      from public.registros_resgate r
      where r.created_at >= v_desde
        and (
          r.organizacao_id = p_organizacao_id
          or (
            r.organizacao_id is null
            and r.consentimento_localizacao
            and public.organizacao_cobre_ponto_for_org(p_organizacao_id, r.localizacao)
          )
        )
    ),
    'resgates_da_organizacao', (
      select count(*)::integer
      from public.registros_resgate r
      where r.organizacao_id = p_organizacao_id
        and r.created_at >= v_desde
    )
  )
  into v_indicadores;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
  into v_alertas
  from (
    (
      select
        o.id,
        'perdido'::text as tipo,
        o.created_at,
        o.status,
        o.endereco_aproximado,
        null::text as regiao_aproximada,
        a.nome as titulo,
        a.especie,
        a.porte,
        a.cor,
        null::text as porte_estimado,
        null::text as descricao_resumo
      from public.ocorrencias_perdido o
      join public.animais a on a.id = o.animal_id
      where o.status = 'aberta'
        and public.organizacao_cobre_ponto_for_org(p_organizacao_id, o.localizacao)
    )
    union all
    (
      select
        r.id,
        'resgate'::text as tipo,
        r.created_at,
        r.status,
        null::text as endereco_aproximado,
        r.regiao_aproximada,
        case when r.organizacao_id = p_organizacao_id then 'Resgate da organização' else 'Resgate na região' end as titulo,
        null::text as especie,
        null::text as porte,
        r.cor_estimada as cor,
        r.porte_estimado,
        left(coalesce(r.descricao, ''), 120) as descricao_resumo
      from public.registros_resgate r
      where r.status in ('disponivel', 'em_analise')
        and (
          r.organizacao_id = p_organizacao_id
          or (
            r.organizacao_id is null
            and r.consentimento_localizacao
            and public.organizacao_cobre_ponto_for_org(p_organizacao_id, r.localizacao)
          )
        )
    )
    order by created_at desc
    limit v_limite
  ) t;

  return jsonb_build_object(
    'organizacao', jsonb_build_object(
      'id', v_org.id,
      'nome', v_org.nome,
      'tipo', v_org.tipo,
      'tem_regiao_configurada', v_org.tem_regiao
    ),
    'indicadores', v_indicadores,
    'alertas', v_alertas
  );
end;
$$;

grant execute on function public.obter_painel_organizacao(uuid, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Admin: listar, aprovar e definir região de atuação
-- -----------------------------------------------------------------------------

create or replace function public.listar_organizacoes_admin(
  p_status text default null
)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = 'P0001';
  end if;

  return query
  select jsonb_build_object(
    'id', o.id,
    'nome', o.nome,
    'tipo', o.tipo,
    'status_aprovacao', o.status_aprovacao,
    'tem_regiao_configurada', (o.regiao_atuacao is not null),
    'created_at', o.created_at
  )
  from public.organizacoes o
  where p_status is null or o.status_aprovacao = p_status
  order by
    case o.status_aprovacao
      when 'pendente' then 0
      when 'aprovado' then 1
      else 2
    end,
    o.created_at desc;
end;
$$;

create or replace function public.atualizar_status_organizacao(
  p_organizacao_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = 'P0001';
  end if;

  if p_status not in ('pendente', 'aprovado', 'rejeitado') then
    raise exception 'Status inválido' using errcode = 'P0001';
  end if;

  update public.organizacoes
  set status_aprovacao = p_status
  where id = p_organizacao_id;

  if not found then
    raise exception 'Organização não encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object('ok', true, 'organizacao_id', p_organizacao_id, 'status', p_status);
end;
$$;

create or replace function public.admin_definir_regiao_organizacao(
  p_organizacao_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_raio_km numeric default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raio_m numeric;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null
    or p_latitude < -90 or p_latitude > 90
    or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Coordenadas inválidas' using errcode = 'P0001';
  end if;

  v_raio_m := greatest(coalesce(p_raio_km, 10), 1) * 1000;

  update public.organizacoes
  set regiao_atuacao = st_buffer(
    st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
    v_raio_m
  )::geometry
  where id = p_organizacao_id;

  if not found then
    raise exception 'Organização não encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ok', true,
    'organizacao_id', p_organizacao_id,
    'raio_km', v_raio_m / 1000
  );
end;
$$;

grant execute on function public.listar_organizacoes_admin(text) to authenticated;
grant execute on function public.atualizar_status_organizacao(uuid, text) to authenticated;
grant execute on function public.admin_definir_regiao_organizacao(uuid, double precision, double precision, numeric) to authenticated;
