-- =============================================================================
-- Migration 035 — Status da tag física/digital do animal
-- Fluxo: cadastro → solicitar tag → (pagamento futuro) → gerar QR/NFC (= registrada)
-- =============================================================================

alter table public.animais
  add column if not exists tag_status text;

alter table public.animais
  alter column qr_payload drop not null;

update public.animais
set tag_status = case
  when qr_payload is not null and length(trim(qr_payload)) > 0 then 'registrada'
  else 'nao_solicitada'
end
where tag_status is null;

alter table public.animais
  alter column tag_status set default 'nao_solicitada';

alter table public.animais
  alter column tag_status set not null;

alter table public.animais drop constraint if exists animais_tag_status_check;
alter table public.animais
  add constraint animais_tag_status_check
  check (tag_status in ('nao_solicitada', 'solicitada', 'registrada'));

comment on column public.animais.tag_status is
  'nao_solicitada | solicitada (pedido; pagamento futuro) | registrada (QR/NFC gerados — coleira/tag ativa)';

-- Permite definir qr_payload na primeira geração; impede alterar/apagar depois
create or replace function public.trg_animais_qr_payload_imutavel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.qr_payload is not null
     and old.qr_payload is distinct from new.qr_payload then
    raise exception 'qr_payload é imutável: QR Code e link da tag não podem ser alterados'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
