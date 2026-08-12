import { supabase } from '@/lib/supabase'
import { listAnimalFotos, getPetPhotoSignedUrl } from '@/lib/pets'
import { CORES_PADRAO } from '@/types/pet'
import type {
  AdocaoFilters,
  AdocaoFormValues,
  AdocaoMidia,
  ListagemAdocao,
  ListagemAdocaoCard,
} from '@/types/adocao'

const BUCKET = 'pets'

export function emptyAdocaoForm(
  defaults?: Partial<AdocaoFormValues>,
): AdocaoFormValues {
  return {
    modoOrigem: 'novo',
    animal_id: null,
    nome: '',
    especie: 'cao',
    raca: 'SRD',
    sexo: 'nao_sei',
    idade_faixa: 'adulto',
    porte: 'medio',
    peso_kg: '',
    cores: [],
    cor_outro: '',
    padrao_pelagem: 'Sólido',
    castrado: 'nao_sei',
    vacinado: 'nao',
    vacinas_detalhe: '',
    vermifugado: 'nao',
    vermifugo_ultima_dose: '',
    microchipado: false,
    microchip: '',
    deficiencias: [],
    condicao_cronica: '',
    historico_doencas: '',
    medicacao_continua: false,
    medicacao_detalhe: '',
    restricoes_alimentares: '',
    mobilidade: 'normal',
    energia: 'medio',
    sociavel_caes: 'com_cautela',
    sociavel_gatos: 'com_cautela',
    sociavel_criancas: 'com_cautela',
    criancas_idade_minima: '',
    convive_sozinho: null,
    adestramento_basico: null,
    comportamentos_atencao: '',
    sociabilidade_estranhos: 'media',
    origem: 'outro',
    tempo_sob_cuidado: '',
    viveu_em_lar: null,
    motivo_retorno: '',
    observacoes_protetor: '',
    moradia_recomendada: 'indiferente',
    precisa_companheiro: null,
    aceita_criancas: null,
    aceita_criancas_idade_min: '',
    exige_tela_janelas: null,
    cidade_preferencial: '',
    regiao_preferencial: '',
    estado_preferencial: '',
    acompanhamento_pos: false,
    acompanhamento_detalhe: '',
    responsavel_nome: '',
    responsavel_contato: '',
    responsavel_tipo: 'tutor',
    status: 'disponivel',
    taxa_adocao_aplica: false,
    taxa_adocao_valor: '',
    fotos: [],
    fotoPathsExistentes: [],
    video: null,
    aceite_termo: false,
    aceite_lgpd: false,
    aceite_taxa: false,
    ...defaults,
  }
}

function mapCores(values: AdocaoFormValues): string[] {
  return values.cores.map((c) =>
    c === 'Outro' && values.cor_outro.trim()
      ? `Outro: ${values.cor_outro.trim()}`
      : c,
  )
}

