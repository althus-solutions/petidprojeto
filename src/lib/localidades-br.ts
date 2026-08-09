/** Localidades do Brasil — UF → cidades (IBGE) → bairros (ViaCEP + geocode). */

export interface UfOption {
  sigla: string
  nome: string
}

export interface CidadeOption {
  id: number
  nome: string
}

export interface BairroOption {
  id: string
  nome: string
  /** Preenchido ao selecionar (geocode) ou quando já conhecido. */
  latitude: number | null
  longitude: number | null
}

/** 27 UFs — sigla para o formulário. */
export const ESTADOS_UF: UfOption[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]

const IBGE_MUNICIPIOS =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados'

/** Termos de logradouro para “varrer” bairros no ViaCEP. */
const VIACEP_TERMOS = [
  'Rua',
  'Avenida',
  'Travessa',
  'Alameda',
  'Praça',
  'Estrada',
  'Rodovia',
  'Largo',
  'Viela',
]

const cidadesCache = new Map<string, CidadeOption[]>()
const bairrosCache = new Map<string, BairroOption[]>()

export async function fetchCidadesByUf(
  uf: string,
  signal?: AbortSignal,
): Promise<CidadeOption[]> {
  const sigla = uf.trim().toUpperCase()
  if (!sigla || sigla.length !== 2) return []

  const cached = cidadesCache.get(sigla)
  if (cached) return cached

  const res = await fetch(`${IBGE_MUNICIPIOS}/${sigla}/municipios`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error('Não foi possível carregar as cidades deste estado.')
  }

  const data = (await res.json()) as Array<{ id: number; nome: string }>
  const list = data
    .map((m) => ({ id: m.id, nome: m.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  cidadesCache.set(sigla, list)
  return list
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** ViaCEP costuma exigir cidade sem acento. */
function cidadeParaViaCep(cidade: string): string {
  return cidade
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type ViaCepItem = {
  bairro?: string
  erro?: boolean
}

async function fetchBairrosViaCep(
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const sigla = uf.trim().toUpperCase()
  const city = cidadeParaViaCep(cidade)
  if (!city || sigla.length !== 2) return []

  const nomes = new Set<string>()

  await Promise.all(
    VIACEP_TERMOS.map(async (termo) => {
      const url = `https://viacep.com.br/ws/${sigla}/${encodeURIComponent(city)}/${encodeURIComponent(termo)}/json/`
      try {
        const res = await fetch(url, { signal })
        if (!res.ok) return
        const data = (await res.json()) as ViaCepItem[] | ViaCepItem
        const items = Array.isArray(data) ? data : []
        for (const item of items) {
          const b = item.bairro?.trim()
          if (b) nomes.add(b)
        }
      } catch {
        /* ignora termo que falhou */
      }
    }),
  )

  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, string | number | undefined>
}

async function photonSearch(
  query: string,
  opts?: { limit?: number; signal?: AbortSignal },
): Promise<PhotonFeature[]> {
  // Photon só aceita: default, de, en, fr (não mais "pt").
  const params = new URLSearchParams({
    q: query,
    lang: 'default',
    limit: String(opts?.limit ?? 8),
    // Viés Brasil — melhora resultados de bairros/cidades.
    lat: '-14.235',
    lon: '-51.9253',
  })

  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal: opts?.signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { features?: PhotonFeature[] }
  return Array.isArray(data.features) ? data.features : []
}

/**
 * Lista bairros via ViaCEP (melhor cobertura no Brasil).
 * Coordenadas vêm depois, ao selecionar/confirmar o bairro.
 */
export async function fetchBairrosByCidadeUf(
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<BairroOption[]> {
  const city = cidade.trim()
  const sigla = uf.trim().toUpperCase()
  if (!city || sigla.length !== 2) return []

  const cacheKey = `${sigla}|${normalizeName(city)}|viacep`
  const cached = bairrosCache.get(cacheKey)
  if (cached) return cached

  const nomes = await fetchBairrosViaCep(city, sigla, signal)

  let list: BairroOption[] = nomes.map((nome) => ({
    id: `cep-${normalizeName(nome)}`,
    nome,
    latitude: null,
    longitude: null,
  }))

  if (list.length === 0) {
    list = [
      {
        id: 'centro-fallback',
        nome: 'Centro',
        latitude: null,
        longitude: null,
      },
    ]
  }

  bairrosCache.set(cacheKey, list)
  return list
}

export interface EnderecoViaCep {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  estado: string
  complemento: string
}

/** Busca endereço pelo CEP (ViaCEP). Retorna null se CEP inválido/não encontrado. */
export async function fetchEnderecoByCep(
  cep: string,
  signal?: AbortSignal,
): Promise<EnderecoViaCep | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error('Não foi possível consultar o CEP. Tente de novo.')
  }

  const data = (await res.json()) as {
    erro?: boolean
    cep?: string
    logradouro?: string
    complemento?: string
    bairro?: string
    localidade?: string
    uf?: string
  }

  if (data.erro || !data.uf || !data.localidade) return null

  return {
    cep: data.cep ?? `${digits.slice(0, 5)}-${digits.slice(5)}`,
    logradouro: (data.logradouro ?? '').trim(),
    bairro: (data.bairro ?? '').trim(),
    cidade: (data.localidade ?? '').trim(),
    estado: data.uf.trim().toUpperCase(),
    complemento: (data.complemento ?? '').trim(),
  }
}

/** Geocodifica bairro + cidade + UF (Photon) para lat/lng do matching. */
export async function geocodeBairroDigitado(
  bairro: string,
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<BairroOption | null> {
  const b = bairro.trim()
  const c = cidade.trim()
  const sigla = uf.trim().toUpperCase()
  if (b.length < 2 || !c || sigla.length !== 2) return null

  const features = await photonSearch(`${b}, ${c}, ${sigla}, Brasil`, {
    limit: 8,
    signal,
  })

  const hit =
    features.find((f) => {
      const p = f.properties ?? {}
      const nome = String(
        p.suburb ?? p.district ?? p.neighbourhood ?? p.name ?? '',
      )
      return normalizeName(nome).includes(normalizeName(b))
    }) ?? features[0]

  if (!hit?.geometry?.coordinates) {
    // Fallback: centro da cidade
    const cityHits = await photonSearch(`${c}, ${sigla}, Brasil`, {
      limit: 3,
      signal,
    })
    const city = cityHits[0]
    const [lng, lat] = city?.geometry?.coordinates ?? []
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    return {
      id: `typed-${normalizeName(b)}`,
      nome: b,
      latitude: lat,
      longitude: lng,
    }
  }

  const [lng, lat] = hit.geometry.coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  return {
    id: `geo-${normalizeName(b)}`,
    nome: b,
    latitude: lat,
    longitude: lng,
  }
}
