-- =============================================================================
-- PetID — Confirmar e-mail dos responsáveis ao aprovar organização
-- Supabase exige email_confirmed_at para signIn quando confirmação está ativa.
-- =============================================================================

create or replace function public.confirmar_emails_organizacao(p_organizacao_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer := 0;
begin
  update auth.users u
  set
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    updated_at = now()
  from public.usuarios_organizacao uo
  where uo.organizacao_id = p_organizacao_id
    and uo.user_id = u.id
    and u.email_confirmed_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.atualizar_status_organizacao(
  p_organizacao_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_emails_confirmados integer := 0;
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

  if p_status = 'aprovado' then
    v_emails_confirmados := public.confirmar_emails_organizacao(p_organizacao_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'organizacao_id', p_organizacao_id,
    'status', p_status,
    'emails_confirmados', v_emails_confirmados
  );
end;
$$;

-- Backfill: orgs já aprovadas com responsável sem e-mail confirmado
do $$
declare
  r record;
begin
  for r in
    select o.id
    from public.organizacoes o
    where o.status_aprovacao = 'aprovado'
  loop
    perform public.confirmar_emails_organizacao(r.id);
  end loop;
end;
$$;

revoke all on function public.confirmar_emails_organizacao(uuid) from public, anon;
grant execute on function public.confirmar_emails_organizacao(uuid) to service_role;
