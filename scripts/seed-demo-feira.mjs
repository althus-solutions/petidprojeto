/**
 * Seed one-shot: 5 pets de demonstração (feira) com foto e tag QR/NFC.
 * NÃO abre ocorrência — o tutor abre manualmente quando for testar o fluxo.
 *
 * Uso (PowerShell):
 *   $env:DEMO_TUTOR_EMAIL="..."
 *   $env:DEMO_TUTOR_PASSWORD="..."
 *   $env:DEMO_APP_URL="https://seu-dominio.com"   # opcional (URLs NFC)
 *   node scripts/seed-demo-feira.mjs
 *
 * Não grava senha em arquivo. Lê VITE_* de .env.local.
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
const EMAIL = process.env.DEMO_TUTOR_EMAIL
const PASSWORD = process.env.DEMO_TUTOR_PASSWORD
const APP_URL = (
  process.env.DEMO_APP_URL ||
  process.env.VITE_APP_URL ||
  'http://localhost:5181'
).replace(/\/$/, '')

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY em .env.local')
  process.exit(1)
}
if (!EMAIL || !PASSWORD) {
  console.error('Defina DEMO_TUTOR_EMAIL e DEMO_TUTOR_PASSWORD no ambiente.')
  process.exit(1)
}

const ORIGEM = 'seed-demo-feira'
const CONSENT_TEXTO =
  'Autorizo o uso da foto e características deste pet para fins de identificação e matching automático na plataforma, conforme a Política de Privacidade.'

/** Endereço tutor (pin roxo) — Savassi, BH */
const ENDERECO_TUTOR = {
  cep: '30130100',
  logradouro: 'Avenida Getúlio Vargas',
  numero: '254',
  complemento: null,
  bairro: 'Funcionários',
  cidade: 'Belo Horizonte',
  estado: 'MG',
  latitude: -19.9365,
  longitude: -43.9352,
}

const PETS = [
  {
    nome: 'Luna',
    especie: 'Cão',
    raca: 'SRD',
    porte: 'Médio',
    cores: ['Caramelo'],
    sexo: 'femea',
    castrado: 'sim',
    padrao_pelagem: 'curto',
    idade_estimada_valor: 3,
    idade_estimada_unidade: 'anos',
    peso: 12,
    caracteristicas:
      'Pelagem caramelo clara, orelhas caídas, muito sociável com pessoas.',
    photoUrl:
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&q=80',
    file: 'luna-cao.jpg',
  },
  {
    nome: 'Thor',
    especie: 'Cão',
    raca: 'Labrador',
    porte: 'Grande',
    cores: ['Preto'],
    sexo: 'macho',
    castrado: 'sim',
    padrao_pelagem: 'curto',
    idade_estimada_valor: 5,
    idade_estimada_unidade: 'anos',
    peso: 32,
    caracteristicas:
      'Labrador preto, coleira azul habitual, responde ao nome Thor.',
    photoUrl:
      'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=900&q=80',
    file: 'thor-cao.jpg',
  },
  {
    nome: 'Mel',
    especie: 'Cão',
    raca: 'Shih Tzu',
    porte: 'Pequeno',
    cores: ['Branco', 'Marrom'],
    sexo: 'femea',
    castrado: 'nao',
    padrao_pelagem: 'longo',
    idade_estimada_valor: 2,
    idade_estimada_unidade: 'anos',
    peso: 5.5,
    caracteristicas:
      'Pequena, pelo longo branco com manchas marrons, laço na cabeça às vezes.',
    photoUrl:
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=900&q=80',
    file: 'mel-cao.jpg',
  },
  {
    nome: 'Nina',
    especie: 'Gato',
    raca: 'SRD',
    porte: 'Médio',
    cores: ['Rajado'],
    sexo: 'femea',
    castrado: 'sim',
    padrao_pelagem: 'curto',
    idade_estimada_valor: 4,
    idade_estimada_unidade: 'anos',
    peso: 4.2,
    caracteristicas:
      'Gata rajada com “M” na testa, olhos verdes, bastante desconfiada com estranhos.',
    photoUrl:
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900&q=80',
    file: 'nina-gato.jpg',
  },
  {
    nome: 'Mimi',
    especie: 'Gato',
    raca: 'SRD',
    porte: 'Pequeno',
    cores: ['Cinza'],
    sexo: 'femea',
    castrado: 'sim',
    padrao_pelagem: 'medio',
    idade_estimada_valor: 1,
    idade_estimada_unidade: 'anos',
    peso: 3.1,
    caracteristicas:
      'Gatinha cinza, peito branco, miado alto; costuma ficar perto de portões.',
    photoUrl:
      'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=900&q=80',
    file: 'mimi-gato.jpg',
  },
]

