import { supabase } from '@/lib/supabase'
import type { MatchStatus, MatchTutor } from '@/types/match'

export async function listarMatchesTutor(
  status: MatchStatus | null = 'sugerido',
): Promise<MatchTutor[]> {
  const { data, error } = await supabase.rpc('listar_matches_tutor', {
    p_status: status,
  })
  if (error) throw error
  return (data ?? []) as MatchTutor[]
}

export async function atualizarStatusMatch(
  matchId: string,
  status: 'confirmado_tutor' | 'descartado',
): Promise<void> {
  const { error } = await supabase.rpc('atualizar_status_match_tutor', {
    p_match_id: matchId,
    p_status: status,
  })
  if (error) throw error
}

export async function signedResgateFotoUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from('resgates')
    .createSignedUrl(path, 300)
  if (error) return null
  return data.signedUrl
}
