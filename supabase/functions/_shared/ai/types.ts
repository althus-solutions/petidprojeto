/** Contrato canônico PetVisualAnalysis (architecture.md §4.4) */
export type AttrValue<T> = {
  value: T | null
  confidence: number
}

export type PetVisualAnalysis = {
  schema_version: '1.0'
  embedding: {
    vector: number[]
    dimensions: number
    space: 'cosine' | 'l2' | 'ip'
    space_id?: string
    model_id: string
    normalized: boolean
  }
  attributes: {
    especie: AttrValue<'cao' | 'gato' | 'outro'>
    raca: AttrValue<string>
    porte: AttrValue<'pequeno' | 'medio' | 'grande'>
    cores: { values: string[]; confidence: number }
    idade_estimada: AttrValue<string>
    sexo: AttrValue<'macho' | 'femea' | 'indefinido'>
  }
  confidence: {
    overall: number
    usable_for_auto_notify: boolean
  }
  model: {
    provider: string
    vision_model: string
    embedding_model: string
    prompt_version: string
    latency_ms?: number
    estimated_cost_brl?: number
  }
  warnings?: string[]
}

export type AnalyzePetImageRequest = {
  image_url?: string
  image_bytes_base64?: string
  purpose: 'rescue' | 'pet_profile'
  locale?: string
  hints?: Record<string, string>
  request_id: string
  embedding_dimensions?: number
  embedding_space_id?: string
}

export interface AiProvider {
  readonly id: string
  analyzePetImage(req: AnalyzePetImageRequest): Promise<PetVisualAnalysis>
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1
  return vec.map((x) => x / norm)
}

export function hashToUnitVector(seed: string, dimensions: number): number[] {
  const out = new Array<number>(dimensions).fill(0)
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < dimensions; i++) {
    h ^= i + (h << 6) + (h >> 2)
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    const u = ((h >>> 0) % 10000) / 10000
    out[i] = u * 2 - 1
  }
  return normalizeVector(out)
}

export function emptyAttributes(): PetVisualAnalysis['attributes'] {
  return {
    especie: { value: null, confidence: 0 },
    raca: { value: null, confidence: 0 },
    porte: { value: null, confidence: 0 },
    cores: { values: [], confidence: 0 },
    idade_estimada: { value: null, confidence: 0 },
    sexo: { value: null, confidence: 0 },
  }
}

export function mapEspecie(raw: unknown): 'cao' | 'gato' | 'outro' | null {
  if (raw == null) return null
  const s = String(raw).toLowerCase()
  if (/(c[aã]o|cachorro|dog|canine)/.test(s)) return 'cao'
  if (/(gato|cat|felin)/.test(s)) return 'gato'
  if (s.trim()) return 'outro'
  return null
}

export function mapPorte(raw: unknown): 'pequeno' | 'medio' | 'grande' | null {
  if (raw == null) return null
  const s = String(raw).toLowerCase()
  if (/pequ|small|mini/.test(s)) return 'pequeno'
  if (/m[eé]d|medium/.test(s)) return 'medio'
  if (/grand|large|gigante/.test(s)) return 'grande'
  return null
}

export function mapSexo(raw: unknown): 'macho' | 'femea' | 'indefinido' | null {
  if (raw == null) return null
  const s = String(raw).toLowerCase()
  if (/mach|male|^m$/.test(s)) return 'macho'
  if (/f[eê]m|female|^f$/.test(s)) return 'femea'
  if (/indef|descon|unknown/.test(s)) return 'indefinido'
  return null
}
