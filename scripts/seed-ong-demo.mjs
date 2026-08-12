/**
 * Seed ONG: ~50 cães no inventário + resgates para o painel/relatório.
 *
 * Uso (PowerShell):
 *   $env:ORG_EMAIL="..."
 *   $env:ORG_PASSWORD="..."
 *   node scripts/seed-ong-demo.mjs
 *
 * Opcional (admin da plataforma, se a ONG estiver pendente / sem região):
 *   $env:ADMIN_EMAIL="..."
 *   $env:ADMIN_PASSWORD="..."
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ASSETS = join(__dirname, 'demo-assets')
const ORIGEM = 'seed-ong-demo'
const TARGET_DOGS = 50
/** Resgates alimentam o painel; cada um também espelha 1 linha no inventário. */
const TARGET_RESGATES = 25

function loadEnvLocal() {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.ORG_EMAIL
const PASSWORD = process.env.ORG_PASSWORD
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!EMAIL || !PASSWORD) {
  console.error('Defina ORG_EMAIL e ORG_PASSWORD')
  process.exit(1)
}

/** Centro BH — região do painel */
const REGIAO = {
  latitude: -19.9167,
  longitude: -43.9345,
  raioKm: 25,
  label: 'Belo Horizonte - MG',
}

const NOMES = [
  'Bob', 'Rex', 'Max', 'Toby', 'Buddy', 'Rocky', 'Zeus', 'Thor', 'Lucky', 'Duke',
  'Charlie', 'Cooper', 'Bear', 'Jack', 'Oliver', 'Leo', 'Milo', 'Simba', 'Apollo', 'Ace',
  'Luna', 'Mel', 'Nina', 'Bella', 'Maya', 'Lola', 'Nala', 'Amora', 'Jade', 'Pipoca',
  'Sofia', 'Cacau', 'Flor', 'Princesa', 'Tina', 'Molly', 'Daisy', 'Kira', 'Chloe', 'Ruby',
  'Spike', 'Bruce', 'Fred', 'Nick', 'Otto', 'Pingo', 'Bolt', 'Marley', 'Hugo', 'Dante',
  'Sansão', 'Forrest', 'Gael', 'Noah', 'Igor',
]

const RACAS = [
  'SRD', 'Labrador', 'Vira-lata', 'Pinscher', 'Shih Tzu', 'Poodle', 'Pastor Alemão',
  'Golden Retriever', 'Beagle', 'Bulldog', 'Yorkshire', 'Boxer', 'Dachshund',
]

const PORTES = ['Pequeno', 'Médio', 'Grande']
const CORES = ['Preto', 'Caramelo', 'Branco', 'Marrom', 'Cinza', 'Rajado', 'Malhado']
const SEXOS = ['macho', 'femea', 'nao_sei']
const STATUS_MIX = [
  'sob_cuidados',
  'sob_cuidados',
  'sob_cuidados',
  'disponivel_adocao',
  'disponivel_adocao',
  'transferido',
  'devolvido',
]

const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
  'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800&q=80',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80',
  'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800&q=80',
  'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800&q=80',
]

function client() {
  return createClient(SUPABASE_URL, ANON_KEY)
}

function pick(arr, i) {
  return arr[i % arr.length]
}

function jitter(base, spread) {
  return base + (Math.random() * 2 - 1) * spread
}

async function downloadPhotos() {
  mkdirSync(ASSETS, { recursive: true })
  const paths = []
  for (let i = 0; i < PHOTO_URLS.length; i++) {
    const dest = join(ASSETS, `ong-dog-${i + 1}.jpg`)
    if (!existsSync(dest) || readFileSync(dest).length < 1000) {
      console.log(`  baixando foto ${i + 1}/${PHOTO_URLS.length}…`)
      const res = await fetch(PHOTO_URLS[i], {
        headers: { 'User-Agent': 'MyPetID-ong-seed/1.0' },
      })
      if (!res.ok) throw new Error(`foto HTTP ${res.status}`)
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    }
    paths.push(dest)
  }
  return paths
}

