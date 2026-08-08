import { supabase } from '@/lib/supabase'
import type { CampoFormularioPet, ConfigCamposPet } from '@/types/pet'

const CAMPOS_PADRAO: CampoFormularioPet[] = [
  { nome: 'nome', label: 'Nome do pet', tipo: 'text', obrigatorio: true, visivel: true, ordem: 1 },
  { nome: 'especie', label: 'Espécie', tipo: 'select', opcoes: ['Cão', 'Gato', 'Outro'], obrigatorio: true, visivel: true, ordem: 2 },
  { nome: 'raca', label: 'Raça', tipo: 'text', obrigatorio: false, visivel: true, ordem: 3 },
  { nome: 'porte', label: 'Porte', tipo: 'select', opcoes: ['Pequeno', 'Médio', 'Grande'], obrigatorio: false, visivel: true, ordem: 4 },
  { nome: 'cor', label: 'Cor predominante', tipo: 'text', obrigatorio: false, visivel: true, ordem: 5 },
  { nome: 'peso', label: 'Peso (kg)', tipo: 'number', obrigatorio: false, visivel: true, ordem: 6 },
  { nome: 'caracteristicas', label: 'Características distintivas', tipo: 'textarea', obrigatorio: false, visivel: true, ordem: 7 },
  { nome: 'foto', label: 'Foto', tipo: 'foto', obrigatorio: false, visivel: true, ordem: 8 },
]

export async function fetchCamposFormularioPet(): Promise<CampoFormularioPet[]> {
  const { data, error } = await supabase
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'campos_formulario_pet')
    .maybeSingle()

  if (error) throw error

  const config = data?.valor as ConfigCamposPet | undefined
  const campos = config?.campos?.filter((c) => c.visivel !== false) ?? CAMPOS_PADRAO

  return [...campos].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
}

export async function saveCamposFormularioPet(campos: CampoFormularioPet[]) {
  const { error } = await supabase
    .from('configuracoes_sistema')
    .upsert({
      chave: 'campos_formulario_pet',
      valor: { campos },
    })

  if (error) throw error
}
