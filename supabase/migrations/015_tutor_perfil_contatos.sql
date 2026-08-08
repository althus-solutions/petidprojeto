-- Migration 015: contatos do tutor (múltiplos telefones + principal)
-- tutores.telefone permanece como espelho do número principal (notificações / WhatsApp).

create table if not exists public.tutor_contatos (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  telefone text not null,
  rotulo text,
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tutor_contatos_telefone_nao_vazio check (length(trim(telefone)) >= 8)
);

create index if not exists idx_tutor_contatos_tutor_id
  on public.tutor_contatos (tutor_id);

-- No máximo um principal por tutor
create unique index if not exists tutor_contatos_um_principal
  on public.tutor_contatos (tutor_id)
  where principal;

comment on table public.tutor_contatos is
  'Telefones do tutor; o marcado como principal espelha tutores.telefone e recebe notificações WhatsApp.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.tutor_contatos enable row level security;

drop policy if exists tutor_contatos_select on public.tutor_contatos;
create policy tutor_contatos_select on public.tutor_contatos
  for select to authenticated
  using (
    tutor_id = public.current_tutor_id()
    or public.is_platform_admin()
  );

drop policy if exists tutor_contatos_insert on public.tutor_contatos;
create policy tutor_contatos_insert on public.tutor_contatos
  for insert to authenticated
  with check (tutor_id = public.current_tutor_id());

drop policy if exists tutor_contatos_update on public.tutor_contatos;
create policy tutor_contatos_update on public.tutor_contatos
  for update to authenticated
  using (tutor_id = public.current_tutor_id())
  with check (tutor_id = public.current_tutor_id());

drop policy if exists tutor_contatos_delete on public.tutor_contatos;
create policy tutor_contatos_delete on public.tutor_contatos
  for delete to authenticated
  using (
    tutor_id = public.current_tutor_id()
    or public.is_platform_admin()
  );

-- -----------------------------------------------------------------------------
-- Backfill a partir de tutores.telefone
-- -----------------------------------------------------------------------------

-- Se tutores.telefone for definido sem contatos (cadastro legado/novo), cria o principal
create or replace function public.garantir_contato_de_telefone_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.telefone is null or length(trim(new.telefone)) < 8 then
    return new;
  end if;

  if exists (select 1 from public.tutor_contatos c where c.tutor_id = new.id) then
    return new;
  end if;

  insert into public.tutor_contatos (tutor_id, telefone, rotulo, principal)
  values (new.id, trim(new.telefone), 'Principal', true);

  return new;
end;
$$;

drop trigger if exists trg_tutores_garantir_contato on public.tutores;
create trigger trg_tutores_garantir_contato
  after insert or update of telefone on public.tutores
  for each row
  execute function public.garantir_contato_de_telefone_tutor();

-- Backfill tutores existentes
insert into public.tutor_contatos (tutor_id, telefone, rotulo, principal)
select
  t.id,
  trim(t.telefone),
  'Principal',
  true
from public.tutores t
where t.telefone is not null
  and length(trim(t.telefone)) >= 8
  and not exists (
    select 1 from public.tutor_contatos c where c.tutor_id = t.id
  );

-- -----------------------------------------------------------------------------
-- Sync: principal → tutores.telefone
-- -----------------------------------------------------------------------------

create or replace function public.sincronizar_telefone_principal_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_telefone text;
begin
  v_tutor_id := coalesce(new.tutor_id, old.tutor_id);

  select c.telefone
  into v_telefone
  from public.tutor_contatos c
  where c.tutor_id = v_tutor_id
    and c.principal
  limit 1;

  update public.tutores
  set telefone = v_telefone
  where id = v_tutor_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_tutor_contatos_sync_principal on public.tutor_contatos;
create trigger trg_tutor_contatos_sync_principal
  after insert or update or delete on public.tutor_contatos
  for each row
  execute function public.sincronizar_telefone_principal_tutor();

-- -----------------------------------------------------------------------------
-- RPC: salvar perfil + contatos atomicamente
-- -----------------------------------------------------------------------------

create or replace function public.salvar_perfil_tutor(
  p_nome text,
  p_canal_notificacao text,
  p_contatos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_item jsonb;
  v_telefone text;
  v_rotulo text;
  v_principal boolean;
  v_count_principal int := 0;
  v_count_total int := 0;
begin
  v_tutor_id := public.current_tutor_id();
  if v_tutor_id is null then
    raise exception 'Perfil de tutor não encontrado' using errcode = 'P0002';
  end if;

  if p_nome is null or length(trim(p_nome)) < 2 then
    raise exception 'Informe um nome válido' using errcode = 'P0001';
  end if;

  if p_canal_notificacao is null
     or p_canal_notificacao not in ('whatsapp', 'email', 'push') then
    raise exception 'Canal de notificação inválido' using errcode = 'P0001';
  end if;

  if p_contatos is null or jsonb_typeof(p_contatos) <> 'array' then
    raise exception 'Lista de contatos inválida' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_contatos)
  loop
    v_telefone := nullif(trim(coalesce(v_item ->> 'telefone', '')), '');
    v_rotulo := nullif(trim(coalesce(v_item ->> 'rotulo', '')), '');
    v_principal := coalesce((v_item ->> 'principal')::boolean, false);

    if v_telefone is null then
      continue;
    end if;

    if length(v_telefone) < 8 then
      raise exception 'Telefone inválido: %', v_telefone using errcode = 'P0001';
    end if;

    if public.normalizar_telefone_br(v_telefone) is null then
      raise exception
        'Telefone deve ser um número brasileiro válido (com DDD): %',
        v_telefone
        using errcode = 'P0001';
    end if;

    v_count_total := v_count_total + 1;
    if v_principal then
      v_count_principal := v_count_principal + 1;
    end if;
  end loop;

  if v_count_total = 0 then
    raise exception 'Informe ao menos um telefone de contato' using errcode = 'P0001';
  end if;

  if v_count_principal <> 1 then
    raise exception 'Marque exatamente um número como principal' using errcode = 'P0001';
  end if;

  update public.tutores
  set
    nome = trim(p_nome),
    canal_notificacao_preferido = p_canal_notificacao
  where id = v_tutor_id;

  delete from public.tutor_contatos where tutor_id = v_tutor_id;

  for v_item in select * from jsonb_array_elements(p_contatos)
  loop
    v_telefone := nullif(trim(coalesce(v_item ->> 'telefone', '')), '');
    v_rotulo := nullif(trim(coalesce(v_item ->> 'rotulo', '')), '');
    v_principal := coalesce((v_item ->> 'principal')::boolean, false);

    if v_telefone is null then
      continue;
    end if;

    insert into public.tutor_contatos (tutor_id, telefone, rotulo, principal)
    values (v_tutor_id, v_telefone, v_rotulo, v_principal);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'tutor_id', v_tutor_id,
    'contatos', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'telefone', c.telefone,
          'rotulo', c.rotulo,
          'principal', c.principal
        )
        order by c.principal desc, c.created_at
      ), '[]'::jsonb)
      from public.tutor_contatos c
      where c.tutor_id = v_tutor_id
    )
  );
end;
$$;

grant execute on function public.salvar_perfil_tutor(text, text, jsonb)
  to authenticated;

comment on function public.salvar_perfil_tutor(text, text, jsonb) is
  'Atualiza nome, canal preferido e lista de telefones do tutor autenticado (um principal).';
