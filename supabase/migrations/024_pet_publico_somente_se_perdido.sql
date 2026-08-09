-- PetID — Página pública /pet: fluxo de resgate só com ocorrência aberta
-- Retorna ocorrencia_aberta para a UI decidir entre "Confirmar Resgate" e "não está perdido".

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

  select coalesce(
    jsonb_agg(f.storage_path order by f.ordem),
    '[]'::jsonb
  )
  into v_foto_paths
  from public.animal_fotos f
  where f.animal_id = v_animal.id;

  if v_foto_paths = '[]'::jsonb
     and v_animal.foto_url is not null
     and length(trim(v_animal.foto_url)) > 0 then
    v_foto_paths := jsonb_build_array(v_animal.foto_url);
  end if;

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
  'Metadados públicos do pet + ocorrencia_aberta (resgate só se perdido).';
