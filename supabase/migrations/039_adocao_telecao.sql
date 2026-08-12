-- =============================================================================
-- Migration 039 — Adoção (parceria TeleCão)
-- listagens_adocao + mídia + interesses + RPC "Tenho interesse"
-- =============================================================================

-- 1) Listagens
create table if not exists public.listagens_adocao (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  animal_id uuid null references public.animais (id) on delete set null,

  -- 1. Identificação
  nome text not null,
  especie text not null check (especie in ('cao', 'gato', 'outro')),
  raca text null,
  sexo text null check (sexo in ('macho', 'femea', 'nao_sei')),
  idade_faixa text null check (idade_faixa in ('filhote', 'jovem', 'adulto', 'idoso')),
  data_nascimento_aprox date null,
  porte text null check (porte in ('pequeno', 'medio', 'grande', 'gigante')),
  peso_kg numeric(6, 2) null,
  cores text[] null,
  padrao_pelagem text null,
  castrado text null check (castrado in ('sim', 'nao', 'nao_sei')),
  vacinado text null check (vacinado in ('sim', 'nao', 'parcialmente')),
  vacinas_detalhe text null,
  vermifugado text null check (vermifugado in ('sim', 'nao')),
  vermifugo_ultima_dose date null,
  microchipado boolean null default false,
  microchip text null,

  -- 2. Saúde
  deficiencias text[] null,
  condicao_cronica text null,
  historico_doencas text null,
  medicacao_continua boolean null default false,
  medicacao_detalhe text null,
  restricoes_alimentares text null,
  mobilidade text null check (mobilidade in ('normal', 'reduzida', 'cadeirante')),

  -- 3. Temperamento
  energia text null check (energia in ('baixo', 'medio', 'alto')),
  sociavel_caes text null check (sociavel_caes in ('sim', 'nao', 'com_cautela')),
  sociavel_gatos text null check (sociavel_gatos in ('sim', 'nao', 'com_cautela')),
  sociavel_criancas text null check (sociavel_criancas in ('sim', 'nao', 'com_cautela')),
  criancas_idade_minima int null,
  convive_sozinho boolean null,
  adestramento_basico boolean null,
  comportamentos_atencao text null,
  sociabilidade_estranhos text null check (
    sociabilidade_estranhos in ('baixa', 'media', 'alta')
  ),

  -- 4. Histórico
  origem text null check (
    origem in ('rua', 'abandono', 'ninhada', 'devolucao', 'transferencia', 'outro')
  ),
  tempo_sob_cuidado text null,
  viveu_em_lar boolean null,
  motivo_retorno text null,
  observacoes_protetor text null,

  -- 5. Requisitos
  moradia_recomendada text null check (
    moradia_recomendada in ('apartamento', 'casa_quintal', 'indiferente')
  ),
  precisa_companheiro boolean null,
  aceita_criancas boolean null,
  aceita_criancas_idade_min int null,
  exige_tela_janelas boolean null,
  cidade_preferencial text null,
  regiao_preferencial text null,
  estado_preferencial text null,
  acompanhamento_pos boolean null default false,
  acompanhamento_detalhe text null,

  -- 6/7. Responsável + status
  responsavel_nome text null,
  responsavel_contato text null,
  responsavel_tipo text null check (
    responsavel_tipo in ('tutor', 'protetor', 'ong')
  ),
  status text not null default 'disponivel'
    check (status in ('disponivel', 'em_processo', 'adotado')),
  taxa_adocao_valor numeric(10, 2) null,
  taxa_adocao_aplica boolean not null default false,

  -- 8. Consentimentos
  termo_adocao_aceito_em timestamptz null,
  termo_adocao_contexto jsonb null,
  consentimento_lgpd_em timestamptz null,
  consentimento_lgpd_contexto jsonb null,
  taxa_aceite_em timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listagens_adocao_status_idx
  on public.listagens_adocao (status, created_at desc);
create index if not exists listagens_adocao_tutor_idx
  on public.listagens_adocao (tutor_id);
create index if not exists listagens_adocao_especie_idx
  on public.listagens_adocao (especie);
create index if not exists listagens_adocao_cidade_idx
  on public.listagens_adocao (cidade_preferencial);

comment on table public.listagens_adocao is
  'Anúncios de adoção (parceria TeleCão). animal_id opcional referencia pet do tutor.';

-- 2) Mídia
create table if not exists public.adocao_midia (
  id uuid primary key default gen_random_uuid(),
  listagem_id uuid not null references public.listagens_adocao (id) on delete cascade,
  storage_path text not null,
  tipo text not null default 'foto' check (tipo in ('foto', 'video')),
  ordem int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists adocao_midia_listagem_idx
  on public.adocao_midia (listagem_id, ordem);

-- 3) Interesses
create table if not exists public.interesses_adocao (
  id uuid primary key default gen_random_uuid(),
  listagem_id uuid not null references public.listagens_adocao (id) on delete cascade,
  tutor_interessado_id uuid not null references public.tutores (id) on delete cascade,
  mensagem text null,
  created_at timestamptz not null default now(),
  unique (listagem_id, tutor_interessado_id)
);

create index if not exists interesses_adocao_listagem_idx
  on public.interesses_adocao (listagem_id, created_at desc);

-- 4) updated_at
create or replace function public.trg_listagens_adocao_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_listagens_adocao_updated_at on public.listagens_adocao;
create trigger trg_listagens_adocao_updated_at
  before update on public.listagens_adocao
  for each row execute function public.trg_listagens_adocao_updated_at();

