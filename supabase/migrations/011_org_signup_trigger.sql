-- =============================================================================
-- PetID — Criar organização pendente ao cadastrar usuário órgão (mesmo sem sessão)
-- Corrige: signUp com confirmação de e-mail não retorna session → ensureOrgaoProfile
-- nunca rodava no client e a org não aparecia no painel admin.
-- =============================================================================

create or replace function public.provisionar_organizacao_pendente(
  p_user_id uuid,
  p_pending jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_nome text;
  v_tipo text;
begin
  if p_pending is null then
    return null;
  end if;

  v_nome := nullif(trim(p_pending->>'nome'), '');
  v_tipo := nullif(trim(p_pending->>'tipo'), '');

  if v_nome is null or v_tipo is null then
    return null;
  end if;

  if exists (
    select 1 from public.usuarios_organizacao uo where uo.user_id = p_user_id
  ) then
    select uo.organizacao_id into v_org_id
    from public.usuarios_organizacao uo
    where uo.user_id = p_user_id
    limit 1;
    return v_org_id;
  end if;

  insert into public.organizacoes (nome, tipo, status_aprovacao)
  values (v_nome, v_tipo, 'pendente')
  returning id into v_org_id;

  insert into public.usuarios_organizacao (organizacao_id, user_id, papel)
  values (v_org_id, p_user_id, 'admin_org');

  return v_org_id;
end;
$$;

create or replace function public.handle_auth_user_orgao_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', '') <> 'orgao' then
    return new;
  end if;

  perform public.provisionar_organizacao_pendente(
    new.id,
    new.raw_user_meta_data->'pending_org'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_orgao on auth.users;
create trigger on_auth_user_created_orgao
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_orgao_signup();

-- Backfill: usuários órgão já criados sem linha em organizacoes
do $$
declare
  r record;
begin
  for r in
    select u.id, u.raw_user_meta_data->'pending_org' as pending_org
    from auth.users u
    where coalesce(u.raw_user_meta_data->>'role', '') = 'orgao'
      and not exists (
        select 1 from public.usuarios_organizacao uo where uo.user_id = u.id
      )
  loop
    perform public.provisionar_organizacao_pendente(r.id, r.pending_org);
  end loop;
end;
$$;

revoke all on function public.provisionar_organizacao_pendente(uuid, jsonb) from public, anon;
grant execute on function public.provisionar_organizacao_pendente(uuid, jsonb) to service_role;
