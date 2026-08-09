-- ============================================================
-- Migration 026 — Endereço privado do tutor + mapa (local encontrado)
--
-- - tutores: endereço residencial (UF/cidade/bairro + lat/lng)
--   NUNCA exposto em RPCs públicos (/pet) — só RLS self do tutor
-- - listar_ocorrencias_abertas_tutor: timestamp da última leitura GPS
-- ============================================================

alter table public.tutores
  add column if not exists endereco_estado text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_latitude double precision,
  add column if not exists endereco_longitude double precision,
  add column if not exists endereco_consentimento_em timestamptz,
  add column if not exists endereco_consentimento_contexto jsonb;

comment on column public.tutores.endereco_estado is
  'UF do endereço residencial do tutor — uso privado no app (mapa). Não compartilhar com finder.';
comment on column public.tutores.endereco_cidade is
  'Cidade do endereço residencial do tutor — privado.';
comment on column public.tutores.endereco_bairro is
  'Bairro do endereço residencial do tutor — privado.';
comment on column public.tutores.endereco_latitude is
  'Latitude aproximada do endereço do tutor — privada, só mapa autenticado.';
comment on column public.tutores.endereco_longitude is
  'Longitude aproximada do endereço do tutor — privada, só mapa autenticado.';
comment on column public.tutores.endereco_consentimento_em is
  'Quando o tutor consentiu gravar o endereço para o mapa privado.';
comment on column public.tutores.endereco_consentimento_contexto is
  'Contexto LGPD do consentimento (finalidade, tela, etc.).';

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
          'ultima_leitura_em', (
            select l.created_at
            from public.leituras_qr l
            where l.animal_id = a.id
              and l.localizacao is not null
              and l.consentimento_localizacao = true
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
  'Ocorrências abertas do tutor: coords da perda + última leitura GPS (tag) para pin piscante.';
