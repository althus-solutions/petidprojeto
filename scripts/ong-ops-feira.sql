-- =============================================================================
-- Ops demo ONG — cole no SQL Editor do Supabase (uma vez)
-- Org: Ong Cão Sem Dono (nathansilva9913@gmail.com)
-- =============================================================================

-- 1) Região de atuação (BH, raio 25 km) — obrigatório para o painel/relatório
update public.organizacoes
set regiao_atuacao = st_buffer(
  st_setsrid(st_makepoint(-43.9345, -19.9167), 4326)::geography,
  25000
)::geometry
where id = '8f2cb08e-179d-473f-bba3-b46126dff947';

-- 2) Fix RLS Storage resgates (upload de fotos da ONG)
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
