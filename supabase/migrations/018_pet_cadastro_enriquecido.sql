-- PetID — Cadastro de pet enriquecido: multi-foto, cores[], sexo/idade/castrado/pelagem, LGPD
-- Aplicar no SQL Editor após 017.

-- -----------------------------------------------------------------------------
-- 1) Colunas novas em animais
-- -----------------------------------------------------------------------------

alter table public.animais
  add column if not exists sexo text
    check (sexo is null or sexo in ('macho', 'femea', 'nao_sei')),
  add column if not exists data_nascimento date,
  add column if not exists idade_estimada_valor numeric,
  add column if not exists idade_estimada_unidade text
    check (
      idade_estimada_unidade is null
      or idade_estimada_unidade in ('meses', 'anos')
    ),
  add column if not exists castrado text
    check (castrado is null or castrado in ('sim', 'nao', 'nao_sei')),
  add column if not exists padrao_pelagem text
    check (
      padrao_pelagem is null
      or padrao_pelagem in ('curto', 'medio', 'longo', 'enrolado', 'sem_pelo')
    ),
  add column if not exists cores text[],
  add column if not exists consentimento_fotos_em timestamptz,
  add column if not exists consentimento_fotos_contexto jsonb;

comment on column public.animais.foto_url is
  'Path da foto capa (ordem=1 em animal_fotos) no bucket pets.';
comment on column public.animais.cores is
  'Cores estruturadas (multi-select); cor text permanece espelho legível.';
comment on column public.animais.consentimento_fotos_em is
  'Timestamp do aceite LGPD para uso de fotos/características no matching.';

-- -----------------------------------------------------------------------------
-- 2) Tabela animal_fotos
-- -----------------------------------------------------------------------------

create table if not exists public.animal_fotos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animais (id) on delete cascade,
  storage_path text not null,
  slot text not null default 'outro'
    check (slot in ('corpo', 'lateral', 'rosto', 'marca', 'outro')),
  ordem smallint not null check (ordem between 1 and 4),
  embedding vector(512),
  analise_visual jsonb not null default '{}'::jsonb,
  embedding_space_id text,
  embedding_model_id text,
  ia_status text not null default 'pendente'
    check (ia_status in ('pendente', 'processando', 'concluido', 'falha', 'sem_foto')),
  ia_processado_em timestamptz,
  ia_erro text,
  created_at timestamptz not null default now(),
  unique (animal_id, ordem)
);

create index if not exists animal_fotos_animal_id_idx
  on public.animal_fotos (animal_id);

comment on table public.animal_fotos is
  'Galeria de fotos do pet (1–4). Cada uma alimenta o pipeline de embeddings.';

alter table public.animal_fotos enable row level security;

