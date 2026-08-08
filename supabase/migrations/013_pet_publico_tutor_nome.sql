-- =============================================================================
-- 013 — Página pública do pet (Modelo Híbrido)
-- Expor nome completo do tutor (sem telefone/e-mail/WhatsApp) em obter_pet_por_qr.
-- =============================================================================

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

  return jsonb_build_object(
    'id', v_animal.id,
    'nome', v_animal.nome,
    'especie', v_animal.especie,
    'raca', v_animal.raca,
    'porte', v_animal.porte,
    'cor', v_animal.cor,
    'caracteristicas', v_animal.caracteristicas,
    'foto_path', v_animal.foto_url,
    'tem_foto', v_animal.foto_url is not null,
    'tem_tutor', v_tutor_nome is not null,
    'tutor_nome', v_tutor_nome
  );
end;
$$;

grant execute on function public.obter_pet_por_qr(text) to anon, authenticated;

comment on function public.obter_pet_por_qr(text) is
  'Metadados públicos do pet por qr_payload: dados do animal + nome completo do tutor. Sem telefone, e-mail ou WhatsApp.';
