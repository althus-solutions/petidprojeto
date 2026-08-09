-- PetID — qr_payload imutável após o cadastro
-- Garante que edição de dados/fotos nunca altere QR Code nem link NFC.

create or replace function public.trg_animais_qr_payload_imutavel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.qr_payload is distinct from new.qr_payload then
    raise exception 'qr_payload é imutável: QR Code e link da tag não podem ser alterados'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_animais_qr_payload_imutavel on public.animais;
create trigger trg_animais_qr_payload_imutavel
  before update on public.animais
  for each row
  execute function public.trg_animais_qr_payload_imutavel();

comment on function public.trg_animais_qr_payload_imutavel() is
  'Impede alteração de animais.qr_payload — tag física (QR/NFC) permanece válida.';