drop policy if exists animal_fotos_tutor_select on public.animal_fotos;
create policy animal_fotos_tutor_select on public.animal_fotos
  for select to authenticated
  using (
    animal_id in (
      select a.id from public.animais a
      where a.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists animal_fotos_tutor_insert on public.animal_fotos;
create policy animal_fotos_tutor_insert on public.animal_fotos
  for insert to authenticated
  with check (
    animal_id in (
      select a.id from public.animais a
      where a.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists animal_fotos_tutor_update on public.animal_fotos;
create policy animal_fotos_tutor_update on public.animal_fotos
  for update to authenticated
  using (
    animal_id in (
      select a.id from public.animais a
      where a.tutor_id = public.current_tutor_id()
    )
  )
  with check (
    animal_id in (
      select a.id from public.animais a
      where a.tutor_id = public.current_tutor_id()
    )
  );

drop policy if exists animal_fotos_tutor_delete on public.animal_fotos;
create policy animal_fotos_tutor_delete on public.animal_fotos
  for delete to authenticated
  using (
    animal_id in (
      select a.id from public.animais a
      where a.tutor_id = public.current_tutor_id()
    )
  );

-- Máx. 4 fotos por animal
create or replace function public.trg_animal_fotos_limite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.animal_fotos
  where animal_id = new.animal_id
    and (tg_op = 'INSERT' or id is distinct from new.id);

  if v_count >= 4 then
    raise exception 'Máximo de 4 fotos por animal' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_animal_fotos_limite on public.animal_fotos;
create trigger trg_animal_fotos_limite
  before insert on public.animal_fotos
  for each row
  execute function public.trg_animal_fotos_limite();

-- Sync capa (foto_url) = ordem 1
create or replace function public.sincronizar_foto_capa_animal(p_animal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  select storage_path into v_path
  from public.animal_fotos
  where animal_id = p_animal_id
  order by ordem
  limit 1;

  update public.animais
  set foto_url = v_path
  where id = p_animal_id
    and foto_url is distinct from v_path;
end;
$$;

create or replace function public.trg_animal_fotos_sync_capa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sincronizar_foto_capa_animal(old.animal_id);
    return old;
  end if;
  perform public.sincronizar_foto_capa_animal(new.animal_id);
  return new;
end;
$$;

drop trigger if exists trg_animal_fotos_sync_capa on public.animal_fotos;
create trigger trg_animal_fotos_sync_capa
  after insert or update of storage_path, ordem or delete on public.animal_fotos
  for each row
  execute function public.trg_animal_fotos_sync_capa();

-- -----------------------------------------------------------------------------
-- 3) Enfileirar matching com reprocessamento
-- -----------------------------------------------------------------------------

create or replace function public.enfileirar_matching_job_force(
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
        when matching_jobs.status = 'processando' then matching_jobs.status
        else 'pendente'
      end,
      updated_at = now(),
      ultimo_erro = case
        when matching_jobs.status = 'processando' then matching_jobs.ultimo_erro
        else null
      end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enfileirar_matching_job_force(text, uuid)
  from public, anon, authenticated;
grant execute on function public.enfileirar_matching_job_force(text, uuid)
  to service_role;

create or replace function public.trg_enfileirar_job_animal_fotos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal_id uuid;
begin
  v_animal_id := coalesce(new.animal_id, old.animal_id);
  perform public.enfileirar_matching_job_force('animal', v_animal_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_animal_fotos_matching_job on public.animal_fotos;
create trigger trg_animal_fotos_matching_job
  after insert or update of storage_path or delete on public.animal_fotos
  for each row
  execute function public.trg_enfileirar_job_animal_fotos();

-- Também reprocessa quando a capa muda
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
      perform public.enfileirar_matching_job_force('animal', new.id);
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Contexto do job com foto_paths[]
-- -----------------------------------------------------------------------------

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
  v_paths jsonb := '[]'::jsonb;
  v_animal_id uuid;
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
    if v_path is not null then
      v_paths := jsonb_build_array(
        jsonb_build_object('path', v_path, 'ordem', 1)
      );
    end if;
  elsif v_job.tipo = 'animal' then
    v_animal_id := v_job.entidade_id;
    select a.foto_url into v_foto
    from public.animais a
    where a.id = v_animal_id;
    v_bucket := 'pets';
    v_path := v_foto;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'path', f.storage_path,
          'ordem', f.ordem,
          'slot', f.slot
        )
        order by f.ordem
      ),
      '[]'::jsonb
    )
    into v_paths
    from public.animal_fotos f
    where f.animal_id = v_animal_id;

    if v_paths = '[]'::jsonb and v_path is not null then
      v_paths := jsonb_build_array(
        jsonb_build_object('path', v_path, 'ordem', 1)
      );
    end if;

    if (v_path is null or length(trim(v_path)) = 0)
       and jsonb_array_length(v_paths) > 0 then
      v_path := v_paths -> 0 ->> 'path';
    end if;
  elsif v_job.tipo = 'ocorrencia' then
    select a.id, a.foto_url into v_animal_id, v_foto
    from public.ocorrencias_perdido o
    join public.animais a on a.id = o.animal_id
    where o.id = v_job.entidade_id;
    v_bucket := 'pets';
    v_path := v_foto;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'path', f.storage_path,
          'ordem', f.ordem,
          'slot', f.slot
        )
        order by f.ordem
      ),
      '[]'::jsonb
    )
    into v_paths
    from public.animal_fotos f
    where f.animal_id = v_animal_id;

    if v_paths = '[]'::jsonb and v_path is not null then
      v_paths := jsonb_build_array(
        jsonb_build_object('path', v_path, 'ordem', 1)
      );
    end if;
  end if;

  return jsonb_build_object(
    'job_id', v_job.id,
    'tipo', v_job.tipo,
    'entidade_id', v_job.entidade_id,
    'status', v_job.status,
    'tentativas', v_job.tentativas,
    'bucket', v_bucket,
    'foto_path', v_path,
    'foto_paths', coalesce(v_paths, '[]'::jsonb),
    'tem_foto', (
      coalesce(jsonb_array_length(v_paths), 0) > 0
      or (v_path is not null and length(trim(v_path)) > 0)
    ),
    'ai_provider', v_ai
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Aplicar análise por foto + agregada
-- -----------------------------------------------------------------------------

create or replace function public.aplicar_analise_visual_animal_foto(
  p_foto_id uuid,
  p_analise jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
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

  update public.animal_fotos
  set
    analise_visual = p_analise,
    embedding = v_vec::vector(512),
    embedding_space_id = v_space,
    embedding_model_id = v_emb ->> 'model_id',
    ia_status = 'concluido',
    ia_processado_em = now(),
    ia_erro = null
  where id = p_foto_id;

  if not found then
    raise exception 'Foto não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.aplicar_analise_visual_animal_foto(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.aplicar_analise_visual_animal_foto(uuid, jsonb)
  to service_role;

-- Embedding canônico: a Edge Function calcula a média L2-normalizada
-- e chama aplicar_analise_visual_animal(animal_id, analise_agregada).

-- Backfill: pets com foto_url e sem animal_fotos
insert into public.animal_fotos (animal_id, storage_path, slot, ordem, ia_status)
select a.id, a.foto_url, 'corpo', 1, 'pendente'
from public.animais a
where a.foto_url is not null
  and length(trim(a.foto_url)) > 0
  and not exists (
    select 1 from public.animal_fotos f where f.animal_id = a.id
  );

-- -----------------------------------------------------------------------------
-- 6) Seed / upsert campos_formulario_pet
-- -----------------------------------------------------------------------------

insert into public.configuracoes_sistema (chave, valor)
values (
  'campos_formulario_pet',
  '{
    "campos": [
      {"nome": "nome", "label": "Nome do pet", "tipo": "text", "obrigatorio": true, "visivel": true, "ordem": 1},
      {"nome": "especie", "label": "Espécie", "tipo": "select", "opcoes": ["Cão", "Gato", "Outro"], "obrigatorio": true, "visivel": true, "ordem": 2},
      {"nome": "sexo", "label": "Sexo", "tipo": "select", "opcoes": ["Macho", "Fêmea", "Não sei"], "obrigatorio": true, "visivel": true, "ordem": 3},
      {"nome": "idade", "label": "Idade", "tipo": "idade", "obrigatorio": false, "visivel": true, "ordem": 4},
      {"nome": "castrado", "label": "Castrado?", "tipo": "select", "opcoes": ["Sim", "Não", "Não sei"], "obrigatorio": false, "visivel": true, "ordem": 5},
      {"nome": "raca", "label": "Raça", "tipo": "text", "obrigatorio": false, "visivel": true, "ordem": 6},
      {"nome": "porte", "label": "Porte", "tipo": "select", "opcoes": ["Pequeno", "Médio", "Grande"], "obrigatorio": false, "visivel": true, "ordem": 7},
      {"nome": "cores", "label": "Cor predominante", "tipo": "multiselect", "opcoes": ["Branco", "Preto", "Marrom", "Caramelo", "Cinza", "Dourado", "Rajado", "Malhado", "Tricolor", "Outro"], "obrigatorio": false, "visivel": true, "ordem": 8},
      {"nome": "padrao_pelagem", "label": "Padrão de pelagem", "tipo": "select", "opcoes": ["Curto", "Médio", "Longo", "Enrolado/Cacheado", "Sem pelo"], "obrigatorio": false, "visivel": true, "ordem": 9},
      {"nome": "peso", "label": "Peso (kg)", "tipo": "number", "obrigatorio": false, "visivel": true, "ordem": 10},
      {"nome": "caracteristicas", "label": "Características distintivas", "tipo": "textarea", "obrigatorio": false, "visivel": true, "ordem": 11},
      {"nome": "fotos", "label": "Fotos do pet", "tipo": "fotos", "obrigatorio": true, "visivel": true, "ordem": 12}
    ]
  }'::jsonb
)
on conflict (chave) do update
set valor = excluded.valor;
