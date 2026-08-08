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

  if (!ctx.tem_foto || !ctx.bucket || !ctx.foto_path) {
    await fail(supabase, jobId, 'sem_foto')
    return json({ ok: false, motivo: 'sem_foto', job_id: jobId }, 200)
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(String(ctx.bucket))
    .createSignedUrl(String(ctx.foto_path), 300)

  if (signErr || !signed?.signedUrl) {
    await fail(supabase, jobId, signErr?.message ?? 'signed_url_failed')
    return json(
      { error: signErr?.message ?? 'signed_url_failed', job_id: jobId },
      500,
    )
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

  let analysis: PetVisualAnalysis
  try {
    analysis = await provider.analyzePetImage({
      image_url: signed.signedUrl,
      purpose: ctx.tipo === 'resgate' ? 'rescue' : 'pet_profile',
      request_id: String(jobId),
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

  if (body.dry_run) {
    return json({ ok: true, dry_run: true, job_id: jobId, analysis }, 200)
  }

  const { data: result, error: finErr } = await supabase.rpc(
    'concluir_job_matching_com_analise',
    { p_job_id: jobId, p_analise: analysis },
  )

  if (finErr) {
    await fail(supabase, jobId, finErr.message)
    return json({ error: finErr.message, job_id: jobId }, 500)
  }

  return json({ ok: true, job_id: jobId, result }, 200)
})

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
