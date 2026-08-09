export interface GeocodeSuggestion {
  id: string
  label: string
  latitude: number
  longitude: number
  cidade?: string | null
  bairro?: string | null
  rua?: string | null
  numero?: string | null
  /** 0–1: confiança de match com o número informado */
  score?: number
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, string | number | undefined>
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function photonFeatures(
  query: string,
  opts?: { latitude?: number; longitude?: number; limit?: number; signal?: AbortSignal },
): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({
    q: query,
    lang: 'default',
    limit: String(opts?.limit ?? 10),
  })

  if (
    typeof opts?.latitude === 'number' &&
    typeof opts?.longitude === 'number'
  ) {
    params.set('lat', String(opts.latitude))
    params.set('lon', String(opts.longitude))
  } else {
    params.set('lat', '-14.235')
    params.set('lon', '-51.9253')
  }

  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal: opts?.signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { features?: PhotonFeature[] }
  return Array.isArray(data.features) ? data.features : []
}

function featureToSuggestion(
  f: PhotonFeature,
  index: number,
  opts?: { numero?: string; logradouro?: string; cidade?: string },
): GeocodeSuggestion | null {
  const [lng, lat] = f.geometry?.coordinates ?? []
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const p = f.properties ?? {}
  const cidade =
    String(p.city ?? p.town ?? p.village ?? p.county ?? '').trim() || null
  const bairro =
    String(p.district ?? p.suburb ?? p.neighbourhood ?? '').trim() || null
  const street = String(p.street ?? p.name ?? '').trim() || null
  const number = String(p.housenumber ?? '').trim() || null
  const streetLine = [street, number].filter(Boolean).join(', ')
  const parts = [streetLine || null, bairro, cidade, p.state, p.country]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
  const label = parts
    .filter((part, i) => i === 0 || part !== parts[i - 1])
    .join(', ')
  if (!label) return null

  let score = 0
  if (opts?.cidade && cidade && normalize(cidade) === normalize(opts.cidade)) {
    score += 25
  }
  if (opts?.logradouro && street) {
    const a = normalize(street)
    const b = normalize(opts.logradouro)
    if (a === b || a.includes(b) || b.includes(a)) score += 40
  }
  if (opts?.numero && number) {
    const want = normalize(opts.numero)
    const got = normalize(number)
    if (got === want) score += 100
    else if (got.includes(want) || want.includes(got)) score += 40
  } else if (opts?.numero && !number) {
    // Rua sem número — útil só como fallback
    score += 5
  }

  return {
    id: `${lat},${lng},${index}`,
    label,
    latitude: lat,
    longitude: lng,
    cidade,
    bairro,
    rua: street,
    numero: number,
    score,
  }
}

/**
 * Autocomplete de endereço via Photon (OpenStreetMap) — sem API key.
 */
export async function searchAddressSuggestions(
  query: string,
  opts?: { latitude?: number; longitude?: number; signal?: AbortSignal },
): Promise<GeocodeSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const features = await photonFeatures(q, {
    ...opts,
    limit: 8,
  })

  return features
    .map((f, index) => featureToSuggestion(f, index))
    .filter((x): x is GeocodeSuggestion => x != null)
}

