-- PetID — Página pública /pet: galeria com todas as fotos do cadastro
-- Atualiza obter_pet_por_qr + policy Storage para paths em animal_fotos.

create or replace function public.obter_pet_por_qr(p_qr_payload text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_animal record;
  v_tutor_nome text;
  v_foto_paths jsonb;
begin
  if p_qr_payload is null or length(trim(p_qr_payload)) < 8 then
    raise exception 'QR Code inválido' using errcode = 'P0001';
  end if;

  select
    a.id,
    a.nome,
    a.especie,
    a.raca,
    a.porte,
    a.cor,
    a.caracteristicas,
    a.foto_url,
    a.tutor_id
  into v_animal
  from public.animais a
  where a.qr_payload = trim(p_qr_payload);

  if not found then
    raise exception 'Pet não encontrado para este QR Code' using errcode = 'P0002';
  end if;

  select t.nome
  into v_tutor_nome
  from public.tutores t
  where t.id = v_animal.tutor_id;

  select coalesce(
    jsonb_agg(f.storage_path order by f.ordem),
    '[]'::jsonb
  )
  into v_foto_paths
  from public.animal_fotos f
  where f.animal_id = v_animal.id;

  -- Fallback legado: só capa em animais.foto_url
  if v_foto_paths = '[]'::jsonb
     and v_animal.foto_url is not null
     and length(trim(v_animal.foto_url)) > 0 then
    v_foto_paths := jsonb_build_array(v_animal.foto_url);
  end if;

  return jsonb_build_object(
    'id', v_animal.id,
    'nome', v_animal.nome,
    'especie', v_animal.especie,
    'raca', v_animal.raca,
    'porte', v_animal.porte,
    'cor', v_animal.cor,
    'caracteristicas', v_animal.caracteristicas,
    'foto_path', coalesce(v_foto_paths ->> 0, v_animal.foto_url),
    'foto_paths', v_foto_paths,
    'tem_foto', jsonb_array_length(v_foto_paths) > 0,
    'tem_tutor', v_tutor_nome is not null,
    'tutor_nome', v_tutor_nome
  );
end;
$$;

grant execute on function public.obter_pet_por_qr(text) to anon, authenticated;

comment on function public.obter_pet_por_qr(text) is
  'Metadados públicos do pet por qr_payload, incluindo foto_paths[] da galeria.';

-- Anon pode ler qualquer foto listada em animal_fotos (e capa legada)
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
