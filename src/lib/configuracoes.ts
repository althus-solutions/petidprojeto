import { supabase } from '@/lib/supabase'
import type { CampoFormularioPet, ConfigCamposPet } from '@/types/pet'
import { CORES_PADRAO } from '@/types/pet'

const CAMPOS_PADRAO: CampoFormularioPet[] = [
  {
    nome: 'nome',
    label: 'Nome do pet',
    tipo: 'text',
    obrigatorio: true,
    visivel: true,
    ordem: 1,
  },
  {
    nome: 'especie',
    label: 'Espécie',
    tipo: 'select',
    opcoes: ['Cão', 'Gato', 'Outro'],
    obrigatorio: true,
    visivel: true,
    ordem: 2,
  },
  {
    nome: 'sexo',
    label: 'Sexo',
    tipo: 'select',
    opcoes: ['Macho', 'Fêmea', 'Não sei'],
    obrigatorio: true,
    visivel: true,
    ordem: 3,
  },
  {
    nome: 'idade',
    label: 'Idade',
    tipo: 'idade',
    obrigatorio: false,
    visivel: true,
    ordem: 4,
  },
  {
    nome: 'castrado',
    label: 'Castrado?',
    tipo: 'select',
    opcoes: ['Sim', 'Não', 'Não sei'],
    obrigatorio: false,
    visivel: true,
    ordem: 5,
  },
  {
    nome: 'raca',
    label: 'Raça',
    tipo: 'text',
    obrigatorio: false,
    visivel: true,
    ordem: 6,
  },
  {
    nome: 'porte',
    label: 'Porte',
    tipo: 'select',
    opcoes: ['Pequeno', 'Médio', 'Grande'],
    obrigatorio: false,
    visivel: true,
    ordem: 7,
  },
  {
    nome: 'cores',
    label: 'Cor predominante',
    tipo: 'multiselect',
    opcoes: [...CORES_PADRAO],
    obrigatorio: false,
    visivel: true,
    ordem: 8,
  },
  {
    nome: 'padrao_pelagem',
    label: 'Padrão de pelagem',
    tipo: 'select',
    opcoes: ['Curto', 'Médio', 'Longo', 'Enrolado/Cacheado', 'Sem pelo'],
    obrigatorio: false,
    visivel: true,
    ordem: 9,
  },
  {
    nome: 'peso',
    label: 'Peso (kg)',
    tipo: 'number',
    obrigatorio: false,
    visivel: true,
    ordem: 10,
  },
  {
    nome: 'microchip',
    label: 'Número do microchip',
    tipo: 'text',
    obrigatorio: false,
    visivel: true,
    ordem: 11,
  },
  {
    nome: 'caracteristicas',
    label: 'Características distintivas',
    tipo: 'textarea',
    obrigatorio: false,
    visivel: true,
    ordem: 12,
  },
  {
    nome: 'fotos',
    label: 'Fotos do pet',
    tipo: 'fotos',
    obrigatorio: true,
    visivel: true,
    ordem: 13,
  },
]

/** Mescla config remota com defaults (garante novos campos se admin ainda tem seed antigo). */
function mergeCamposComPadrao(remotos: CampoFormularioPet[]): CampoFormularioPet[] {
  const byNome = new Map(remotos.map((c) => [c.nome, c]))
  const nomesRemotos = new Set(remotos.map((c) => c.nome))

  // Se ainda for seed legado (só foto single / cor text), preferir padrão completo
  const legado =
    nomesRemotos.has('foto') &&
    !nomesRemotos.has('fotos') &&
    !nomesRemotos.has('sexo')

  if (legado || remotos.length === 0) {
    return CAMPOS_PADRAO
  }

  const merged = CAMPOS_PADRAO.map((padrao) => {
    const remoto = byNome.get(padrao.nome)
    return remoto ? { ...padrao, ...remoto, tipo: remoto.tipo || padrao.tipo } : padrao
  })

  // Campos custom do admin que não estão no padrão
  for (const remoto of remotos) {
    if (!CAMPOS_PADRAO.some((p) => p.nome === remoto.nome)) {
      merged.push(remoto)
    }
  }

  return merged
    .filter((c) => c.visivel !== false)
    .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
}

export async function fetchCamposFormularioPet(): Promise<CampoFormularioPet[]> {
  const { data, error } = await supabase
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'campos_formulario_pet')
    .maybeSingle()

  if (error) throw error

  const config = data?.valor as ConfigCamposPet | undefined
  const remotos = config?.campos ?? []
  return mergeCamposComPadrao(remotos)
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