function formToRow(
  values: AdocaoFormValues,
  tutorId: string,
): Record<string, unknown> {
  const now = new Date().toISOString()
  const cores = mapCores(values)

  return {
    tutor_id: tutorId,
    animal_id:
      values.modoOrigem === 'pet_existente' ? values.animal_id : null,
    nome: values.nome.trim() || 'Sem nome',
    especie: values.especie,
    raca: values.raca.trim() || 'SRD',
    sexo: values.sexo,
    idade_faixa: values.idade_faixa,
    porte: values.porte,
    peso_kg: values.peso_kg ? Number(values.peso_kg) : null,
    cores: cores.length ? cores : null,
    padrao_pelagem: values.padrao_pelagem || null,
    castrado: values.castrado,
    vacinado: values.vacinado,
    vacinas_detalhe: values.vacinas_detalhe.trim() || null,
    vermifugado: values.vermifugado,
    vermifugo_ultima_dose: values.vermifugo_ultima_dose || null,
    microchipado: values.microchipado,
    microchip: values.microchip.trim() || null,
    deficiencias: values.deficiencias.length ? values.deficiencias : null,
    condicao_cronica: values.condicao_cronica.trim() || null,
    historico_doencas: values.historico_doencas.trim() || null,
    medicacao_continua: values.medicacao_continua,
    medicacao_detalhe: values.medicacao_detalhe.trim() || null,
    restricoes_alimentares: values.restricoes_alimentares.trim() || null,
    mobilidade: values.mobilidade,
    energia: values.energia,
    sociavel_caes: values.sociavel_caes,
    sociavel_gatos: values.sociavel_gatos,
    sociavel_criancas: values.sociavel_criancas,
    criancas_idade_minima: values.criancas_idade_minima
      ? Number(values.criancas_idade_minima)
      : null,
    convive_sozinho: values.convive_sozinho,
    adestramento_basico: values.adestramento_basico,
    comportamentos_atencao: values.comportamentos_atencao.trim() || null,
    sociabilidade_estranhos: values.sociabilidade_estranhos,
    origem: values.origem,
    tempo_sob_cuidado: values.tempo_sob_cuidado.trim() || null,
    viveu_em_lar: values.viveu_em_lar,
    motivo_retorno: values.motivo_retorno.trim() || null,
    observacoes_protetor: values.observacoes_protetor.trim() || null,
    moradia_recomendada: values.moradia_recomendada,
    precisa_companheiro: values.precisa_companheiro,
    aceita_criancas: values.aceita_criancas,
    aceita_criancas_idade_min: values.aceita_criancas_idade_min
      ? Number(values.aceita_criancas_idade_min)
      : null,
    exige_tela_janelas: values.exige_tela_janelas,
    cidade_preferencial: values.cidade_preferencial.trim() || null,
    regiao_preferencial: values.regiao_preferencial.trim() || null,
    estado_preferencial: values.estado_preferencial.trim().toUpperCase() || null,
    acompanhamento_pos: values.acompanhamento_pos,
    acompanhamento_detalhe: values.acompanhamento_detalhe.trim() || null,
    responsavel_nome: values.responsavel_nome.trim() || null,
    responsavel_contato: values.responsavel_contato.trim() || null,
    responsavel_tipo: values.responsavel_tipo,
    status: values.status,
    taxa_adocao_aplica: values.taxa_adocao_aplica,
    taxa_adocao_valor:
      values.taxa_adocao_aplica && values.taxa_adocao_valor
        ? Number(values.taxa_adocao_valor)
        : null,
    termo_adocao_aceito_em: now,
    termo_adocao_contexto: {
      fluxo: 'adocao_telecao',
      versao: '1.0',
      aceito_em: now,
    },
    consentimento_lgpd_em: now,
    consentimento_lgpd_contexto: {
      fluxo: 'adocao_telecao',
      versao: '1.0',
      aceito_em: now,
    },
    taxa_aceite_em:
      values.taxa_adocao_aplica && values.aceite_taxa ? now : null,
  }
}

export async function listListagensAdocao(
  filters: AdocaoFilters = {},
): Promise<ListagemAdocaoCard[]> {
  let query = supabase
    .from('listagens_adocao')
    .select('*')
    .in('status', ['disponivel', 'em_processo'])
    .order('created_at', { ascending: false })

  if (filters.especie) query = query.eq('especie', filters.especie)
  if (filters.sexo) query = query.eq('sexo', filters.sexo)
  if (filters.porte) query = query.eq('porte', filters.porte)
  if (filters.idade_faixa) query = query.eq('idade_faixa', filters.idade_faixa)
  if (filters.castrado) query = query.eq('castrado', filters.castrado)
  if (filters.sociavel_criancas) {
    query = query.eq('sociavel_criancas', filters.sociavel_criancas)
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.cidade?.trim()) {
    query = query.ilike('cidade_preferencial', `%${filters.cidade.trim()}%`)
  }
  if (filters.q?.trim()) {
    query = query.ilike('nome', `%${filters.q.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error

  const listagens = (data ?? []) as ListagemAdocao[]
  return Promise.all(
    listagens.map(async (l) => {
      const midia = await listAdocaoMidia(l.id)
      const capa = midia.find((m) => m.tipo === 'foto')?.storage_path
      const foto_url = capa ? await getAdocaoPhotoSignedUrl(capa) : null
      return { ...l, midia, foto_url }
    }),
  )
}

export async function getListagemAdocao(
  id: string,
): Promise<ListagemAdocaoCard | null> {
  const { data, error } = await supabase
    .from('listagens_adocao')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const listagem = data as ListagemAdocao
  const midia = await listAdocaoMidia(id)
  const capa = midia.find((m) => m.tipo === 'foto')?.storage_path
  const foto_url = capa ? await getAdocaoPhotoSignedUrl(capa) : null
  return { ...listagem, midia, foto_url }
}

export async function listAdocaoMidia(
  listagemId: string,
): Promise<AdocaoMidia[]> {
  const { data, error } = await supabase
    .from('adocao_midia')
    .select('*')
    .eq('listagem_id', listagemId)
    .order('ordem', { ascending: true })

  if (error) throw error
  return (data ?? []) as AdocaoMidia[]
}

export async function getAdocaoPhotoSignedUrl(
  path: string,
): Promise<string | null> {
  return getPetPhotoSignedUrl(path)
}

export async function uploadAdocaoFoto(
  tutorId: string,
  listagemId: string,
  file: File,
  ordem: number,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${tutorId}/adocao/${listagemId}/${ordem}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error
  return path
}

export async function uploadAdocaoVideo(
  tutorId: string,
  listagemId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const path = `${tutorId}/adocao/${listagemId}/video.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'video/mp4',
  })
  if (error) throw error
  return path
}

