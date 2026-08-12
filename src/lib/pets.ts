import { normalizeStoragePath } from '@/lib/qr-read'
import { supabase } from '@/lib/supabase'
import type {
  Animal,
  AnimalFoto,
  CastradoPet,
  ColunaAnimal,
  FotoSlot,
  IdadeUnidade,
  PadraoPelagem,
  PetFormValues,
  PetFotoSlotValue,
  SexoPet,
} from '@/types/pet'
import {
  CONSENTIMENTO_FOTOS_TEXTO,
  FOTO_SLOTS,
  MAX_PET_FOTO_BYTES,
  MAX_PET_FOTOS,
} from '@/types/pet'

const BUCKET_PETS = 'pets'

/** Payload único por pet — gravado na tag (QR + NFC). */
export function generateQrPayload(): string {
  return `pk_${crypto.randomUUID().replace(/-/g, '')}`
}

/**
 * URL pública da tag (QR e NFC usam o mesmo destino).
 * Modelo Híbrido: /pet/{payload} = perfil público do animal.
 */
export function buildPetPublicUrl(qrPayload: string): string {
  const origin =
    import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ?? window.location.origin
  return `${origin}/pet/${encodeURIComponent(qrPayload)}`
}

export function hasTagRegistrada(animal: {
  tag_status?: string | null
  qr_payload?: string | null
}): boolean {
  return (
    animal.tag_status === 'registrada' ||
    Boolean(animal.qr_payload && animal.qr_payload.length > 0)
  )
}

/** Alias usado pelo display do QR (mesmo link do NFC). */
export function buildQrUrl(qrPayload: string): string {
  return buildPetPublicUrl(qrPayload)
}

/** Entrada genérica para animais sem tag. */
export function buildPublicRescueQrUrl(): string {
  const origin =
    import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ?? window.location.origin
  return `${origin}/resgate`
}

export async function listAnimaisByTutor(tutorId: string): Promise<Animal[]> {
  const { data, error } = await supabase
    .from('animais')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Animal[]
}

export async function getAnimalById(animalId: string): Promise<Animal | null> {
  const { data, error } = await supabase
    .from('animais')
    .select('*')
    .eq('id', animalId)
    .maybeSingle()

  if (error) throw error
  return data as Animal | null
}

/** Exclui o pet do tutor (RLS) e tenta limpar fotos no Storage. */
export async function deleteAnimal(animalId: string): Promise<void> {
  let fotoPaths: string[] = []
  try {
    const fotos = await listAnimalFotos(animalId)
    fotoPaths = fotos.map((f) => f.storage_path).filter(Boolean)
    const animal = await getAnimalById(animalId)
    if (animal?.foto_url && !fotoPaths.includes(animal.foto_url)) {
      fotoPaths.push(animal.foto_url)
    }
  } catch {
    /* segue com delete do registro */
  }

  const { error } = await supabase.from('animais').delete().eq('id', animalId)
  if (error) throw error

  if (fotoPaths.length > 0) {
    await supabase.storage.from(BUCKET_PETS).remove(fotoPaths)
  }
}

export async function listAnimalFotos(animalId: string): Promise<AnimalFoto[]> {
  const { data, error } = await supabase
    .from('animal_fotos')
    .select('id, animal_id, storage_path, slot, ordem')
    .eq('animal_id', animalId)
    .order('ordem', { ascending: true })

  if (error) throw error
  return (data ?? []) as AnimalFoto[]
}

const SEXO_LABEL: Record<SexoPet, string> = {
  macho: 'Macho',
  femea: 'Fêmea',
  nao_sei: 'Não sei',
}

const CASTRADO_LABEL: Record<CastradoPet, string> = {
  sim: 'Sim',
  nao: 'Não',
  nao_sei: 'Não sei',
}

const PELAGEM_LABEL: Record<PadraoPelagem, string> = {
  curto: 'Curto',
  medio: 'Médio',
  longo: 'Longo',
  enrolado: 'Enrolado/Cacheado',
  sem_pelo: 'Sem pelo',
}

