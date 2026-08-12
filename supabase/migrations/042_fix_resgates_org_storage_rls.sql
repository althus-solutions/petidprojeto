-- =============================================================================
-- Migration 042 — Corrige RLS Storage bucket `resgates` para órgãos
--
-- Bug: policies usavam `select id::text from user_organizacao_ids()`,
-- mas a função retorna SETOF uuid (coluna = nome da função), não `id`.
-- Resultado: upload org/... sempre falha com RLS.
-- =============================================================================

drop policy if exists resgates_org_insert on storage.objects;
create policy resgates_org_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resgates'
    and (storage.foldername(name))[1] = 'org'
    and (storage.foldername(name))[2] in (
      select u::text from public.user_organizacao_ids() as u
    )
  );

drop policy if exists resgates_org_select on storage.objects;
create policy resgates_org_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resgates'
    and (
      (
        (storage.foldername(name))[1] = 'org'
        and (storage.foldername(name))[2] in (
          select u::text from public.user_organizacao_ids() as u
        )
      )
      or public.is_platform_admin()
    )
  );