/** Busca centrada em bairro + cidade (sem rua). */
export async function searchBairroCidade(
  bairro: string,
  cidade: string,
  opts?: { signal?: AbortSignal },
): Promise<GeocodeSuggestion[]> {
  const b = bairro.trim()
  const c = cidade.trim()
  if (b.length < 2 || c.length < 2) return []
  return searchAddressSuggestions(`${b}, ${c}, Brasil`, opts)
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

export interface ReverseGeocodeResult {
  label: string
  rua?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
}

function formatPhotonLabel(
  p: Record<string, string | number | undefined>,
): string {
  const street = String(p.street ?? p.name ?? '').trim()
  const number = String(p.housenumber ?? '').trim()
  const streetLine = [street, number].filter(Boolean).join(', ')
  const bairro = String(
    p.district ?? p.suburb ?? p.neighbourhood ?? '',
  ).trim()
  const cidade = String(p.city ?? p.town ?? p.village ?? '').trim()
  const estado = String(p.state ?? p.county ?? '').trim()
  const parts = [streetLine || null, bairro || null, cidade || null, estado || null]
    .filter(Boolean)
  return parts.join(' — ') || 'Localização aproximada'
}

/** Reverse geocode (Photon) — endereço legível a partir de lat/lng. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult | null> {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    lang: 'default',
  })

  const res = await fetch(`https://photon.komoot.io/reverse?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null

  const data = (await res.json()) as { features?: PhotonFeature[] }
  const p = data.features?.[0]?.properties
  if (!p) return null

  return {
    label: formatPhotonLabel(p),
    rua: String(p.street ?? p.name ?? '').trim() || null,
    numero: String(p.housenumber ?? '').trim() || null,
    bairro: String(p.district ?? p.suburb ?? p.neighbourhood ?? '').trim() || null,
    cidade: String(p.city ?? p.town ?? p.village ?? '').trim() || null,
    estado: String(p.state ?? '').trim() || null,
  }
}

export type GeocodePrecisao = 'numero' | 'rua'

export function hasGoogleGeocodingKey(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim())
}

function montarEnderecoTexto(input: {
  logradouro: string
  numero?: string
  bairro?: string
  cidade: string
  estado: string
}): string {
  return [
    [input.logradouro, input.numero].filter(Boolean).join(', '),
    input.bairro,
    input.cidade,
    input.estado,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')
}

export class GoogleGeocodeError extends Error {
  constructor(
    message: string,
    readonly status: string,
  ) {
    super(message)
    this.name = 'GoogleGeocodeError'
  }
}

/**
 * Google Geocoding — melhor precisão de número no Brasil (ROOFTOP / interpolado).
 * Requer VITE_GOOGLE_MAPS_API_KEY com Geocoding API habilitada.
 */
async function geocodeComGoogle(
  address: string,
  signal?: AbortSignal,
): Promise<{
  latitude: number
  longitude: number
  label: string
  precisao: GeocodePrecisao
} | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) return null

  const params = new URLSearchParams({
    address,
    key,
    language: 'pt-BR',
    region: 'br',
    components: 'country:BR',
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    { signal },
  )
  if (!res.ok) {
    throw new GoogleGeocodeError(
      'Falha de rede ao consultar o Google Geocoding.',
      'HTTP_ERROR',
    )
  }

  const data = (await res.json()) as {
    status: string
    error_message?: string
    results?: Array<{
      formatted_address?: string
      geometry?: {
        location?: { lat: number; lng: number }
        location_type?: string
      }
    }>
  }

  if (data.status === 'ZERO_RESULTS') return null

  if (data.status !== 'OK') {
    const detail = data.error_message ?? data.status
    if (data.status === 'REQUEST_DENIED') {
      const lower = detail.toLowerCase()
      if (lower.includes('referer') || lower.includes('referrer')) {
        throw new GoogleGeocodeError(
          'A Geocoding API não aceita chave com restrição de sites (referrer). Em Credenciais → sua chave → Restrições de aplicativo → escolha “Nenhuma”. Mantenha Restrições de API = só Geocoding API. Salve, aguarde 1–2 min e tente de novo.',
          data.status,
        )
      }
      throw new GoogleGeocodeError(
        `Google Geocoding recusou a chave (${detail}). Confira: Geocoding API ativada, faturamento ativo e chave correta no .env.local.`,
        data.status,
      )
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new GoogleGeocodeError(
        'Cota do Google Geocoding esgotada. Tente mais tarde ou verifique o faturamento.',
        data.status,
      )
    }
    throw new GoogleGeocodeError(
      `Google Geocoding: ${detail}`,
      data.status,
    )
  }

  const result = data.results?.[0]
  const lat = result?.geometry?.location?.lat
  const lng = result?.geometry?.location?.lng
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const locationType = result?.geometry?.location_type ?? ''
  const precisao: GeocodePrecisao =
    locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED'
      ? 'numero'
      : 'rua'

  return {
    latitude: lat,
    longitude: lng,
    label: result?.formatted_address?.trim() || address,
    precisao,
  }
}

