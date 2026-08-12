-- =============================================================================
-- Migration 040 — Cadastros do evento (feira)
-- Coleta leads de dois públicos: tutor e parceiro institucional
-- (ONG, prefeitura, clínica, petshop e outros). Sem criação de conta Auth.
-- =============================================================================

create table if not exists public.cadastros_evento (
  id uuid primary key default gen_random_uuid(),
  tipo_publico text not null check (tipo_publico in ('tutor', 'parceiro')),

  -- Contato principal (tutor = pessoa; parceiro = responsável)
  nome text not null,
  email text not null,
  telefone text not null,
  cidade text not null,
  estado text not null check (char_length(estado) = 2),

  -- Tutor
  qtd_pets int null,
  especies_pets text[] null,
  ja_conhece_mypetid boolean null,
  interesses_tutor text[] null,
  como_soube text null,

  -- Parceiro institucional
  organizacao_nome text null,
  organizacao_tipo text null check (
    organizacao_tipo is null
    or organizacao_tipo in (
      'ong',
      'prefeitura',
      'clinica_veterinaria',
      'petshop',
      'outro'
    )
  ),
  organizacao_tipo_outro text null,
  cnpj text null,
  cargo text null,
  regiao_atuacao text null,
  volume_animais_mes text null,
  interesses_parceiro text[] null,
  ja_usa_sistema boolean null,

  -- Consentimentos (LGPD)
  aceita_contato boolean not null default true,
  consentimento_lgpd_em timestamptz not null,
  consentimento_lgpd_contexto jsonb not null default '{}'::jsonb,

  -- Meta
  origem text not null default 'formulario_evento',
  user_agent text null,
  created_at timestamptz not null default now(),

  constraint cadastros_evento_tutor_chk check (
    tipo_publico <> 'tutor'
    or (
      qtd_pets is not null
      and especies_pets is not null
    )
  ),
  constraint cadastros_evento_parceiro_chk check (
    tipo_publico <> 'parceiro'
    or (
      organizacao_nome is not null
      and organizacao_tipo is not null
      and cargo is not null
    )
  )
);

create index if not exists cadastros_evento_tipo_created_idx
  on public.cadastros_evento (tipo_publico, created_at desc);
create index if not exists cadastros_evento_email_idx
  on public.cadastros_evento (lower(email));
create index if not exists cadastros_evento_estado_cidade_idx
  on public.cadastros_evento (estado, cidade);

comment on table public.cadastros_evento is
  'Leads do evento/feira: público tutor e público parceiro (ONG, prefeitura, clínica…).';

alter table public.cadastros_evento enable row level security;

-- Anon e autenticado podem inserir (formulário público)
drop policy if exists cadastros_evento_anon_insert on public.cadastros_evento;
create policy cadastros_evento_anon_insert on public.cadastros_evento
  for insert to anon, authenticated
  with check (true);

-- Leitura só admin da plataforma
drop policy if exists cadastros_evento_admin_select on public.cadastros_evento;
create policy cadastros_evento_admin_select on public.cadastros_evento
  for select to authenticated
  using (public.is_platform_admin());

