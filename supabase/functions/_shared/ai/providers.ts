import type { AiProvider, AnalyzePetImageRequest, PetVisualAnalysis } from './types.ts'
import {
  clamp01,
  emptyAttributes,
  hashToUnitVector,
  mapEspecie,
  mapPorte,
  mapSexo,
} from './types.ts'

/** Provider determinístico para CI / MVP sem Ollama. */
export class FakeAiProvider implements AiProvider {
  readonly id = 'fake'

  async analyzePetImage(req: AnalyzePetImageRequest): Promise<PetVisualAnalysis> {
    const dims = req.embedding_dimensions ?? 512
    const spaceId = req.embedding_space_id ?? 'petid-embed-v1'
    const seed = req.image_url ?? req.image_bytes_base64?.slice(0, 64) ?? req.request_id
    const vector = hashToUnitVector(seed, dims)

    const hintEsp = mapEspecie(req.hints?.especie_declarada)
    const hintPorte = mapPorte(req.hints?.porte_declarado)

    return {
      schema_version: '1.0',
      embedding: {
        vector,
        dimensions: dims,
        space: 'cosine',
        space_id: spaceId,
        model_id: 'fake:hash-embed@v1',
        normalized: true,
      },
      attributes: {
        ...emptyAttributes(),
        especie: { value: hintEsp ?? 'cao', confidence: hintEsp ? 0.9 : 0.55 },
        porte: { value: hintPorte ?? 'medio', confidence: hintPorte ? 0.85 : 0.5 },
        cores: { values: ['indefinido'], confidence: 0.3 },
        raca: { value: null, confidence: 0 },
        idade_estimada: { value: null, confidence: 0 },
        sexo: { value: 'indefinido', confidence: 0.2 },
      },
      confidence: {
        overall: 0.45,
        usable_for_auto_notify: false,
      },
      model: {
        provider: 'fake',
        vision_model: 'fake-vision',
        embedding_model: 'fake-embed',
        prompt_version: 'petid-fake-v1',
        latency_ms: 1,
        estimated_cost_brl: 0,
      },
      warnings: ['fake_provider'],
    }
  }
}

type OllamaConfig = {
  base_url: string
  vision_model: string
  embedding_model: string
  prompt_version: string
}