-- 5) RLS
alter table public.listagens_adocao enable row level security;
alter table public.adocao_midia enable row level security;
alter table public.interesses_adocao enable row level security;

drop policy if exists listagens_adocao_select on public.listagens_adocao;
create policy listagens_adocao_select on public.listagens_adocao
  for select to authenticated
  using (
    status in ('disponivel', 'em_processo')
    or tutor_id = public.current_tutor_id()
  );

drop policy if exists listagens_adocao_insert on public.listagens_adocao;
create policy listagens_adocao_insert on public.listagens_adocao
  for insert to authenticated
  with check (tutor_id = public.current_tutor_id());

drop policy if exists listagens_adocao_update on public.listagens_adocao;
create policy listagens_adocao_update on public.listagens_adocao
  for update to authenticated
  using (tutor_id = public.current_tutor_id())
  with check (tutor_id = public.current_tutor_id());

drop policy if exists listagens_adocao_delete on public.listagens_adocao;
create policy listagens_adocao_delete on public.listagens_adocao
  for delete to authenticated
  using (tutor_id = public.current_tutor_id());

drop policy if exists adocao_midia_select on public.adocao_midia;
create policy adocao_midia_select on public.adocao_midia
  for select to authenticated
  using (
    exists (
      select 1 from public.listagens_adocao l
      where l.id = listagem_id
        and (
          l.status in ('disponivel', 'em_processo')
          or l.tutor_id = public.current_tutor_id()
        )
    )
  );

drop policy if exists adocao_midia_insert on public.adocao_midia;
create policy adocao_midia_insert on public.adocao_midia
  for insert to authenticated
  with check (
    exists (
      select 1 from public.listagens_adocao l
      where l.id = listagem_id
        and l.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists adocao_midia_delete on public.adocao_midia;
create policy adocao_midia_delete on public.adocao_midia
  for delete to authenticated
  using (
    exists (
      select 1 from public.listagens_adocao l
      where l.id = listagem_id
        and l.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists interesses_adocao_select on public.interesses_adocao;
create policy interesses_adocao_select on public.interesses_adocao
  for select to authenticated
  using (
    tutor_interessado_id = public.current_tutor_id()
    or exists (
      select 1 from public.listagens_adocao l
      where l.id = listagem_id
        and l.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists interesses_adocao_insert on public.interesses_adocao;
create policy interesses_adocao_insert on public.interesses_adocao
  for insert to authenticated
  with check (tutor_interessado_id = public.current_tutor_id());

-- 6) Storage: leitura de mídia de adoção por tutores autenticados
create or replace function public.storage_object_is_adocao_midia(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.adocao_midia m
    where m.storage_path = object_name
       or m.storage_path = ltrim(object_name, '/')
  );
$$;

revoke all on function public.storage_object_is_adocao_midia(text) from public;
grant execute on function public.storage_object_is_adocao_midia(text) to authenticated;

drop policy if exists pets_adocao_select on storage.objects;
create policy pets_adocao_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pets'
    and public.storage_object_is_adocao_midia(name)
  );

-- 7) RPC Tenho interesse
create or replace function public.manifestar_interesse_adocao(
  p_listagem_id uuid,
  p_mensagem text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_listagem public.listagens_adocao%rowtype;
  v_interessado public.tutores%rowtype;
  v_responsavel_user_id uuid;
  v_interesse_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Tutor não autenticado' using errcode = 'P0001';
  end if;

  select * into v_listagem
  from public.listagens_adocao
  where id = p_listagem_id;

  if not found then
    raise exception 'Listagem não encontrada' using errcode = 'P0002';
  end if;

  if v_listagem.status = 'adotado' then
    raise exception 'Este animal já foi adotado' using errcode = 'P0003';
  end if;

  if v_listagem.tutor_id = v_tutor_id then
    raise exception 'Você não pode manifestar interesse na própria listagem'
      using errcode = 'P0004';
  end if;

  select * into v_interessado from public.tutores where id = v_tutor_id;

  insert into public.interesses_adocao (listagem_id, tutor_interessado_id, mensagem)
  values (p_listagem_id, v_tutor_id, nullif(trim(coalesce(p_mensagem, '')), ''))
  on conflict (listagem_id, tutor_interessado_id) do update
    set mensagem = coalesce(excluded.mensagem, interesses_adocao.mensagem)
  returning id into v_interesse_id;

  select t.user_id into v_responsavel_user_id
  from public.tutores t
  where t.id = v_listagem.tutor_id;

  if v_responsavel_user_id is not null then
    perform public.enfileirar_notificacao_tutor(
      v_responsavel_user_id,
      'interesse_adocao',
      jsonb_build_object(
        'listagem_id', v_listagem.id,
        'interesse_id', v_interesse_id,
        'animal_nome', v_listagem.nome,
        'interessado_nome', v_interessado.nome,
        'interessado_telefone', v_interessado.telefone,
        'mensagem', nullif(trim(coalesce(p_mensagem, '')), '')
      ),
      null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'interesse_id', v_interesse_id,
    'listagem_id', v_listagem.id
  );
end;
$$;

grant execute on function public.manifestar_interesse_adocao(uuid, text)
  to authenticated;

comment on function public.manifestar_interesse_adocao(uuid, text) is
  'Registra interesse em adoção e notifica o responsável (TeleCão / MyPetID).';