function writeRegiaoSql(orgId) {
  const sqlPath = join(ASSETS, 'set-ong-regiao-demo.sql')
  mkdirSync(ASSETS, { recursive: true })
  const sql = `-- Cole no SQL Editor do Supabase (necessário para o painel/relatório)
-- Org: Ong Cão Sem Dono
update public.organizacoes
set regiao_atuacao = st_buffer(
  st_setsrid(st_makepoint(${REGIAO.longitude}, ${REGIAO.latitude}), 4326)::geography,
  ${REGIAO.raioKm * 1000}
)::geometry
where id = '${orgId}';
`
  writeFileSync(sqlPath, sql)
  return sqlPath
}

async function ensureOrgReady(orgId, orgRow) {
  const status = orgRow?.status_aprovacao
  const temRegiao = Boolean(orgRow?.regiao_atuacao)

  if (status !== 'aprovado') {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.error(`Org status=${status}. Aprove no admin ou use ADMIN_EMAIL/PASSWORD.`)
      process.exit(1)
    }
  }

  if (status === 'aprovado' && temRegiao) {
    console.log('Org aprovada com região — OK')
    return { temRegiao: true }
  }

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const admin = client()
    const { error: authErr } = await admin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
    if (authErr) {
      console.error('Login admin falhou:', authErr.message)
      process.exit(1)
    }

    if (status !== 'aprovado') {
      const { error } = await admin.rpc('atualizar_status_organizacao', {
        p_organizacao_id: orgId,
        p_status: 'aprovado',
      })
      if (error) {
        console.error('Aprovar org falhou:', error.message)
        process.exit(1)
      }
      console.log('Org aprovada pelo admin.')
    }

    if (!temRegiao) {
      const { error } = await admin.rpc('admin_definir_regiao_organizacao', {
        p_organizacao_id: orgId,
        p_latitude: REGIAO.latitude,
        p_longitude: REGIAO.longitude,
        p_raio_km: REGIAO.raioKm,
      })
      if (error) {
        console.error('Definir região falhou:', error.message)
        process.exit(1)
      }
      console.log(`Região definida: BH raio ${REGIAO.raioKm}km.`)
    }

    await admin.auth.signOut()
    return { temRegiao: true }
  }

  const sqlPath = writeRegiaoSql(orgId)
  console.log(`
⚠️  Org sem região — inventário será criado, mas o relatório fica zerado até aplicar:
    ${sqlPath}
    (SQL Editor do Supabase)
`)
  return { temRegiao: false }
}

const SKIP_PHOTOS = process.env.SEED_SKIP_PHOTOS === '1'

async function uploadFoto(supabase, orgId, filePath) {
  if (SKIP_PHOTOS) return null
  const id = randomUUID()
  const storagePath = `org/${orgId}/abrigo/${id}/foto.jpg`
  const bytes = readFileSync(filePath)
  const { error } = await supabase.storage
    .from('resgates')
    .upload(storagePath, bytes, {
      upsert: false,
      contentType: 'image/jpeg',
    })
  if (error) {
    console.warn(`  aviso upload inventário: ${error.message}`)
    return null
  }
  return storagePath
}

async function uploadFotoResgate(supabase, orgId, filePath) {
  if (SKIP_PHOTOS) return null
  const id = randomUUID()
  const storagePath = `org/${orgId}/${id}/foto.jpg`
  const bytes = readFileSync(filePath)
  const { error } = await supabase.storage
    .from('resgates')
    .upload(storagePath, bytes, {
      upsert: false,
      contentType: 'image/jpeg',
    })
  if (error) {
    console.warn(`  aviso upload resgate: ${error.message}`)
    return null
  }
  return storagePath
}

function isCao(animal) {
  return /c[aã]o/i.test(String(animal?.especie || ''))
}