/** Monta valores do formulário a partir do pet + fotos (edição). */
export async function animalToFormValues(
  animal: Animal,
  fotos: AnimalFoto[],
): Promise<PetFormValues> {
  const coresRaw = animal.cores?.length
    ? animal.cores
    : animal.cor
      ? animal.cor.split(',').map((c) => c.trim()).filter(Boolean)
      : []

  let corOutro = ''
  const cores = coresRaw.map((c) => {
    if (c.startsWith('Outro:')) {
      corOutro = c.replace(/^Outro:\s*/i, '').trim()
      return 'Outro'
    }
    return c
  })

  const slots: PetFotoSlotValue[] = FOTO_SLOTS.map((meta) => ({
    slot: meta.slot,
    file: null,
    previewUrl: null,
    storagePath: null,
  }))

  // Preferência: capa (foto_url) → ordem 1 → primeira da lista
  const capa =
    (animal.foto_url
      ? fotos.find((f) => f.storage_path === animal.foto_url)
      : undefined) ??
    fotos.find((f) => f.ordem === 1) ??
    fotos[0]

  if (capa && slots[0]) {
    const signed = await getPetPhotoSignedUrl(capa.storage_path)
    slots[0] = {
      slot: capa.slot || FOTO_SLOTS[0].slot,
      file: null,
      previewUrl: signed,
      storagePath: capa.storage_path,
    }
  } else if (animal.foto_url && slots[0]) {
    // Fallback capa legada sem linhas em animal_fotos
    const signed = await getPetPhotoSignedUrl(animal.foto_url)
    slots[0] = {
      slot: 'corpo',
      file: null,
      previewUrl: signed,
      storagePath: animal.foto_url,
    }
  }

  return {
    nome: animal.nome,
    especie: animal.especie ?? '',
    raca: animal.raca ?? '',
    porte: animal.porte ?? '',
    peso: animal.peso ?? '',
    caracteristicas: animal.caracteristicas ?? '',
    microchip: animal.microchip ?? '',
    sexo: animal.sexo ? SEXO_LABEL[animal.sexo] : '',
    castrado: animal.castrado ? CASTRADO_LABEL[animal.castrado] : '',
    padrao_pelagem: animal.padrao_pelagem
      ? PELAGEM_LABEL[animal.padrao_pelagem]
      : '',
    cores,
    cor_outro: corOutro,
    idade_modo: animal.data_nascimento ? 'nascimento' : 'estimada',
    data_nascimento: animal.data_nascimento ?? '',
    idade_estimada_valor: animal.idade_estimada_valor ?? '',
    idade_estimada_unidade: animal.idade_estimada_unidade ?? 'anos',
    consentimento_fotos: Boolean(animal.consentimento_fotos_em),
    fotos: slots,
  }
}

function mapSexo(raw: unknown): SexoPet | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (v === 'macho') return 'macho'
  if (v === 'fêmea' || v === 'femea') return 'femea'
  if (v === 'não sei' || v === 'nao sei' || v === 'nao_sei') return 'nao_sei'
  return null
}

function mapCastrado(raw: unknown): CastradoPet | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (v === 'sim') return 'sim'
  if (v === 'não' || v === 'nao') return 'nao'
  if (v === 'não sei' || v === 'nao sei' || v === 'nao_sei') return 'nao_sei'
  return null
}

function mapPelagem(raw: unknown): PadraoPelagem | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (v === 'curto') return 'curto'
  if (v === 'médio' || v === 'medio') return 'medio'
  if (v === 'longo') return 'longo'
  if (
    v === 'enrolado/cacheado' ||
    v === 'enrolado' ||
    v === 'cacheado' ||
    v.includes('enrolado')
  ) {
    return 'enrolado'
  }
  if (v === 'sem pelo' || v === 'sem_pelo') return 'sem_pelo'
  return null
}