function generateQrPayload() {
  return `pk_${randomUUID().replace(/-/g, '')}`
}

function buildPetUrl(payload) {
  return `${APP_URL}/pet/${encodeURIComponent(payload)}`
}

async function downloadPhoto(pet) {
  mkdirSync(ASSETS, { recursive: true })
  const dest = join(ASSETS, pet.file)
  if (existsSync(dest) && readFileSync(dest).length > 1000) {
    return dest
  }
  console.log(`  baixando foto: ${pet.nome}…`)
  const res = await fetch(pet.photoUrl, {
    headers: { 'User-Agent': 'MyPetID-demo-seed/1.0' },
  })
  if (!res.ok) {
    throw new Error(`Falha ao baixar foto de ${pet.nome}: HTTP ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 5 * 1024 * 1024) {
    throw new Error(`Foto de ${pet.nome} excede 5MB`)
  }
  writeFileSync(dest, buf)
  return dest
}

async function ensureEndereco(supabase, tutorId) {
  const { data: existing } = await supabase
    .from('tutor_enderecos')
    .select('id')
    .eq('tutor_id', tutorId)
    .limit(1)

  if (existing?.length) {
    console.log('Endereço do tutor já existe — mantendo.')
    return
  }

  await supabase.from('tutor_enderecos').delete().eq('tutor_id', tutorId)

  const { error } = await supabase.from('tutor_enderecos').insert({
    tutor_id: tutorId,
    tipo: 'residencia',
    cep: ENDERECO_TUTOR.cep,
    logradouro: ENDERECO_TUTOR.logradouro,
    numero: ENDERECO_TUTOR.numero,
    complemento: ENDERECO_TUTOR.complemento,
    bairro: ENDERECO_TUTOR.bairro,
    cidade: ENDERECO_TUTOR.cidade,
    estado: ENDERECO_TUTOR.estado,
    latitude: ENDERECO_TUTOR.latitude,
    longitude: ENDERECO_TUTOR.longitude,
    consentimento_em: new Date().toISOString(),
    consentimento_contexto: {
      finalidade: 'mapa_privado_tutor',
      tela: 'seed-demo-feira',
      nao_compartilhado_com_finder: true,
    },
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Endereço tutor: ${error.message}`)
  console.log('Endereço do tutor cadastrado (pin roxo no mapa).')
}

async function ensureTag(supabase, animal) {
  if (animal.qr_payload && animal.tag_status === 'registrada') {
    return animal
  }

  if (!animal.qr_payload) {
    if (animal.tag_status === 'nao_solicitada' || !animal.tag_status) {
      const { error: solErr } = await supabase
        .from('animais')
        .update({ tag_status: 'solicitada' })
        .eq('id', animal.id)
      if (solErr) throw new Error(`solicitarTag ${animal.nome}: ${solErr.message}`)
    }

    const payload = generateQrPayload()
    const { data, error } = await supabase
      .from('animais')
      .update({ qr_payload: payload, tag_status: 'registrada' })
      .eq('id', animal.id)
      .select('*')
      .single()
    if (error) throw new Error(`gerarTag ${animal.nome}: ${error.message}`)
    return data
  }

  const { data, error } = await supabase
    .from('animais')
    .update({ tag_status: 'registrada' })
    .eq('id', animal.id)
    .select('*')
    .single()
  if (error) throw new Error(`tag status ${animal.nome}: ${error.message}`)
  return data
}

/** Encerra ocorrências abertas (seed não deve deixar perda aberta). */
async function closeOpenOcorrencias(supabase, animalId) {
  const { data: abertas, error: listErr } = await supabase
    .from('ocorrencias_perdido')
    .select('id')
    .eq('animal_id', animalId)
    .eq('status', 'aberta')

  if (listErr) throw new Error(`list ocorrencias: ${listErr.message}`)
  if (!abertas?.length) return 0

  let closed = 0
  for (const o of abertas) {
    const { error } = await supabase.rpc('registrar_reencontro_tutor', {
      p_ocorrencia_id: o.id,
      p_notas: 'Encerrada pelo seed demo (ocorrência será aberta manualmente).',
    })
    if (error) throw new Error(`encerrar ocorrência ${o.id}: ${error.message}`)
    closed += 1
  }
  return closed
}

async function createOrReusePet(supabase, tutorId, pet) {
  const { data: existingList, error: findErr } = await supabase
    .from('animais')
    .select('*')
    .eq('tutor_id', tutorId)
    .eq('nome', pet.nome)

  if (findErr) throw new Error(findErr.message)

  const seeded = (existingList ?? []).find(
    (a) => a.consentimento_fotos_contexto?.origem === ORIGEM,
  )
  const byName = seeded ?? existingList?.[0]

  if (byName) {
    console.log(`  reutilizando pet existente: ${pet.nome} (${byName.id})`)
    let animal = byName

    const { data: fotos } = await supabase
      .from('animal_fotos')
      .select('id, storage_path')
      .eq('animal_id', animal.id)
      .limit(1)

    if (!fotos?.length && !animal.foto_url) {
      const photoPath = await downloadPhoto(pet)
      const storagePath = `${tutorId}/${animal.id}/1.jpg`
      const bytes = readFileSync(photoPath)
      const { error: upErr } = await supabase.storage
        .from('pets')
        .upload(storagePath, bytes, {
          upsert: true,
          contentType: 'image/jpeg',
        })
      if (upErr) throw new Error(`upload ${pet.nome}: ${upErr.message}`)

      const { error: fotoErr } = await supabase.from('animal_fotos').insert({
        animal_id: animal.id,
        storage_path: storagePath,
        slot: 'corpo',
        ordem: 1,
        ia_status: 'pendente',
      })
      if (fotoErr) throw new Error(`animal_fotos ${pet.nome}: ${fotoErr.message}`)

      const { data: refreshed } = await supabase
        .from('animais')
        .select('*')
        .eq('id', animal.id)
        .single()
      if (refreshed) animal = refreshed
    }

    animal = await ensureTag(supabase, animal)
    const closed = await closeOpenOcorrencias(supabase, animal.id)
    return { animal, closed, created: false }
  }

  const photoPath = await downloadPhoto(pet)
  const row = {
    tutor_id: tutorId,
    nome: pet.nome,
    especie: pet.especie,
    raca: pet.raca,
    porte: pet.porte,
    cor: pet.cores.join(', '),
    cores: pet.cores,
    sexo: pet.sexo,
    castrado: pet.castrado,
    padrao_pelagem: pet.padrao_pelagem,
    idade_estimada_valor: pet.idade_estimada_valor,
    idade_estimada_unidade: pet.idade_estimada_unidade,
    data_nascimento: null,
    peso: pet.peso,
    caracteristicas: pet.caracteristicas,
    microchip: null,
    qr_payload: null,
    tag_status: 'nao_solicitada',
    consentimento_fotos_em: new Date().toISOString(),
    consentimento_fotos_contexto: {
      versao: 'cadastro-pet-v1',
      texto: CONSENT_TEXTO,
      origem: ORIGEM,
    },
  }

  const { data: animal, error } = await supabase
    .from('animais')
    .insert(row)
    .select('*')
    .single()

  if (error) throw new Error(`insert ${pet.nome}: ${error.message}`)

  const storagePath = `${tutorId}/${animal.id}/1.jpg`
  const bytes = readFileSync(photoPath)
  const { error: upErr } = await supabase.storage
    .from('pets')
    .upload(storagePath, bytes, {
      upsert: true,
      contentType: 'image/jpeg',
    })
  if (upErr) throw new Error(`upload ${pet.nome}: ${upErr.message}`)

  const { error: fotoErr } = await supabase.from('animal_fotos').insert({
    animal_id: animal.id,
    storage_path: storagePath,
    slot: 'corpo',
    ordem: 1,
    ia_status: 'pendente',
  })
  if (fotoErr) throw new Error(`animal_fotos ${pet.nome}: ${fotoErr.message}`)

  const { data: withCapa, error: reloadErr } = await supabase
    .from('animais')
    .select('*')
    .eq('id', animal.id)
    .single()
  if (reloadErr) throw reloadErr

  const tagged = await ensureTag(supabase, withCapa)
  const closed = await closeOpenOcorrencias(supabase, tagged.id)
  return { animal: tagged, closed, created: true }
}

async function verifyPublicPhoto(fotoPath) {
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const { data, error } = await anon.storage
    .from('pets')
    .createSignedUrl(fotoPath, 120)

  if (error || !data?.signedUrl) {
    return {
      ok: false,
      detail: error?.message || 'signedUrl vazia',
    }
  }
  return { ok: true }
}

async function verifyPublicRpc(payload) {
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const { data, error } = await anon.rpc('obter_pet_por_qr', {
    p_qr_payload: payload,
  })
  if (error) return { ok: false, detail: error.message }
  return {
    ok: true,
    tem_foto: Boolean(data?.tem_foto),
    foto_path: data?.foto_path ?? data?.foto_paths?.[0] ?? null,
    ocorrencia_aberta: Boolean(data?.ocorrencia_aberta),
  }
}

async function main() {
  console.log('=== Seed demo feira MyPetID ===')
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`App URL (NFC/QR): ${APP_URL}`)
  console.log(`Tutor: ${EMAIL}`)

  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  const { data: authData, error: authErr } =
    await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    })
  if (authErr) {
    console.error('Login falhou:', authErr.message)
    process.exit(1)
  }
  console.log('Login OK:', authData.user.email)

  const { data: tutor, error: tutorErr } = await supabase
    .from('tutores')
    .select('id, nome')
    .eq('user_id', authData.user.id)
    .single()

  if (tutorErr || !tutor) {
    console.error('Tutor não encontrado:', tutorErr?.message)
    process.exit(1)
  }
  console.log(`Tutor id: ${tutor.id} (${tutor.nome})`)

  await ensureEndereco(supabase, tutor.id)

  const results = []
  for (const pet of PETS) {
    console.log(`\n→ ${pet.nome} (${pet.especie})`)
    const { animal, closed, created } = await createOrReusePet(
      supabase,
      tutor.id,
      pet,
    )
    const fotoPath =
      animal.foto_url ||
      (
        await supabase
          .from('animal_fotos')
          .select('storage_path')
          .eq('animal_id', animal.id)
          .order('ordem', { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data?.storage_path

    results.push({
      nome: animal.nome,
      especie: animal.especie,
      id: animal.id,
      qr_payload: animal.qr_payload,
      url: buildPetUrl(animal.qr_payload),
      fotoPath,
      created,
      closed,
    })
    console.log(
      `  OK — tag ${animal.qr_payload} | sem ocorrência aberta${closed ? ` (encerrou ${closed})` : ''} | ${created ? 'criado' : 'reutilizado'}`,
    )
  }

  console.log('\n=== Validação pública (anon) ===')
  let photoOk = true
  let semOcorrencia = true
  for (const r of results) {
    const rpc = await verifyPublicRpc(r.qr_payload)
    let signed = { ok: false, detail: 'sem path' }
    if (r.fotoPath) signed = await verifyPublicPhoto(r.fotoPath)
    if (!rpc.ok || !signed.ok) photoOk = false
    if (rpc.ok && rpc.ocorrencia_aberta) semOcorrencia = false
    console.log(
      `  ${r.nome}: RPC=${rpc.ok ? 'ok' : rpc.detail} foto=${rpc.tem_foto} ocorrencia_aberta=${rpc.ocorrencia_aberta} signedUrl=${signed.ok ? 'ok' : signed.detail}`,
    )
  }

  if (!semOcorrencia) {
    console.log('\n⚠️  Ainda há ocorrência aberta em algum pet demo.')
  } else {
    console.log('\n✅ Nenhuma ocorrência aberta nos pets demo (você abre quando quiser).')
  }

  if (!photoOk) {
    console.log(`
⚠️  Foto pública falhou. Aplique no SQL Editor do Supabase:
    supabase/migrations/041_storage_pet_foto_publica_reforco.sql
Depois rode de novo este script (ou só teste a URL /pet).
`)
  } else {
    console.log('\n✅ Foto pública OK (migration 041 parece aplicada).')
  }

  console.log('\n=== URLs para gravar no NFC / imprimir QR ===\n')
  for (const r of results) {
    console.log(`${r.nome.padEnd(6)} | ${r.especie.padEnd(4)} | ${r.url}`)
  }

  const outPath = join(ASSETS, 'demo-urls.json')
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        gerado_em: new Date().toISOString(),
        app_url: APP_URL,
        tutor_email: EMAIL,
        pets: results.map(({ nome, especie, qr_payload, url, id }) => ({
          nome,
          especie,
          id,
          qr_payload,
          url,
        })),
      },
      null,
      2,
    ),
  )
  console.log(`\nSalvo em ${outPath}`)
  console.log('\nPronto.')
}

main().catch((err) => {
  console.error('\nSeed falhou:', err)
  process.exit(1)
})
