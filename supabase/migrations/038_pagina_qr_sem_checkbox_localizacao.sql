-- =============================================================================
-- Migration 038 — pagina_qr: instrução sem checkbox de localização
-- Localização fica só no modal após "Confirmar Resgate".
-- =============================================================================

update public.configuracoes_sistema
set valor = jsonb_set(
  jsonb_set(
    valor,
    '{instrucao}',
    '"Confira se é o animal certo. Aceite os termos e toque em Confirmar Resgate — em seguida pedimos a localização em um passo separado."'::jsonb,
    true
  ),
  '{titulo}',
  '"Você encontrou este pet?"'::jsonb,
  true
)
where chave = 'pagina_qr';
