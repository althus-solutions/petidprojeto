import { supabase } from '@/lib/supabase'
import type { Animal, ColunaAnimal, PetFormValues } from '@/types/pet'

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
  return data ?? []
}

export async function getAnimalById(animalId: string): Promise<Animal | null> {
  const { data, error } = await supabase
    .from('animais')
    .select('*')
    .eq('id', animalId)
    .maybeSingle()

  if (error) throw error
  return data
}

function mapFormToAnimalRow(
  values: PetFormValues,
  tutorId: string,
  qrPayload: string,
) {
  const row: Record<string, unknown> = {
    tutor_id: tutorId,
    qr_payload: qrPayload,
  }

  const colunas: ColunaAnimal[] = [
    'nome',
    'especie',
    'raca',
    'porte',
    'cor',
    'peso',
    'caracteristicas',
  ]

  for (const coluna of colunas) {
    const valor = values[coluna]
    if (valor === undefined || valor === null || valor === '') {
      row[coluna] = coluna === 'nome' ? '' : null
      continue
    }
    row[coluna] = coluna === 'peso' ? Number(valor) : String(valor)
  }

  if (!row.nome) {
    throw new Error('Nome do pet é obrigatório')
  }

  return row
}

export async function uploadPetPhoto(
  tutorId: string,
  animalId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${tutorId}/${animalId}/foto.${ext}`

  const { error } = await supabase.storage.from(BUCKET_PETS).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })

  if (error) throw error
  return path
}

export async function getPetPhotoSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_PETS)
    .createSignedUrl(storagePath, expiresIn)

  if (error) return null
  return data.signedUrl
}

export async function createAnimal(
  tutorId: string,
  values: PetFormValues,
): Promise<Animal> {
  const qrPayload = generateQrPayload()
  const row = mapFormToAnimalRow(values, tutorId, qrPayload)

  const { data: animal, error } = await supabase
    .from('animais')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error

  const foto = values.foto
  if (foto instanceof File) {
    const path = await uploadPetPhoto(tutorId, animal.id, foto)
    const { data: updated, error: updateError } = await supabase
      .from('animais')
      .update({ foto_url: path })
      .eq('id', animal.id)
      .select('*')
      .single()

    if (updateError) throw updateError
    return updated
  }

  return animal
}