function collectFotoSlots(values: PetFormValues): PetFotoSlotValue[] {
  const slots = values.fotos
  if (Array.isArray(slots) && slots.length > 0) {
    return slots as PetFotoSlotValue[]
  }

  // Compat: foto única legada
  const single = values.foto
  if (single instanceof File) {
    return [{ slot: 'corpo', file: single }]
  }

  return []
}

function collectCores(values: PetFormValues): string[] {
  const raw = values.cores
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean)
  }
  const cor = values.cor
  if (typeof cor === 'string' && cor.trim()) {
    return [cor.trim()]
  }
  return []
}

function mapFormToAnimalFields(
  values: PetFormValues,
  opts: {
    origem: string
    /** Se já havia consentimento, preserva timestamp original. */
    consentimentoExistenteEm?: string | null
  },
): Record<string, unknown> {
  const row: Record<string, unknown> = {}

  const colunas: ColunaAnimal[] = [
    'nome',
    'especie',
    'raca',
    'porte',
    'peso',
    'caracteristicas',
    'microchip',
  ]

  for (const coluna of colunas) {
    const valor = values[coluna]
    if (valor === undefined || valor === null || valor === '') {
      row[coluna] = coluna === 'nome' ? '' : null
      continue
    }
    row[coluna] = coluna === 'peso' ? Number(valor) : String(valor)
  }

  const cores = collectCores(values)
  const corOutro =
    typeof values.cor_outro === 'string' ? values.cor_outro.trim() : ''
  const coresFinal = cores.map((c) =>
    c === 'Outro' && corOutro ? `Outro: ${corOutro}` : c,
  )
  row.cores = coresFinal.length > 0 ? coresFinal : null
  row.cor = coresFinal.length > 0 ? coresFinal.join(', ') : null

  const sexo = mapSexo(values.sexo)
  if (!sexo) {
    throw new Error('Sexo do pet é obrigatório')
  }
  row.sexo = sexo

  row.castrado = mapCastrado(values.castrado)
  row.padrao_pelagem = mapPelagem(values.padrao_pelagem)

  const idadeModo = String(values.idade_modo ?? 'estimada')
  if (idadeModo === 'nascimento' && values.data_nascimento) {
    row.data_nascimento = String(values.data_nascimento)
    row.idade_estimada_valor = null
    row.idade_estimada_unidade = null
  } else if (
    values.idade_estimada_valor !== undefined &&
    values.idade_estimada_valor !== null &&
    values.idade_estimada_valor !== ''
  ) {
    row.data_nascimento = null
    row.idade_estimada_valor = Number(values.idade_estimada_valor)
    row.idade_estimada_unidade = (String(
      values.idade_estimada_unidade ?? 'anos',
    ) || 'anos') as IdadeUnidade
  } else {
    row.data_nascimento = null
    row.idade_estimada_valor = null
    row.idade_estimada_unidade = null
  }

  if (!values.consentimento_fotos) {
    throw new Error('É necessário autorizar o uso das fotos para continuar.')
  }

  row.consentimento_fotos_em =
    opts.consentimentoExistenteEm ?? new Date().toISOString()
  row.consentimento_fotos_contexto = {
    versao: 'cadastro-pet-v1',
    texto: CONSENTIMENTO_FOTOS_TEXTO,
    origem: opts.origem,
  }

  if (!row.nome) {
    throw new Error('Nome do pet é obrigatório')
  }

  return row
}

function slotTemFoto(slot: PetFotoSlotValue): boolean {
  return Boolean(slot.file instanceof File || slot.storagePath)
}