async function createInventoryDog(supabase, orgId, photoPaths, index) {
  const base = pick(NOMES, index)
  const round = Math.floor(index / NOMES.length)
  const nome = round === 0 ? base : `${base} ${round + 1}`
  const fotoPath = photoPaths.length
    ? await uploadFoto(supabase, orgId, pick(photoPaths, index))
    : null

  const { data, error } = await supabase.rpc('criar_animal_organizacao', {
    p_nome: nome,
    p_especie: 'Cão',
    p_raca: pick(RACAS, index),
    p_porte: pick(PORTES, index),
    p_cor: pick(CORES, index),
    p_sexo: pick(SEXOS, index),
    p_caracteristicas: `Animal de demonstração do abrigo (${ORIGEM}). Sociável, vacinação em dia.`,
    p_microchip: null,
    p_foto_path: fotoPath,
    p_status: pick(STATUS_MIX, index),
  })

  if (error) throw new Error(`criar ${nome}: ${error.message}`)
  return { id: data?.id, nome }
}

async function createResgate(supabase, orgId, photoPaths, index) {
  const fotoPath = photoPaths.length
    ? await uploadFotoResgate(supabase, orgId, pick(photoPaths, index + 3))
    : null
  if (!fotoPath) {
    return { skipped: true, reason: 'foto/storage indisponível' }
  }
  const lat = jitter(REGIAO.latitude, 0.04)
  const lng = jitter(REGIAO.longitude, 0.04)

  const { data, error } = await supabase.rpc('registrar_resgate_autenticado', {
    p_foto_path: fotoPath,
    p_porte_estimado: pick(PORTES, index),
    p_regiao_aproximada: REGIAO.label,
    p_descricao: `Resgate demo #${index + 1} — ${ORIGEM}. Cão encontrado na região metropolitana.`,
    p_consentimento_localizacao: true,
    p_latitude: lat,
    p_longitude: lng,
    p_organizacao_id: orgId,
    p_consentimento_contexto: {
      origem: ORIGEM,
      registrado_em: new Date().toISOString(),
    },
    p_microchip: null,
  })

  if (error) throw new Error(`resgate #${index + 1}: ${error.message}`)
  return data
}

