-- PetID — Alerta na aba Ocorrências: qualquer leitura da tag
-- (com ou sem GPS) após abertura da ocorrência.

create or replace function public.listar_ocorrencias_abertas_tutor()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
begin
  v_tutor_id := public.current_tutor_id();
  if v_tutor_id is null then
    raise exception 'Perfil de tutor não encontrado' using errcode = 'P0002';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data order by row_data ->> 'created_at' desc)
      from (
        select jsonb_build_object(
          'id', o.id,
          'animal_id', a.id,
          'animal_nome', a.nome,
          'animal_especie', a.especie,
          'animal_foto_path', a.foto_url,
          'data_perda', o.data_perda,
          'endereco_aproximado', o.endereco_aproximado,
          'status', o.status,
          'retroativa', o.retroativa,
          'created_at', o.created_at,
          'latitude', st_y(o.localizacao::geometry),
          'longitude', st_x(o.localizacao::geometry),
          'localizado', exists (
            select 1
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.consentimento_localizacao = true
              and l.localizacao is not null
              and l.created_at >= o.created_at
          ),
          'ultima_leitura_lat', (
            select st_y(l.localizacao::geometry)
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          'ultima_leitura_lng', (
            select st_x(l.localizacao::geometry)
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          -- Última leitura COM GPS (pin verde)
          'ultima_leitura_em', (
            select l.created_at
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          'ultima_leitura_endereco', (
            select l.endereco_texto
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          ),
          -- Qualquer leitura (com ou sem GPS) — badge na aba Ocorrências
          'ultima_interacao_em', (
            select l.created_at
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.created_at >= o.created_at
            order by l.created_at desc
            limit 1
          )
        ) as row_data
        from public.ocorrencias_perdido o
        join public.animais a on a.id = o.animal_id
        where o.tutor_id = v_tutor_id
          and o.status = 'aberta'
      ) sub
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.listar_ocorrencias_abertas_tutor() to authenticated;

comment on function public.listar_ocorrencias_abertas_tutor() is
  'Ocorrências abertas do tutor: mapa (GPS) + ultima_interacao_em para badge na aba.';
