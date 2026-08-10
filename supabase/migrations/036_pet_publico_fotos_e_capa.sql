-- =============================================================================
-- Migration 036 — Reforça fotos públicas no /pet + sync de capa
-- Corrige casos em que animal_fotos existe mas signed URL falha / foto_url vazia.
-- =============================================================================

-- 1) Sync capa a partir da foto ordem 1
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

-- 2) Policy Storage (idempotente) — capa + galeria
drop policy if exists pets_public_qr_select on storage.objects;
create policy pets_public_qr_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'pets'
    and (
      exists (
        select 1 from public.animais a
        where a.foto_url = name
      )
      or exists (
        select 1 from public.animal_fotos f
        where f.storage_path = name
      )
    )
  );