async function geocodeComPhoton(input: {
  logradouro: string
  numero?: string
  bairro?: string
  cidade: string
  estado: string
  signal?: AbortSignal
}): Promise<{
  latitude: number
  longitude: number
  label: string
  precisao: GeocodePrecisao
} | null> {
  const { logradouro, cidade, estado, numero, bairro, signal } = input

  const cityHits = await photonFeatures(`${cidade}, ${estado}, Brasil`, {
    limit: 2,
    signal,
  })
  const cityCoords = cityHits[0]?.geometry?.coordinates
  const bias =
    cityCoords && typeof cityCoords[0] === 'number'
      ? { latitude: cityCoords[1], longitude: cityCoords[0] }
      : undefined

  const queries = [
    numero
      ? `${logradouro}, ${numero}, ${bairro ?? ''}, ${cidade}, ${estado}, Brasil`
      : null,
    numero ? `${numero} ${logradouro}, ${cidade}, ${estado}, Brasil` : null,
    `${logradouro}, ${bairro ?? ''}, ${cidade}, ${estado}, Brasil`,
    `${logradouro}, ${cidade}, ${estado}, Brasil`,
  ]
    .map((q) =>
      q
        ?.replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .replace(/^,\s*|,\s*$/g, '')
        .trim(),
    )
    .filter((q): q is string => Boolean(q && q.length >= 5))

  const scored: GeocodeSuggestion[] = []
  for (const q of queries) {
    const features = await photonFeatures(q, {
      ...bias,
      limit: 12,
      signal,
    })
    for (let i = 0; i < features.length; i++) {
      const s = featureToSuggestion(features[i], i, {
        numero,
        logradouro,
        cidade,
      })
      if (s) scored.push(s)
    }
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const best = scored[0]
  const precisao: GeocodePrecisao =
    numero && best.numero && normalize(best.numero) === normalize(numero)
      ? 'numero'
      : 'rua'

  return {
    latitude: best.latitude,
    longitude: best.longitude,
    label: best.label,
    precisao,
  }
}

/**
 * Geocode de endereço completo.
 * 1) Google Geocoding (preciso no nº) se VITE_GOOGLE_MAPS_API_KEY existir
 * 2) Photon/OSM (muitas vezes só o centro da rua no Brasil)
 */
export async function geocodeEnderecoCompleto(input: {
  logradouro: string
  numero?: string
  bairro?: string
  cidade: string
  estado: string
  signal?: AbortSignal
}): Promise<{
  latitude: number
  longitude: number
  label: string
  precisao: GeocodePrecisao
  provider: 'google' | 'photon'
} | null> {
  const logradouro = input.logradouro.trim()
  const cidade = input.cidade.trim()
  const estado = input.estado.trim().toUpperCase()
  if (logradouro.length < 2 || cidade.length < 2 || estado.length !== 2) {
    return null
  }

  const numero = input.numero?.trim()
  const bairro = input.bairro?.trim()
  const address = montarEnderecoTexto({
    logradouro,
    numero,
    bairro,
    cidade,
    estado,
  })

  // Com chave configurada, Google é obrigatório — não cair em Photon em silêncio
  // (Photon no BR costuma apontar só o meio da rua / endereço errado).
  if (hasGoogleGeocodingKey()) {
    const google = await geocodeComGoogle(address, input.signal)
    if (!google) {
      throw new GoogleGeocodeError(
        'Google não encontrou este endereço. Confira rua, número, bairro e cidade.',
        'ZERO_RESULTS',
      )
    }
    return { ...google, provider: 'google' }
  }

  const photon = await geocodeComPhoton({
    logradouro,
    numero,
    bairro,
    cidade,
    estado,
    signal: input.signal,
  })
  if (!photon) return null
  return { ...photon, provider: 'photon' }
}
