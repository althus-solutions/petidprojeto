-- MyPetID — atualiza textos de chat automáticos da marca PetID → MyPetID

create or replace function public.abrir_chat_aviso_leitura_qr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leitura_id uuid;
  v_fp text;
  v_animal_id uuid;
  v_tutor_id uuid;
  v_animal_nome text;
  v_endereco text;
  v_conversa_id uuid;
  v_corpo text;
  v_ja_existe boolean;
begin
  if new.tipo_evento is distinct from 'qr_lido'
     and new.tipo_evento is distinct from 'qr_lido_com_localizacao' then
    return new;
  end if;

  begin
    v_leitura_id := (new.payload ->> 'leitura_id')::uuid;
  exception
    when others then
      return new;
  end;

  if v_leitura_id is null then
    return new;
  end if;

  select
    l.animal_id,
    l.tutor_id,
    a.nome,
    nullif(trim(coalesce(l.endereco_texto, '')), ''),
    nullif(trim(coalesce(l.consentimento_contexto ->> 'fingerprint', '')), '')
  into
    v_animal_id,
    v_tutor_id,
    v_animal_nome,
    v_endereco,
    v_fp
  from public.leituras_qr l
  join public.animais a on a.id = l.animal_id
  where l.id = v_leitura_id;

  if v_animal_id is null or v_tutor_id is null then
    return new;
  end if;

  if v_fp is null or length(v_fp) < 8 then
    return new;
  end if;

  insert into public.conversas (animal_id, tutor_id, finder_fingerprint, leitura_id)
  values (v_animal_id, v_tutor_id, v_fp, v_leitura_id)
  on conflict (animal_id, finder_fingerprint) do update
    set
      leitura_id = coalesce(excluded.leitura_id, conversas.leitura_id),
      status = 'aberta',
      updated_at = now()
  returning id into v_conversa_id;

  select exists (
    select 1
    from public.mensagens m
    where m.conversa_id = v_conversa_id
      and m.autor = 'finder'
      and (
        m.corpo like '%tag MyPetID%'
        or m.corpo like '%tag PetID%'
      )
      and m.created_at > now() - interval '2 minutes'
  ) into v_ja_existe;

  if v_ja_existe then
    return new;
  end if;

  if new.tipo_evento = 'qr_lido_com_localizacao' then
    if v_endereco is not null then
      v_corpo := format(
        'Confirmei o resgate de %s pela tag MyPetID. Local aproximado: %s',
        v_animal_nome,
        v_endereco
      );
    else
      v_corpo := format(
        'Confirmei o resgate de %s pela tag MyPetID. Compartilhei a localização aproximada.',
        v_animal_nome
      );
    end if;
  else
    v_corpo := format(
      'Confirmei o resgate de %s pela tag MyPetID.',
      v_animal_nome
    );
  end if;

  if length(v_corpo) > 2000 then
    v_corpo := left(v_corpo, 1997) || '...';
  end if;

  insert into public.mensagens (conversa_id, autor, corpo)
  values (v_conversa_id, 'finder', v_corpo);

  return new;
end;
$$;

comment on function public.abrir_chat_aviso_leitura_qr() is
  'Após notificação de leitura QR, cria conversa + mensagem automática (marca MyPetID).';
