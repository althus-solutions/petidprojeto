import { supabase } from '@/lib/supabase'

export interface AdminOverviewStats {
  petsCadastrados: number
  resgatesRegistrados: number
  matchesPendentes: number
  notificacoesNaFila: number
}

export async function fetchAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [pets, resgates, matches, notificacoes] = await Promise.all([
    supabase.from('animais').select('*', { count: 'exact', head: true }),
    supabase.from('registros_resgate').select('*', { count: 'exact', head: true }),
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sugerido'),
    supabase
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente'),
  ])

  if (pets.error) throw pets.error
  if (resgates.error) throw resgates.error
  if (matches.error) throw matches.error
  if (notificacoes.error) throw notificacoes.error

  return {
    petsCadastrados: pets.count ?? 0,
    resgatesRegistrados: resgates.count ?? 0,
    matchesPendentes: matches.count ?? 0,
    notificacoesNaFila: notificacoes.count ?? 0,
  }
}