async function insertMidiaRows(
  listagemId: string,
  items: { path: string; tipo: 'foto' | 'video'; ordem: number }[],
) {
  if (items.length === 0) return
  const { error } = await supabase.from('adocao_midia').insert(
    items.map((i) => ({
      listagem_id: listagemId,
      storage_path: i.path,
      tipo: i.tipo,
      ordem: i.ordem,
    })),
  )
  if (error) throw error
}

export async function createListagemAdocao(
  tutorId: string,
  values: AdocaoFormValues,
): Promise<ListagemAdocao> {
  if (!values.aceite_termo || !values.aceite_lgpd) {
    throw new Error('Aceite o termo de adoção e o consentimento LGPD.')
  }
  if (values.taxa_adocao_aplica && !values.aceite_taxa) {
    throw new Error('Aceite a taxa de adoção para continuar.')
  }
  if (values.modoOrigem === 'pet_existente' && !values.animal_id) {
    throw new Error('Selecione um pet cadastrado.')
  }

  const hasFotos =
    values.fotos.length > 0 || values.fotoPathsExistentes.length > 0
  if (!hasFotos) {
    throw new Error('Envie ao menos uma foto do animal.')
  }

  const row = formToRow(values, tutorId)
  const { data, error } = await supabase
    .from('listagens_adocao')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  const listagem = data as ListagemAdocao

  const midiaItems: { path: string; tipo: 'foto' | 'video'; ordem: number }[] =
    []

  // Paths do pet existente
  for (let i = 0; i < values.fotoPathsExistentes.length; i++) {
    midiaItems.push({
      path: values.fotoPathsExistentes[i],
      tipo: 'foto',
      ordem: i + 1,
    })
  }

  // Novos uploads
  let ordem = midiaItems.length
  for (const file of values.fotos) {
    ordem += 1
    const path = await uploadAdocaoFoto(tutorId, listagem.id, file, ordem)
    midiaItems.push({ path, tipo: 'foto', ordem })
  }

  if (values.video) {
    const path = await uploadAdocaoVideo(tutorId, listagem.id, values.video)
    midiaItems.push({ path, tipo: 'video', ordem: ordem + 1 })
  }

  await insertMidiaRows(listagem.id, midiaItems)
  return listagem
}

export async function updateListagemAdocao(
  listagemId: string,
  tutorId: string,
  values: AdocaoFormValues,
): Promise<ListagemAdocao> {
  if (!values.aceite_termo || !values.aceite_lgpd) {
    throw new Error('Aceite o termo de adoção e o consentimento LGPD.')
  }

  const row = formToRow(values, tutorId)
  delete row.tutor_id

  const { data, error } = await supabase
    .from('listagens_adocao')
    .update(row)
    .eq('id', listagemId)
    .eq('tutor_id', tutorId)
    .select('*')
    .single()

  if (error) throw error
  const listagem = data as ListagemAdocao

  if (values.fotos.length > 0 || values.video) {
    const existing = await listAdocaoMidia(listagemId)
    let ordem = existing.length
    const midiaItems: { path: string; tipo: 'foto' | 'video'; ordem: number }[] =
      []

    for (const file of values.fotos) {
      ordem += 1
      const path = await uploadAdocaoFoto(tutorId, listagemId, file, ordem)
      midiaItems.push({ path, tipo: 'foto', ordem })
    }
    if (values.video) {
      const path = await uploadAdocaoVideo(tutorId, listagemId, values.video)
      midiaItems.push({ path, tipo: 'video', ordem: ordem + 1 })
    }
    await insertMidiaRows(listagemId, midiaItems)
  }

  return listagem
}