async function main() {
  console.log('=== Seed ONG demo ===')
  const supabase = client()

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (authErr) {
    console.error('Login ONG falhou:', authErr.message)
    process.exit(1)
  }
  console.log('Login OK:', auth.user.email)

  const { data: vinculos, error: vErr } = await supabase
    .from('usuarios_organizacao')
    .select(
      'organizacao_id, papel, organizacoes(id, nome, tipo, status_aprovacao, regiao_atuacao)',
    )
    .eq('user_id', auth.user.id)

  if (vErr || !vinculos?.length) {
    console.error('Organização não vinculada:', vErr?.message)
    process.exit(1)
  }

  const vinculo = vinculos[0]
  const org = vinculo.organizacoes
  const orgId = vinculo.organizacao_id
  console.log(`Org: ${org?.nome} (${orgId}) status=${org?.status_aprovacao}`)

  const ready = await ensureOrgReady(orgId, org)

  // Re-login org (admin pode ter trocado a sessão)
  await supabase.auth.signOut()
  const { error: reAuthErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (reAuthErr) {
    console.error('Re-login ONG falhou:', reAuthErr.message)
    process.exit(1)
  }
  void ready

  console.log('\nBaixando fotos…')
  const photoPaths = await downloadPhotos()

  const { data: atuais, error: listErr } = await supabase.rpc(
    'listar_animais_organizacao',
    { p_organizacao_id: null, p_limite: 500 },
  )
  if (listErr) throw new Error(listErr.message)
  const lista = Array.isArray(atuais) ? atuais : []
  const dogsNow = lista.filter(isCao).length
  console.log(`Cães já no inventário: ${dogsNow}`)

  // Anexa foto aos que ficaram sem (seed anterior com Storage bloqueado)
  const semFoto = lista.filter((a) => isCao(a) && !a.foto_url)
  console.log(`\nAnexando fotos a ${semFoto.length} animais sem foto…`)
  let fotosOk = 0
  for (let i = 0; i < semFoto.length; i++) {
    const animal = semFoto[i]
    const storagePath = await uploadFoto(
      supabase,
      orgId,
      pick(photoPaths, i),
    )
    if (!storagePath) continue
    const { error: upErr } = await supabase
      .from('animais_organizacao')
      .update({ foto_url: storagePath, updated_at: new Date().toISOString() })
      .eq('id', animal.id)
    if (upErr) {
      console.warn(`  falha foto ${animal.nome}: ${upErr.message}`)
      continue
    }
    fotosOk += 1
    if ((i + 1) % 10 === 0 || i === semFoto.length - 1) {
      console.log(`  fotos ${fotosOk}/${semFoto.length}`)
    }
  }

  // Meta ~50 cães no inventário (resgates extras entram depois, se Storage permitir)
  const toCreate = Math.max(0, TARGET_DOGS - dogsNow)
  const inventorioTarget = TARGET_DOGS
  const resgatesToCreate = TARGET_RESGATES

  console.log(
    `\nCriando ${toCreate} cães no inventário (meta inventário direto ~${inventorioTarget})…`,
  )
  for (let i = 0; i < toCreate; i++) {
    const idx = dogsNow + i
    const created = await createInventoryDog(supabase, orgId, photoPaths, idx)
    if ((i + 1) % 10 === 0 || i === toCreate - 1) {
      console.log(`  ${i + 1}/${toCreate} — último: ${created.nome}`)
    }
  }

  const { count: resgatesExistentes, error: countErr } = await supabase
    .from('registros_resgate')
    .select('id', { count: 'exact', head: true })
    .eq('organizacao_id', orgId)

  if (countErr) {
    console.warn('Não foi possível contar resgates:', countErr.message)
  }
  const resgatesNow = resgatesExistentes ?? 0
  const resgatesFaltam = Math.max(0, resgatesToCreate - resgatesNow)
  console.log(
    `\nResgates da org: ${resgatesNow}. Criando mais ${resgatesFaltam}…`,
  )
  let resgatesOk = 0
  let resgatesSkip = 0
  for (let i = 0; i < resgatesFaltam; i++) {
    const result = await createResgate(
      supabase,
      orgId,
      photoPaths,
      resgatesNow + i,
    )
    if (result?.skipped) {
      resgatesSkip += 1
    } else {
      resgatesOk += 1
    }
    if ((i + 1) % 5 === 0 || i === resgatesFaltam - 1) {
      console.log(
        `  progresso ${i + 1}/${resgatesFaltam} (ok=${resgatesOk}, skip=${resgatesSkip})`,
      )
    }
  }
  if (resgatesSkip > 0) {
    console.log(`
⚠️  ${resgatesSkip} resgates pulados (Storage RLS). Aplique scripts/ong-ops-feira.sql
    e rode de novo SEM SEED_SKIP_PHOTOS para fotos + relatório.
`)
  }

  const { data: painel, error: pErr } = await supabase.rpc(
    'obter_painel_organizacao',
    { p_organizacao_id: orgId, p_dias: 30 },
  )
  if (pErr) {
    console.error('Painel:', pErr.message)
  } else {
    console.log('\n=== Indicadores (30 dias) ===')
    console.log(JSON.stringify(painel?.indicadores, null, 2))
    console.log('tem_regiao:', painel?.organizacao?.tem_regiao_configurada)
    console.log('alertas:', Array.isArray(painel?.alertas) ? painel.alertas.length : 0)
  }

  const { data: finalList } = await supabase.rpc('listar_animais_organizacao', {
    p_organizacao_id: null,
    p_limite: 500,
  })
  const finalDogs = (Array.isArray(finalList) ? finalList : []).filter(isCao)
  console.log(`\nInventário final de cães: ${finalDogs.length}`)
  console.log(`Resgates criados nesta execução: ${resgatesOk}`)
  console.log('\nPronto. Abra /orgao e /orgao/animais para validar.')
}

main().catch((err) => {
  console.error('\nSeed ONG falhou:', err)
  process.exit(1)
})