const VISION_PROMPT = `Analise a foto do animal e responda APENAS JSON válido com as chaves:
especie (cao|gato|outro), raca (string ou null), porte (pequeno|medio|grande),
cores (array de strings), idade_estimada (filhote|adulto|idoso ou null),
sexo (macho|femea|indefinido), confidence_overall (0 a 1).
Sem markdown.`

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama'
  constructor(private readonly cfg: OllamaConfig) {}

  async analyzePetImage(req: AnalyzePetImageRequest): Promise<PetVisualAnalysis> {
    const started = Date.now()
    const dims = req.embedding_dimensions ?? 512
    const spaceId = req.embedding_space_id ?? 'petid-embed-v1'
    const warnings: string[] = []

    let attrs = emptyAttributes()
    let overall = 0.4

    try {
      const vision = await this.chatVision(req)
      attrs = {
        especie: {
          value: mapEspecie(vision.especie),
          confidence: clamp01(Number(vision.confidence_especie ?? vision.confidence_overall ?? 0.5)),
        },
        raca: {
          value: vision.raca != null ? String(vision.raca) : null,
          confidence: clamp01(Number(vision.confidence_raca ?? 0.4)),
        },
        porte: {
          value: mapPorte(vision.porte),
          confidence: clamp01(Number(vision.confidence_porte ?? 0.5)),
        },
        cores: {
          values: Array.isArray(vision.cores)
            ? vision.cores.map(String)
            : vision.cores
              ? [String(vision.cores)]
              : [],
          confidence: clamp01(Number(vision.confidence_cores ?? 0.4)),
        },
        idade_estimada: {
          value: vision.idade_estimada != null ? String(vision.idade_estimada) : null,
          confidence: clamp01(Number(vision.confidence_idade ?? 0.3)),
        },
        sexo: {
          value: mapSexo(vision.sexo),
          confidence: clamp01(Number(vision.confidence_sexo ?? 0.3)),
        },
      }
      overall = clamp01(Number(vision.confidence_overall ?? 0.5))
    } catch (err) {
      warnings.push(`vision_failed:${err instanceof Error ? err.message : String(err)}`)
    }

    let vector: number[]
    try {
      vector = await this.embed(req)
      if (vector.length !== dims) {
        warnings.push(`embed_dims_mismatch:${vector.length}`)
        vector = hashToUnitVector(req.request_id + ':fallback', dims)
      } else {
        vector = normalizeSafe(vector)
      }
    } catch (err) {
      warnings.push(`embed_failed:${err instanceof Error ? err.message : String(err)}`)
      vector = hashToUnitVector(req.request_id + ':embed-fallback', dims)
    }

    return {
      schema_version: '1.0',
      embedding: {
        vector,
        dimensions: dims,
        space: 'cosine',
        space_id: spaceId,
        model_id: `ollama:${this.cfg.embedding_model}`,
        normalized: true,
      },
      attributes: attrs,
      confidence: {
        overall,
        usable_for_auto_notify: overall >= 0.55 && warnings.length === 0,
      },
      model: {
        provider: 'ollama',
        vision_model: this.cfg.vision_model,
        embedding_model: this.cfg.embedding_model,
        prompt_version: this.cfg.prompt_version,
        latency_ms: Date.now() - started,
      },
      warnings: warnings.length ? warnings : undefined,
    }
  }

  private async chatVision(req: AnalyzePetImageRequest): Promise<Record<string, unknown>> {
    const images: string[] = []
    if (req.image_bytes_base64) {
      images.push(req.image_bytes_base64)
    } else if (req.image_url) {
      const bin = await fetch(req.image_url)
      if (!bin.ok) throw new Error(`download_image_${bin.status}`)
      const buf = new Uint8Array(await bin.arrayBuffer())
      images.push(bytesToBase64(buf))
    } else {
      throw new Error('no_image')
    }

    const res = await fetch(`${this.cfg.base_url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.cfg.vision_model,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'user',
            content: VISION_PROMPT,
            images,
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`ollama_chat_${res.status}`)
    }

    const data = await res.json()
    const content = data?.message?.content ?? data?.response ?? '{}'
    return typeof content === 'string' ? JSON.parse(content) : content
  }

  private async embed(req: AnalyzePetImageRequest): Promise<number[]> {
    // nomic-embed-text trabalha com texto; usamos descrição sintética + URL hash
    const prompt =
      req.purpose === 'rescue'
        ? `pet rescue photo ${req.request_id}`
        : `pet profile photo ${req.request_id}`

    const res = await fetch(`${this.cfg.base_url.replace(/\/$/, '')}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.cfg.embedding_model,
        prompt,
      }),
    })

    if (!res.ok) throw new Error(`ollama_embed_${res.status}`)
    const data = await res.json()
    const emb = data?.embedding
    if (!Array.isArray(emb)) throw new Error('no_embedding')
    return emb.map(Number)
  }
}

function normalizeSafe(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1
  return vec.map((x) => x / norm)
}

/** Evita stack overflow com spread em imagens grandes (art. 3.2 / Edge memory). */
function bytesToBase64(buf: Uint8Array): string {
  const parts: string[] = []
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    const slice = buf.subarray(i, Math.min(i + chunk, buf.length))
    let segment = ''
    for (let j = 0; j < slice.length; j++) {
      segment += String.fromCharCode(slice[j]!)
    }
    parts.push(segment)
  }
  return btoa(parts.join(''))
}

export function createAiProvider(
  active: string,
  providersCfg: Record<string, Record<string, unknown>>,
): AiProvider {
  if (active === 'ollama') {
    const o = providersCfg.ollama ?? {}
    return new OllamaProvider({
      base_url: String(o.base_url ?? Deno.env.get('OLLAMA_BASE_URL') ?? 'http://127.0.0.1:11434'),
      vision_model: String(o.vision_model ?? 'qwen2.5vl'),
      embedding_model: String(o.embedding_model ?? 'nomic-embed-text'),
      prompt_version: String(o.prompt_version ?? 'petid-vision-v1'),
    })
  }
  return new FakeAiProvider()
}
