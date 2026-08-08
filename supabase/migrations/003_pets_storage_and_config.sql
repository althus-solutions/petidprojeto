-- =============================================================================
-- PetID — Storage de fotos + configuração dinâmica do formulário de pets
-- Prompt 3 — rode no SQL Editor após schema.sql e 002_auth_signup_rls.sql
-- =============================================================================

-- Seed: campos configuráveis do formulário de pet (RF-01)
insert into public.configuracoes_sistema (chave, valor)
values (
  'campos_formulario_pet',
  '{
    "campos": [
      {"nome": "nome", "label": "Nome do pet", "tipo": "text", "obrigatorio": true, "visivel": true, "ordem": 1},
      {"nome": "especie", "label": "Espécie", "tipo": "select", "opcoes": ["Cão", "Gato", "Outro"], "obrigatorio": true, "visivel": true, "ordem": 2},
      {"nome": "raca", "label": "Raça", "tipo": "text", "obrigatorio": false, "visivel": true, "ordem": 3},
      {"nome": "porte", "label": "Porte", "tipo": "select", "opcoes": ["Pequeno", "Médio", "Grande"], "obrigatorio": false, "visivel": true, "ordem": 4},
      {"nome": "cor", "label": "Cor predominante", "tipo": "text", "obrigatorio": false, "visivel": true, "ordem": 5},
      {"nome": "peso", "label": "Peso (kg)", "tipo": "number", "obrigatorio": false, "visivel": true, "ordem": 6},
      {"nome": "caracteristicas", "label": "Características distintivas", "tipo": "textarea", "obrigatorio": false, "visivel": true, "ordem": 7},
      {"nome": "foto", "label": "Foto", "tipo": "foto", "obrigatorio": false, "visivel": true, "ordem": 8}
    ]
  }'::jsonb
)
on conflict (chave) do nothing;

-- Bucket privado para fotos de pets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pets',
  'pets',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Tutor faz upload apenas na própria pasta ({tutor_id}/...)
drop policy if exists pets_tutor_insert on storage.objects;
create policy pets_tutor_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] in (
      select id::text from public.tutores where user_id = auth.uid()
    )
  );

drop policy if exists pets_tutor_select on storage.objects;
create policy pets_tutor_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] in (
      select id::text from public.tutores where user_id = auth.uid()
    )
  );

drop policy if exists pets_tutor_update on storage.objects;
create policy pets_tutor_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] in (
      select id::text from public.tutores where user_id = auth.uid()
    )
  );

drop policy if exists pets_tutor_delete on storage.objects;
create policy pets_tutor_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] in (
      select id::text from public.tutores where user_id = auth.uid()
    )
  );

-- Leitura pública limitada por QR (apenas metadados via API; foto via signed URL no fluxo RF-03)
-- Admin acessa tudo via service_role em Edge Functions futuras; no client, só tutor dono.
