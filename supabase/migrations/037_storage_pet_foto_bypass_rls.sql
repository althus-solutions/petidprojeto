-- =============================================================================
-- Migration 037 — Foto pública /pet: bypass RLS na checagem do Storage
--
-- Sintoma: página /pet carrega metadados (RPC security definer) mas a foto
-- fica no placeholder — createSignedUrl falha para anon.
--
-- Causa: policy pets_public_qr_select faz EXISTS em public.animais /
-- animal_fotos. Essas tabelas têm RLS só para o tutor dono; anon nunca
-- “vê” as linhas → EXISTS = false → sem SELECT no Storage → sem signed URL.
--
-- Correção: função SECURITY DEFINER que valida o path sem RLS, usada na policy.
-- =============================================================================

create or replace function public.storage_object_is_pet_foto(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    object_name is not null
    and length(trim(object_name)) > 0
    and (
      exists (
        select 1
        from public.animais a
        where a.foto_url = object_name
           or a.foto_url = ltrim(object_name, '/')
      )
      or exists (
        select 1
        from public.animal_fotos f
        where f.storage_path = object_name
           or f.storage_path = ltrim(object_name, '/')
      )
    );
$$;

revoke all on function public.storage_object_is_pet_foto(text) from public;
grant execute on function public.storage_object_is_pet_foto(text) to anon, authenticated;

comment on function public.storage_object_is_pet_foto(text) is
  'Valida path do bucket pets para signed URL pública (bypass RLS de animais/animal_fotos).';

drop policy if exists pets_public_qr_select on storage.objects;
create policy pets_public_qr_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'pets'
    and public.storage_object_is_pet_foto(name)
  );

-- Sync capa (idempotente) — ajuda pets com galeria sem foto_url
update public.animais a
set foto_url = f.storage_path
from public.animal_fotos f
where f.animal_id = a.id
  and f.ordem = 1
  and nullif(trim(f.storage_path), '') is not null
  and (
    a.foto_url is null
    or length(trim(a.foto_url)) = 0
    or a.foto_url is distinct from f.storage_path
  );