async function syncAnimalFotos(
  tutorId: string,
  animalId: string,
  slots: PetFotoSlotValue[],
): Promise<void> {
  const kept: { path: string; slot: FotoSlot; ordem: number }[] = []

  for (const item of slots) {
    if (item.file instanceof File) {
      validatePetFotoFile(item.file)
      const ordem = kept.length + 1
      const path = await uploadPetPhoto(tutorId, animalId, item.file, ordem)
      kept.push({
        path,
        slot: item.slot || FOTO_SLOTS[kept.length]?.slot || 'outro',
        ordem,
      })
    } else if (item.storagePath) {
      kept.push({
        path: item.storagePath,
        slot: item.slot || FOTO_SLOTS[kept.length]?.slot || 'outro',
        ordem: kept.length + 1,
      })
    }
  }

  if (kept.length < 1) {
    throw new Error('Mantenha ao menos 1 foto do pet.')
  }
  if (kept.length > MAX_PET_FOTOS) {
    throw new Error(`Máximo de ${MAX_PET_FOTOS} fotos.`)
  }

  const { error: delError } = await supabase
    .from('animal_fotos')
    .delete()
    .eq('animal_id', animalId)

  if (delError) throw delError

  const { error: insError } = await supabase.from('animal_fotos').insert(
    kept.map((u) => ({
      animal_id: animalId,
      storage_path: u.path,
      slot: u.slot,
      ordem: u.ordem,
      ia_status: 'pendente',
    })),
  )

  if (insError) throw insError
}

export function validatePetFotoFile(file: File): void {
  const okType =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/jpg' ||
    /\.(jpe?g|png)$/i.test(file.name)
  if (!okType) {
    throw new Error('Cada foto deve ser JPG ou PNG.')
  }
  if (file.size > MAX_PET_FOTO_BYTES) {
    throw new Error('Cada foto deve ter no máximo 5MB.')
  }
}

export async function uploadPetPhoto(
  tutorId: string,
  animalId: string,
  file: File,
  ordem = 1,
): Promise<string> {
  validatePetFotoFile(file)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${tutorId}/${animalId}/${ordem}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_PETS).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw error
  return path
}

export async function uploadPetPhotos(
  tutorId: string,
  animalId: string,
  slots: PetFotoSlotValue[],
): Promise<{ path: string; slot: FotoSlot; ordem: number }[]> {
  const filled = slots.filter((s) => s.file instanceof File)
  if (filled.length < 1) {
    throw new Error('Envie ao menos 1 foto do pet.')
  }
  if (filled.length > MAX_PET_FOTOS) {
    throw new Error(`Máximo de ${MAX_PET_FOTOS} fotos.`)
  }

  const uploaded: { path: string; slot: FotoSlot; ordem: number }[] = []

  for (let i = 0; i < filled.length; i++) {
    const item = filled[i]
    const ordem = i + 1
    const path = await uploadPetPhoto(tutorId, animalId, item.file!, ordem)
    uploaded.push({
      path,
      slot: item.slot || FOTO_SLOTS[i]?.slot || 'outro',
      ordem,
    })
  }

  return uploaded
}

export async function getPetPhotoSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const path = normalizeStoragePath(storagePath)
  if (!path) return null

  const { data, error } = await supabase.storage
    .from(BUCKET_PETS)
    .createSignedUrl(path, expiresIn)

  if (error) return null
  return data.signedUrl
}

export async function createAnimal(
  tutorId: string,
  values: PetFormValues,
): Promise<Animal> {
  const fotoSlots = collectFotoSlots(values)
  const filled = fotoSlots.filter((s) => s.file instanceof File)
  if (filled.length < 1) {
    throw new Error('Envie ao menos 1 foto do pet.')
  }
  for (const slot of filled) {
    validatePetFotoFile(slot.file!)
  }

  // QR/NFC só após solicitar tag e gerar (ver solicitarTag / gerarTagDigital)
  const fields = mapFormToAnimalFields(values, {
    origem: 'tutor/pets/novo',
  })
  const row = {
    ...fields,
    tutor_id: tutorId,
    qr_payload: null,
    tag_status: 'nao_solicitada',
  }

  const { data: animal, error } = await supabase
    .from('animais')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505' && error.message.toLowerCase().includes('microchip')) {
      throw new Error('Este número de microchip já está cadastrado.')
    }
    throw error
  }

  const uploaded = await uploadPetPhotos(tutorId, animal.id, fotoSlots)

  const { error: fotosError } = await supabase.from('animal_fotos').insert(
    uploaded.map((u) => ({
      animal_id: animal.id,
      storage_path: u.path,
      slot: u.slot,
      ordem: u.ordem,
      ia_status: 'pendente',
    })),
  )

  if (fotosError) throw fotosError

  // Trigger sync capa; refetch para retornar foto_url atualizado
  const { data: updated, error: reloadError } = await supabase
    .from('animais')
    .select('*')
    .eq('id', animal.id)
    .single()

  if (reloadError) throw reloadError
  return updated as Animal
}

