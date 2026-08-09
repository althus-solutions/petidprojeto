-- PetID — Ocorrência: cidade + bairro (sem rua/número) para alertas de comunidade
-- Raio de matching continua interno (config/default); não é escolha do tutor na abertura.

alter table public.ocorrencias_perdido
  add column if not exists cidade text,
  add column if not exists bairro text;

comment on column public.ocorrencias_perdido.cidade is
  'Cidade onde o animal se perdeu (exibição pública / alertas de comunidade).';
comment on column public.ocorrencias_perdido.bairro is
  'Bairro onde o animal se perdeu (exibição pública / alertas). Sem rua/número.';

-- Recria RPC com cidade/bairro; raio_busca_km permanece default interno (2).
drop function if exists public.abrir_ocorrencia_perdido(
  uuid, date, double precision, double precision, text, boolean, jsonb,
  time, boolean, text, text, text, numeric, text, text, boolean
);

create or replace function public.abrir_ocorrencia_perdido(
  p_animal_id uuid,
  p_data_perda date,
  p_latitude double precision,
  p_longitude double precision,
  p_endereco_aproximado text default null,
  p_retroativa boolean default false,
  p_consentimento_contexto jsonb default '{}'::jsonb,
  p_horario_perda time default null,
  p_horario_desconhecido boolean default true,
  p_com_identificacao text default 'nao_sei',
  p_circunstancias text default null,
  p_foto_dia_path text default null,
  p_raio_busca_km numeric default 2,
  p_contato_alternativo text default null,
  p_fonte_localizacao text default 'autocomplete',
  p_consentimento_ocorrencia boolean default false,
  p_cidade text default null,
  p_bairro text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal record;
  v_tutor_id uuid;
  v_localizacao geography;
  v_ocorrencia_id uuid;
  v_aberta uuid;
  v_raio numeric;
  v_id text;
  v_fonte text;
  v_cidade text;
  v_bairro text;
  v_rotulo text;
begin
  v_tutor_id := public.current_tutor_id();
  if v_tutor_id is null then
    raise exception 'Apenas tutores autenticados podem abrir ocorrências'
      using errcode = 'P0001';
  end if;

  if coalesce(p_consentimento_ocorrencia, false) is not true then
    raise exception 'Consentimento da ocorrência é obrigatório'
      using errcode = 'P0001';
  end if;

  select id, tutor_id, nome into v_animal
  from public.animais
  where id = p_animal_id;

  if not found then
    raise exception 'Pet não encontrado' using errcode = 'P0002';
  end if;

  if v_animal.tutor_id <> v_tutor_id then
    raise exception 'Você não tem permissão para este pet' using errcode = 'P0001';
  end if;

  if p_data_perda is null then
    raise exception 'Data da perda é obrigatória' using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Localização é obrigatória para abrir a ocorrência'
      using errcode = 'P0001';
  end if;

  if p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Coordenadas fora do intervalo válido' using errcode = 'P0001';
  end if;

  v_cidade := nullif(trim(coalesce(p_cidade, '')), '');
  v_bairro := nullif(trim(coalesce(p_bairro, '')), '');

  if v_cidade is null or v_bairro is null then
    raise exception 'Informe cidade e bairro onde o animal se perdeu'
      using errcode = 'P0001';
  end if;

  -- Raio interno (matching). Tutor não escolhe na abertura; alertas de comunidade virão depois.
  v_raio := coalesce(p_raio_busca_km, 2);
  if v_raio not in (1, 2, 5, 10) then
    v_raio := 2;
  end if;

  v_id := lower(trim(coalesce(p_com_identificacao, 'nao_sei')));
  if v_id not in ('sim', 'nao', 'nao_sei') then
    raise exception 'Valor inválido para identificação (coleira/tag)'
      using errcode = 'P0001';
  end if;

  v_fonte := lower(trim(coalesce(p_fonte_localizacao, 'autocomplete')));
  if v_fonte not in ('autocomplete', 'manual', 'gps') then
    raise exception 'Fonte de localização inválida' using errcode = 'P0001';
  end if;

  v_rotulo := v_bairro || ', ' || v_cidade;
  if nullif(trim(coalesce(p_endereco_aproximado, '')), '') is not null then
    v_rotulo := trim(p_endereco_aproximado);
  end if;

  select id into v_aberta
  from public.ocorrencias_perdido
  where animal_id = p_animal_id
    and status = 'aberta'
  limit 1;

  if v_aberta is not null then
    raise exception 'Já existe uma ocorrência aberta para este pet'
      using errcode = 'P0001';
  end if;

  v_localizacao := st_setsrid(
    st_makepoint(p_longitude, p_latitude),
    4326
  )::geography;

  insert into public.ocorrencias_perdido (
    animal_id,
    tutor_id,
    data_perda,
    localizacao,
    endereco_aproximado,
    cidade,
    bairro,
    retroativa,
    status,
    horario_perda,
    horario_desconhecido,
    com_identificacao,
    circunstancias,
    foto_dia_path,
    raio_busca_km,
    contato_alternativo,
    fonte_localizacao,
    consentimento_ocorrencia_em,
    consentimento_ocorrencia_contexto
  )
  values (
    p_animal_id,
    v_tutor_id,
    p_data_perda,
    v_localizacao,
    v_rotulo,
    v_cidade,
    v_bairro,
    coalesce(p_retroativa, false),
    'aberta',
    case when coalesce(p_horario_desconhecido, true) then null else p_horario_perda end,
    coalesce(p_horario_desconhecido, true),
    v_id,
    nullif(trim(p_circunstancias), ''),
    nullif(trim(p_foto_dia_path), ''),
    v_raio,
    nullif(trim(p_contato_alternativo), ''),
    v_fonte,
    now(),
    coalesce(p_consentimento_contexto, '{}'::jsonb) || jsonb_build_object(
      'consentimento_ocorrencia', true,
      'registrado_em', now(),
      'nivel_localizacao', 'cidade_bairro'
    )
  )
  returning id into v_ocorrencia_id;

  return jsonb_build_object(
    'ocorrencia_id', v_ocorrencia_id,
    'animal_nome', v_animal.nome,
    'status', 'aberta',
    'cidade', v_cidade,
    'bairro', v_bairro,
    'raio_busca_km', v_raio
  );
end;
$$;

grant execute on function public.abrir_ocorrencia_perdido(
  uuid, date, double precision, double precision, text, boolean, jsonb,
  time, boolean, text, text, text, numeric, text, text, boolean, text, text
) to authenticated;

comment on function public.abrir_ocorrencia_perdido is
  'Abre ocorrência com cidade/bairro (sem rua). Lat/lng alimentam PostGIS; raio de matching é interno.';