-- RPC tipada para validar e inserir (security definer)
create or replace function public.registrar_cadastro_evento(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text := lower(trim(coalesce(p_dados ->> 'tipo_publico', '')));
  v_id uuid;
  v_now timestamptz := now();
  v_nome text := trim(coalesce(p_dados ->> 'nome', ''));
  v_email text := lower(trim(coalesce(p_dados ->> 'email', '')));
  v_telefone text := trim(coalesce(p_dados ->> 'telefone', ''));
  v_cidade text := trim(coalesce(p_dados ->> 'cidade', ''));
  v_estado text := upper(trim(coalesce(p_dados ->> 'estado', '')));
  v_aceita boolean := coalesce((p_dados ->> 'aceita_contato')::boolean, true);
  v_lgpd boolean := coalesce((p_dados ->> 'aceite_lgpd')::boolean, false);
begin
  if v_tipo not in ('tutor', 'parceiro') then
    raise exception 'tipo_publico inválido' using errcode = 'P0001';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Nome é obrigatório' using errcode = 'P0001';
  end if;
  if v_email !~* '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'E-mail inválido' using errcode = 'P0001';
  end if;
  if length(v_telefone) < 8 then
    raise exception 'Telefone é obrigatório' using errcode = 'P0001';
  end if;
  if length(v_cidade) < 2 or char_length(v_estado) <> 2 then
    raise exception 'Cidade e UF são obrigatórios' using errcode = 'P0001';
  end if;
  if not v_lgpd then
    raise exception 'É necessário aceitar o consentimento LGPD' using errcode = 'P0001';
  end if;

  if v_tipo = 'tutor' then
    insert into public.cadastros_evento (
      tipo_publico, nome, email, telefone, cidade, estado,
      qtd_pets, especies_pets, ja_conhece_mypetid, interesses_tutor, como_soube,
      aceita_contato, consentimento_lgpd_em, consentimento_lgpd_contexto,
      origem, user_agent
    ) values (
      'tutor', v_nome, v_email, v_telefone, v_cidade, v_estado,
      greatest(0, coalesce((p_dados ->> 'qtd_pets')::int, 0)),
      coalesce(
        (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p_dados -> 'especies_pets', '[]'::jsonb)) t(x)),
        array[]::text[]
      ),
      coalesce((p_dados ->> 'ja_conhece_mypetid')::boolean, false),
      coalesce(
        (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p_dados -> 'interesses_tutor', '[]'::jsonb)) t(x)),
        array[]::text[]
      ),
      nullif(trim(coalesce(p_dados ->> 'como_soube', '')), ''),
      v_aceita,
      v_now,
      jsonb_build_object(
        'fluxo', 'cadastro_evento_tutor',
        'versao', '1.0',
        'aceito_em', v_now
      ),
      coalesce(nullif(trim(p_dados ->> 'origem'), ''), 'formulario_evento'),
      nullif(trim(coalesce(p_dados ->> 'user_agent', '')), '')
    )
    returning id into v_id;
  else
    if length(trim(coalesce(p_dados ->> 'organizacao_nome', ''))) < 2 then
      raise exception 'Nome da organização é obrigatório' using errcode = 'P0001';
    end if;
    if coalesce(p_dados ->> 'organizacao_tipo', '') not in (
      'ong', 'prefeitura', 'clinica_veterinaria', 'petshop', 'outro'
    ) then
      raise exception 'Tipo de organização inválido' using errcode = 'P0001';
    end if;
    if length(trim(coalesce(p_dados ->> 'cargo', ''))) < 2 then
      raise exception 'Cargo é obrigatório' using errcode = 'P0001';
    end if;

    insert into public.cadastros_evento (
      tipo_publico, nome, email, telefone, cidade, estado,
      organizacao_nome, organizacao_tipo, organizacao_tipo_outro, cnpj, cargo,
      regiao_atuacao, volume_animais_mes, interesses_parceiro, ja_usa_sistema,
      aceita_contato, consentimento_lgpd_em, consentimento_lgpd_contexto,
      origem, user_agent
    ) values (
      'parceiro', v_nome, v_email, v_telefone, v_cidade, v_estado,
      trim(p_dados ->> 'organizacao_nome'),
      p_dados ->> 'organizacao_tipo',
      nullif(trim(coalesce(p_dados ->> 'organizacao_tipo_outro', '')), ''),
      nullif(trim(coalesce(p_dados ->> 'cnpj', '')), ''),
      trim(p_dados ->> 'cargo'),
      nullif(trim(coalesce(p_dados ->> 'regiao_atuacao', '')), ''),
      nullif(trim(coalesce(p_dados ->> 'volume_animais_mes', '')), ''),
      coalesce(
        (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p_dados -> 'interesses_parceiro', '[]'::jsonb)) t(x)),
        array[]::text[]
      ),
      coalesce((p_dados ->> 'ja_usa_sistema')::boolean, false),
      v_aceita,
      v_now,
      jsonb_build_object(
        'fluxo', 'cadastro_evento_parceiro',
        'versao', '1.0',
        'aceito_em', v_now
      ),
      coalesce(nullif(trim(p_dados ->> 'origem'), ''), 'formulario_evento'),
      nullif(trim(coalesce(p_dados ->> 'user_agent', '')), '')
    )
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'tipo_publico', v_tipo);
end;
$$;

grant execute on function public.registrar_cadastro_evento(jsonb) to anon, authenticated;

comment on function public.registrar_cadastro_evento(jsonb) is
  'Insere lead do evento (tutor ou parceiro) com validação e consentimento LGPD.';