/**
 * Atualiza dados e fotos do pet.
 * Nunca altera `qr_payload` (QR Code e link NFC permanecem os mesmos).
 */
export async function updateAnimal(
  animalId: string,
  tutorId: string,
  values: PetFormValues,
): Promise<Animal> {
  const existing = await getAnimalById(animalId)
  if (!existing) {
    throw new Error('Pet não encontrado')
  }
  if (existing.tutor_id !== tutorId) {
    throw new Error('Você não tem permissão para editar este pet')
  }

  const fotoSlots = collectFotoSlots(values)
  const filled = fotoSlots.filter(slotTemFoto)
  if (filled.length < 1) {
    throw new Error('Mantenha ao menos 1 foto do pet.')
  }
  for (const slot of filled) {
    if (slot.file instanceof File) validatePetFotoFile(slot.file)
  }

  // Nunca inclui qr_payload — tag (QR/NFC) é imutável após o cadastro
  const fields = mapFormToAnimalFields(values, {
    origem: 'tutor/pets/editar',
    consentimentoExistenteEm: existing.consentimento_fotos_em,
  })

  const { error } = await supabase
    .from('animais')
    .update(fields)
    .eq('id', animalId)
    .eq('tutor_id', tutorId)

  if (error) {
    if (error.code === '23505' && error.message.toLowerCase().includes('microchip')) {
      throw new Error('Este número de microchip já está cadastrado.')
    }
    throw error
  }

  await syncAnimalFotos(tutorId, animalId, fotoSlots)

  const { data: updated, error: reloadError } = await supabase
    .from('animais')
    .select('*')
    .eq('id', animalId)
    .single()

  if (reloadError) throw reloadError

  if (
    existing.qr_payload &&
    updated.qr_payload !== existing.qr_payload
  ) {
    throw new Error(
      'Falha de integridade: o QR/link da tag não pode ser alterado.',
    )
  }

  return updated as Animal
}

/** Marca o pedido da tag física (etapa anterior ao pagamento futuro). */
export async function solicitarTag(animalId: string): Promise<Animal> {
  const existing = await getAnimalById(animalId)
  if (!existing) throw new Error('Pet não encontrado')
  if (existing.tag_status === 'registrada' || existing.qr_payload) {
    return existing
  }

  const { data, error } = await supabase
    .from('animais')
    .update({ tag_status: 'solicitada' })
    .eq('id', animalId)
    .select('*')
    .single()

  if (error) throw error
  return data as Animal
}

/**
 * Gera o payload único e marca a tag como registrada (QR + NFC disponíveis).
 * Futuro: só após confirmação de pagamento.
 */
export async function gerarTagDigital(animalId: string): Promise<Animal> {
  const existing = await getAnimalById(animalId)
  if (!existing) throw new Error('Pet não encontrado')

  if (existing.qr_payload) {
    if (existing.tag_status !== 'registrada') {
      const { data, error } = await supabase
        .from('animais')
        .update({ tag_status: 'registrada' })
        .eq('id', animalId)
        .select('*')
        .single()
      if (error) throw error
      return data as Animal
    }
    return existing
  }

  if (existing.tag_status === 'nao_solicitada') {
    throw new Error('Solicite a tag antes de gerar o QR Code e o NFC.')
  }

  const qrPayload = generateQrPayload()
  const { data, error } = await supabase
    .from('animais')
    .update({
      qr_payload: qrPayload,
      tag_status: 'registrada',
    })
    .eq('id', animalId)
    .select('*')
    .single()

  if (error) throw error
  return data as Animal
}
