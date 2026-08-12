import { supabase } from '@/lib/supabase'
import type { CadastroEventoInput } from '@/types/evento'

export async function registrarCadastroEvento(
  input: CadastroEventoInput,
): Promise<{ ok: boolean; id: string }> {
  const payload = {
    ...input,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    origem: 'formulario_evento',
  }

  const { data, error } = await supabase.rpc('registrar_cadastro_evento', {
    p_dados: payload,
  })

  if (error) throw error
  return data as { ok: boolean; id: string }
}

export function mapEventoError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('e-mail') || lower.includes('email')) {
    return 'Informe um e-mail válido.'
  }
  if (lower.includes('telefone')) return 'Informe um telefone / WhatsApp válido.'
  if (lower.includes('lgpd') || lower.includes('consentimento')) {
    return 'Marque o aceite da LGPD para continuar.'
  }
  if (lower.includes('organização') || lower.includes('organizacao')) {
    return 'Preencha os dados da organização.'
  }
  if (lower.includes('p0001') || lower.includes('obrigat')) {
    return message.replace(/^.*?:\s*/, '') || 'Revise os campos obrigatórios.'
  }
  if (lower.includes('registrar_cadastro_evento') || lower.includes('404')) {
    return 'Atualize o banco: aplique a migration 040_cadastros_evento.sql.'
  }
  return message || 'Não foi possível enviar. Tente novamente.'
}
