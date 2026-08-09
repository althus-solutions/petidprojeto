-- PetID — Foto de perfil do tutor
-- Path no Storage (bucket pets): {tutor_id}/perfil/foto.{ext}
-- Reaproveita RLS de storage da migration 003 (pasta 1 = tutor_id).

alter table public.tutores
  add column if not exists foto_url text;

comment on column public.tutores.foto_url is
  'Path no bucket pets da foto de perfil do tutor (ex.: {tutor_id}/perfil/foto.jpg).';
