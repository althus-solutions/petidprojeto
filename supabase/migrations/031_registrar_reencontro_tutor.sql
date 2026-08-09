-- PetID — Tutor registra reencontro / fecha ocorrência aberta
-- Usado na tela /tutor/ocorrencias quando o pet é encontrado.

create or replace function public.registrar_reencontro_tutor(
  p_ocorrencia_id uuid,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_o public.ocorrencias_perdido%rowtype;
  v_animal_nome text;
  v_notas text := nullif(trim(coalesce(p_notas, '')), '');
begin
  if v_tutor_id is null then
    raise exception 'Perfil de tutor não encontrado' using errcode = 'P0002';
  end if;

  if p_ocorrencia_id is null then
    raise exception 'Ocorrência inválida' using errcode = 'P0001';
  end if;

  select * into v_o
  from public.ocorrencias_perdido
  where id = p_ocorrencia_id
    and tutor_id = v_tutor_id
  for update;

  if not found then
    raise exception 'Ocorrência não encontrada' using errcode = 'P0002';
  end if;

  if v_o.status <> 'aberta' then
    raise exception 'Ocorrência já está encerrada' using errcode = 'P0001';
  end if;

  select a.nome into v_animal_nome
  from public.animais a
  where a.id = v_o.animal_id;

  update public.ocorrencias_perdido
  set
    status = 'reencontrado',
    consentimento_ocorrencia_contexto = coalesce(consentimento_ocorrencia_contexto, '{}'::jsonb)
      || jsonb_build_object(
        'reencontro',
        jsonb_build_object(
          'registrado_em', now(),
          'origem', 'tutor_ocorrencias',
          'notas', v_notas
        )
      )
  where id = v_o.id;

  -- Descarta matches sugeridos pendentes desta ocorrência
  update public.matches
  set status = 'descartado'
  where ocorrencia_id = v_o.id
    and status = 'sugerido';

  -- Encerra chats abertos deste animal com o tutor
  update public.conversas
  set
    status = 'encerrada',
    updated_at = now()
  where animal_id = v_o.animal_id
    and tutor_id = v_tutor_id
    and status = 'aberta';

  return jsonb_build_object(
    'ok', true,
    'ocorrencia_id', v_o.id,
    'animal_id', v_o.animal_id,
    'animal_nome', v_animal_nome,
    'status', 'reencontrado'
  );
end;
$$;

grant execute on function public.registrar_reencontro_tutor(uuid, text) to authenticated;

comment on function public.registrar_reencontro_tutor(uuid, text) is
  'Tutor marca ocorrência aberta como reencontrado (pet encontrado).';
