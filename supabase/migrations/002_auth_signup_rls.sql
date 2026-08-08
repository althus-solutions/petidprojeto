-- =============================================================================
-- PetID — RLS adicional para fluxos de cadastro (Prompt 2)
-- Permite solicitação de organização (status pendente) sem service_role.
-- Rode no SQL Editor após schema.sql
-- =============================================================================

-- Solicitante pode criar organização apenas como pendente
drop policy if exists organizacoes_solicitacao_insert on public.organizacoes;
create policy organizacoes_solicitacao_insert on public.organizacoes
  for insert to authenticated
  with check (status_aprovacao = 'pendente');

-- Solicitante vê a própria organização enquanto pendente/rejeitada
drop policy if exists organizacoes_solicitante_select on public.organizacoes;
create policy organizacoes_solicitante_select on public.organizacoes
  for select to authenticated
  using (
    id in (
      select uo.organizacao_id
      from public.usuarios_organizacao uo
      where uo.user_id = auth.uid()
    )
  );

-- Usuário vincula a si mesmo como admin_org de org pendente recém-criada
drop policy if exists usuarios_org_solicitacao_insert on public.usuarios_organizacao;
create policy usuarios_org_solicitacao_insert on public.usuarios_organizacao
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and papel = 'admin_org'
    and exists (
      select 1
      from public.organizacoes o
      where o.id = organizacao_id
        and o.status_aprovacao = 'pendente'
    )
  );

-- Usuário sempre vê o próprio vínculo com organização
drop policy if exists usuarios_org_self_select on public.usuarios_organizacao;
create policy usuarios_org_self_select on public.usuarios_organizacao
  for select to authenticated
  using (user_id = auth.uid());
