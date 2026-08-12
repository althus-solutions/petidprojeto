-- =============================================================================
-- Migration 041 — Reforço: foto na leitura pública NFC/QR (/pet)
--
-- Sintoma: /pet mostra dados do animal, mas a foto fica no placeholder.
-- createSignedUrl(anon) falha com "Object not found" / sem permissão.
--
-- Causa residual após 036/037:
-- 1) Policy com EXISTS em animais/animal_fotos sob RLS do tutor → anon não vê.
-- 2) SECURITY DEFINER sem `row_security = off` ainda pode falhar com FORCE RLS.
-- 3) Path no Storage vs foto_url pode divergir levemente (prefixo pets/, trim).
--
-- Correção: função SECURITY DEFINER com row_security=off + match por pasta
-- {tutor_id}/{animal_id}/* para pets com qr_payload (fluxo da tag).
-- =============================================================================

create or replace function public.storage_normalize_pet_object_name(object_name text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '/' from
      case
        when lower(trim(both '/' from coalesce(object_name, ''))) like 'pets/%'
          then substring(trim(both '/' from object_name) from 6)
        else trim(both '/' from coalesce(object_name, ''))
      end
    ),
    ''
  );
$$;

create or replace function public.storage_object_is_pet_foto(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_path text := public.storage_normalize_pet_object_name(object_name);
  v_tutor text;
  v_animal text;
begin
  if v_path is null then
    return false;
  end if;

  -- Pasta do pet com tag: {tutor_id}/{animal_id}/arquivo.ext
  v_tutor := split_part(v_path, '/', 1);
  v_animal := split_part(v_path, '/', 2);

  if v_tutor ~* '^[0-9a-f-]{36}$'
     and v_animal ~* '^[0-9a-f-]{36}$'
     and position('/' in v_path) > 0
     and exists (
       select 1
       from public.animais a
       where a.id::text = v_animal
         and a.tutor_id::text = v_tutor
         and nullif(trim(a.qr_payload), '') is not null
     ) then
    return true;
  end if;

  -- Fallback: path exato em capa / galeria (normalizado)
  return exists (
    select 1
    from public.animais a
    where public.storage_normalize_pet_object_name(a.foto_url) = v_path
  )
  or exists (
    select 1
    from public.animal_fotos f
    where public.storage_normalize_pet_object_name(f.storage_path) = v_path
  );
end;
$$;

revoke all on function public.storage_normalize_pet_object_name(text) from public;
grant execute on function public.storage_normalize_pet_object_name(text) to anon, authenticated;

revoke all on function public.storage_object_is_pet_foto(text) from public;
grant execute on function public.storage_object_is_pet_foto(text) to anon, authenticated;

comment on function public.storage_object_is_pet_foto(text) is
  'Permite signed URL anônima de fotos de pets com tag (NFC/QR). Bypass RLS + match por pasta.';

drop policy if exists pets_public_qr_select on storage.objects;
create policy pets_public_qr_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'pets'
    and public.storage_object_is_pet_foto(name)
  );

-- Sync capa (idempotente)
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