export async function prefillFromAnimal(
  animalId: string,
): Promise<Partial<AdocaoFormValues>> {
  const { data, error } = await supabase
    .from('animais')
    .select('*')
    .eq('id', animalId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Pet não encontrado')

  const fotos = await listAnimalFotos(animalId)
  const especieRaw = String(data.especie ?? '').toLowerCase()
  let especie: AdocaoFormValues['especie'] = 'outro'
  if (especieRaw.includes('cão') || especieRaw.includes('cao') || especieRaw.includes('dog')) {
    especie = 'cao'
  } else if (especieRaw.includes('gato') || especieRaw.includes('cat')) {
    especie = 'gato'
  }

  const porteRaw = String(data.porte ?? '').toLowerCase()
  let porte: AdocaoFormValues['porte'] = 'medio'
  if (porteRaw.includes('peq')) porte = 'pequeno'
  else if (porteRaw.includes('gran')) porte = 'grande'
  else if (porteRaw.includes('gig')) porte = 'gigante'

  const coresExistentes = Array.isArray(data.cores)
    ? (data.cores as string[])
    : data.cor
      ? [String(data.cor)]
      : []

  const coresPadrao = coresExistentes.filter((c) =>
    (CORES_PADRAO as readonly string[]).includes(c),
  )
  const corOutro =
    coresExistentes.find((c) => c.startsWith('Outro:'))?.replace(/^Outro:\s*/, '') ??
    ''

  return {
    modoOrigem: 'pet_existente',
    animal_id: animalId,
    nome: data.nome ?? '',
    especie,
    raca: data.raca ?? 'SRD',
    sexo: (data.sexo as AdocaoFormValues['sexo']) ?? 'nao_sei',
    porte,
    peso_kg: data.peso != null ? String(data.peso) : '',
    cores: corOutro ? [...coresPadrao, 'Outro'] : coresPadrao,
    cor_outro: corOutro,
    padrao_pelagem: data.padrao_pelagem
      ? String(data.padrao_pelagem)
      : 'Sólido',
    castrado: (data.castrado as AdocaoFormValues['castrado']) ?? 'nao_sei',
    microchipado: Boolean(data.microchip),
    microchip: data.microchip ?? '',
    fotoPathsExistentes: fotos.map((f) => f.storage_path),
  }
}

export async function manifestarInteresseAdocao(
  listagemId: string,
  mensagem?: string,
): Promise<{ ok: boolean; interesse_id: string }> {
  const { data, error } = await supabase.rpc('manifestar_interesse_adocao', {
    p_listagem_id: listagemId,
    p_mensagem: mensagem ?? null,
  })
  if (error) throw error
  return data as { ok: boolean; interesse_id: string }
}

export async function jaManifestouInteresse(
  listagemId: string,
  tutorId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('interesses_adocao')
    .select('id')
    .eq('listagem_id', listagemId)
    .eq('tutor_interessado_id', tutorId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export function labelEspecie(e: string | null | undefined): string {
  if (e === 'cao') return 'Cão'
  if (e === 'gato') return 'Gato'
  if (e === 'outro') return 'Outro'
  return e ?? '—'
}

export function labelStatus(s: string): string {
  if (s === 'disponivel') return 'Disponível'
  if (s === 'em_processo') return 'Em processo'
  if (s === 'adotado') return 'Adotado'
  return s
}

export function labelPorte(p: string | null | undefined): string {
  const map: Record<string, string> = {
    pequeno: 'Pequeno',
    medio: 'Médio',
    grande: 'Grande',
    gigante: 'Gigante',
  }
  return p ? (map[p] ?? p) : '—'
}
