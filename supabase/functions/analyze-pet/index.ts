import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createAiProvider } from '../_shared/ai/providers.ts'
import type { PetVisualAnalysis } from '../_shared/ai/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type Body = {
  job_id?: string
  dry_run?: boolean
}

type FotoRef = {
  id?: string
  path: string
  ordem?: number
  slot?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
  )

  let jobId = body.job_id
  if (!jobId) {
    const { data: claimed, error: claimErr } = await supabase.rpc(
      'claim_matching_job',
      {
        p_claimed_by: 'analyze-pet',
        p_tipos: ['resgate', 'animal', 'ocorrencia'],
      },
    )
    if (claimErr) return json({ error: claimErr.message }, 500)
    if (!claimed?.ok) {
      return json({ ok: false, motivo: claimed?.motivo ?? 'fila_vazia' }, 200)
    }
    jobId = claimed.job.id as string
  }

  const { data: ctx, error: ctxErr } = await supabase.rpc(
    'obter_contexto_job_matching',
    { p_job_id: jobId },
  )
  if (ctxErr) {
    await fail(supabase, jobId, ctxErr.message)
    return json({ error: ctxErr.message, job_id: jobId }, 500)
  }

  // Ocorrência: só matching (embedding vem do animal)
  if (ctx.tipo === 'ocorrencia') {
    const { data: result, error: finErr } = await supabase.rpc(
      'concluir_job_matching_com_analise',
      { p_job_id: jobId, p_analise: {} },
    )
    if (finErr) {
      await fail(supabase, jobId, finErr.message)
      return json({ error: finErr.message, job_id: jobId }, 500)
    }
    return json({ ok: true, job_id: jobId, result }, 200)
  }

  const fotoPaths = normalizeFotoPaths(ctx)
  if (!ctx.tem_foto || !ctx.bucket || fotoPaths.length === 0) {
    await fail(supabase, jobId, 'sem_foto')
    return json({ ok: false, motivo: 'sem_foto', job_id: jobId }, 200)
  }

  const aiCfg = (ctx.ai_provider ?? {}) as Record<string, unknown>
  const active = String(aiCfg.active_provider ?? 'fake')
  const providers = (aiCfg.providers ?? {}) as Record<
    string,
    Record<string, unknown>
  >
  const dims = Number(aiCfg.embedding_dimensions ?? 512)
  const spaceId = String(aiCfg.embedding_space_id ?? 'petid-embed-v1')
  const provider = createAiProvider(active, providers)

  const analyses: PetVisualAnalysis[] = []

  for (const foto of fotoPaths) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(String(ctx.bucket))
      .createSignedUrl(foto.path, 300)

    if (signErr || !signed?.signedUrl) {
      await fail(supabase, jobId, signErr?.message ?? 'signed_url_failed')
      return json(
        { error: signErr?.message ?? 'signed_url_failed', job_id: jobId },
        500,
      )
    }

    let analysis: PetVisualAnalysis
    try {
      analysis = await provider.analyzePetImage({
        image_url: signed.signedUrl,
        purpose: ctx.tipo === 'resgate' ? 'rescue' : 'pet_profile',
        request_id: `${jobId}:${foto.ordem ?? analyses.length + 1}`,
        locale: 'pt-BR',
        embedding_dimensions: dims,
        embedding_space_id: spaceId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await fail(supabase, jobId, msg)
      return json({ error: msg, job_id: jobId }, 500)
    }

    analysis.embedding.space_id = analysis.embedding.space_id ?? spaceId
    analyses.push(analysis)

    if (ctx.tipo === 'animal' && foto.id) {
      const { error: fotoErr } = await supabase.rpc(
        'aplicar_analise_visual_animal_foto',
        { p_foto_id: foto.id, p_analise: analysis },
      )
      if (fotoErr) {
        await fail(supabase, jobId, fotoErr.message)
        return json({ error: fotoErr.message, job_id: jobId }, 500)
      }
    }
  }

  const canonical =
    analyses.length === 1
      ? analyses[0]
      : aggregateAnalyses(analyses, spaceId, dims)

  if (body.dry_run) {
    return json({
      ok: true,
      dry_run: true,
      job_id: jobId,
      analysis: canonical,
      fotos: analyses.length,
    }, 200)
  }

  const { data: result, error: finErr } = await supabase.rpc(
    'concluir_job_matching_com_analise',
    { p_job_id: jobId, p_analise: canonical },
  )

  if (finErr) {
    await fail(supabase, jobId, finErr.message)
    return json({ error: finErr.message, job_id: jobId }, 500)
  }

  return json({
    ok: true,
    job_id: jobId,
    result,
    fotos_processadas: analyses.length,
  }, 200)
})

function normalizeFotoPaths(ctx: Record<string, unknown>): FotoRef[] {
  const raw = ctx.foto_paths
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return { path: item }
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          const path = String(o.path ?? o.storage_path ?? '')
          if (!path) return null
          return {
            id: o.id ? String(o.id) : undefined,
            path,
            ordem: o.ordem != null ? Number(o.ordem) : undefined,
            slot: o.slot ? String(o.slot) : undefined,
          }
        }
        return null
      })
      .filter((x): x is FotoRef => Boolean(x?.path))
  }

  if (ctx.foto_path) {
    return [{ path: String(ctx.foto_path), ordem: 1 }]
  }
  return []
}

function aggregateAnalyses(
  analyses: PetVisualAnalysis[],
  spaceId: string,
  dims: number,
): PetVisualAnalysis {
  const vectors = analyses.map((a) => a.embedding.vector)
  const mean = new Array(dims).fill(0)

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      mean[i] += Number(vec[i] ?? 0)
    }
  }
  for (let i = 0; i < dims; i++) {
    mean[i] /= vectors.length
  }

  let norm = 0
  for (let i = 0; i < dims; i++) {
    norm += mean[i] * mean[i]
  }
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < dims; i++) {
    mean[i] /= norm
  }

  const base = analyses[0]
  return {
    ...base,
    embedding: {
      ...base.embedding,
      vector: mean,
      dimensions: dims,
      space_id: spaceId,
      model_id: base.embedding.model_id,
    },
    confidence: {
      ...base.confidence,
      overall: average(
        analyses.map((a) => Number(a.confidence?.overall ?? 0)),
      ),
    },
  }
}

function average(nums: number[]) {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

async function fail(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  erro: string,
) {
  await supabase.rpc('fail_matching_job', { p_job_id: jobId, p_erro: erro })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
