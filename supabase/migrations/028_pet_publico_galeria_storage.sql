-- ============================================================
-- Migration 028 — Galeria pública /pet: Storage + paths completos
--
-- Garante que anon consiga assinar URLs de animal_fotos (não só capa)
-- e que obter_pet_por_qr devolva todas as fotos sem duplicar a capa.
-- ============================================================

-- 1) Policy Storage: capa + todas as fotos da galeria
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

-- 2) RPC com galeria completa (dedupe capa + animal_fotos)
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
  v_ocorrencia_aberta boolean;
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

  -- Galeria: animal_fotos + capa legada se ainda não estiver na lista
  select coalesce(jsonb_agg(path order by ord), '[]'::jsonb)
  into v_foto_paths
  from (
    select f.storage_path as path, f.ordem as ord
    from public.animal_fotos f
    where f.animal_id = v_animal.id
      and nullif(trim(f.storage_path), '') is not null
    union all
    select v_animal.foto_url as path, -1 as ord
    where nullif(trim(coalesce(v_animal.foto_url, '')), '') is not null
      and not exists (
        select 1
        from public.animal_fotos f2
        where f2.animal_id = v_animal.id
          and f2.storage_path = v_animal.foto_url
      )
  ) paths;

  select exists (
    select 1
    from public.ocorrencias_perdido o
    where o.animal_id = v_animal.id
      and o.status = 'aberta'
  ) into v_ocorrencia_aberta;

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
    'tutor_nome', v_tutor_nome,
    'ocorrencia_aberta', coalesce(v_ocorrencia_aberta, false)
  );
end;
$$;

grant execute on function public.obter_pet_por_qr(text) to anon, authenticated;

comment on function public.obter_pet_por_qr(text) is
  'Metadados públicos do pet: foto_paths[] (galeria) + ocorrencia_aberta.';
