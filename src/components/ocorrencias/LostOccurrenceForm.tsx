import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EstadoCidadeBairroFields } from '@/components/ocorrencias/EstadoCidadeBairroFields'
import { authLinkClassName } from '@/components/auth/AuthForm'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import {
  abrirOcorrenciaPerdido,
  mapOcorrenciaError,
  uploadFotoDiaOcorrencia,
} from '@/lib/ocorrencias'
import { validatePetFotoFile } from '@/lib/pets'
import type { Animal } from '@/types/pet'
import {
  CONSENTIMENTO_OCORRENCIA_TEXTO,
  type ComIdentificacao,
} from '@/types/ocorrencia'

interface LostOccurrenceFormProps {
  animal: Animal
  onSuccess?: () => void
}

/** Raio interno de matching — não exposto ao tutor na abertura. */
const RAIO_MATCHING_INTERNO_KM = 2 as const

export function LostOccurrenceForm({
  animal,
  onSuccess,
}: LostOccurrenceFormProps) {
  const { user } = useAuth()

  const [dataPerda, setDataPerda] = useState(
    () => new Date().toISOString().split('T')[0],
  )
  const [horarioDesconhecido, setHorarioDesconhecido] = useState(true)
  const [horarioPerda, setHorarioPerda] = useState('')
  const [comIdentificacao, setComIdentificacao] =
    useState<ComIdentificacao>('nao_sei')
  const [circunstancias, setCircunstancias] = useState('')
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [bairro, setBairro] = useState('')
  const [localConfirmado, setLocalConfirmado] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [contatoAlternativo, setContatoAlternativo] = useState('')
  const [fotoDia, setFotoDia] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [consentimento, setConsentimento] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const podeEnviar = useMemo(() => {
    if (!consentimento || loading) return false
    if (!estado.trim() || !cidade.trim() || !bairro.trim()) return false
    return localConfirmado && lat != null && lng != null
  }, [
    consentimento,
    loading,
    estado,
    cidade,
    bairro,
    localConfirmado,
    lat,
    lng,
  ])

  function handleFotoChange(file: File | null) {
    if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
    if (!file) {
      setFotoDia(null)
      setFotoPreview(null)
      return
    }
    try {
      validatePetFotoFile(file)
      setFotoDia(file)
      setFotoPreview(URL.createObjectURL(file))
      setError(null)
    } catch (err) {
      setFotoDia(null)
      setFotoPreview(null)
      setError(err instanceof Error ? err.message : 'Foto inválida')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!consentimento) {
      setError('Marque o consentimento para compartilhar este caso de busca.')
      return
    }

    const estadoTrim = estado.trim().toUpperCase()
    const cidadeTrim = cidade.trim()
    const bairroTrim = bairro.trim()
    if (!estadoTrim || estadoTrim.length !== 2 || !cidadeTrim || !bairroTrim) {
      setError('Selecione estado (UF), cidade e bairro nas listas.')
      return
    }

    if (!localConfirmado || lat == null || lng == null) {
      setError('Selecione o bairro na lista para confirmar a região.')
      return
    }

    const latitude = lat
    const longitude = lng

    if (!horarioDesconhecido && !horarioPerda) {
      setError('Informe o horário aproximado ou marque “não sei o horário”.')
      return
    }

    setLoading(true)

    try {
      if (!user?.tutor?.id) {
        throw new Error('Perfil de tutor não encontrado.')
      }

      let fotoDiaPath: string | null = null
      if (fotoDia) {
        fotoDiaPath = await uploadFotoDiaOcorrencia(
          user.tutor.id,
          animal.id,
          fotoDia,
        )
      }

      await abrirOcorrenciaPerdido({
        animalId: animal.id,
        dataPerda,
        latitude,
        longitude,
        estado: estadoTrim,
        cidade: cidadeTrim,
        bairro: bairroTrim,
        enderecoAproximado: `${bairroTrim}, ${cidadeTrim} - ${estadoTrim}`,
        retroativa: false,
        horarioPerda: horarioDesconhecido ? null : horarioPerda,
        horarioDesconhecido,
        comIdentificacao,
        circunstancias: circunstancias.trim() || undefined,
        fotoDiaPath,
        raioBuscaKm: RAIO_MATCHING_INTERNO_KM,
        contatoAlternativo: contatoAlternativo.trim() || undefined,
        fonteLocalizacao: 'autocomplete',
        consentimentoOcorrencia: true,
      })

      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(
        mapOcorrenciaError(
          err instanceof Error ? err.message : 'Erro ao abrir ocorrência.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-[14px] bg-[#E7F8EF] px-4 py-4 text-[#1F9D55]">
          <h2 className="font-display text-lg font-extrabold">
            Ocorrência aberta
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            A perda de <strong>{animal.nome}</strong> em{' '}
            <strong>
              {bairro}, {cidade} - {estado}
            </strong>{' '}
            foi registrada.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Você será notificado se houver um match com animais resgatados na
            região. Em breve também poderemos alertar a comunidade do bairro.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/tutor/ocorrencias" className={authLinkClassName}>
            Ver no mapa de ocorrências →
          </Link>
          <Link to={`/tutor/pets/${animal.id}`} className={authLinkClassName}>
            Voltar ao pet
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <p className="text-sm text-gray-500">
        Abra uma ocorrência para{' '}
        <strong className="text-brand-dark">{animal.nome}</strong>. Informe a
        região (UF, cidade e bairro) — sem rua ou número.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Data da perda *"
          type="date"
          required
          value={dataPerda}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => setDataPerda(e.target.value)}
        />
        <div className="space-y-2">
          <Input
            label="Horário aproximado"
            type="time"
            disabled={horarioDesconhecido}
            value={horarioPerda}
            onChange={(e) => setHorarioPerda(e.target.value)}
          />
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={horarioDesconhecido}
              onChange={(e) => {
                setHorarioDesconhecido(e.target.checked)
                if (e.target.checked) setHorarioPerda('')
              }}
              className="mt-0.5 accent-brand-500"
            />
            <span className="text-gray-600">Não sei o horário</span>
          </label>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[13.5px] font-bold text-brand-dark">
          Estava com coleira/tag/NFC no momento da perda? *
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['sim', 'Sim'],
              ['nao', 'Não'],
              ['nao_sei', 'Não sei'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={[
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                comIdentificacao === value
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-surface-border bg-white text-gray-600 hover:border-brand-500',
              ].join(' ')}
            >
              <input
                type="radio"
                name="com_identificacao"
                value={value}
                checked={comIdentificacao === value}
                onChange={() => setComIdentificacao(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[13.5px] font-bold text-brand-dark">
          Local da perda *
        </legend>
        <EstadoCidadeBairroFields
          estado={estado}
          cidade={cidade}
          bairro={bairro}
          onEstadoChange={setEstado}
          onCidadeChange={setCidade}
          onBairroChange={setBairro}
          onClearConfirmation={() => {
            setLocalConfirmado(false)
            setLat(null)
            setLng(null)
          }}
          onConfirm={(local) => {
            setEstado(local.estado)
            setCidade(local.cidade)
            setBairro(local.bairro)
            setLat(local.latitude)
            setLng(local.longitude)
            setLocalConfirmado(true)
          }}
        />
      </fieldset>

      <Textarea
        label="Circunstâncias da perda (opcional)"
        rows={3}
        value={circunstancias}
        onChange={(e) => setCircunstancias(e.target.value)}
        placeholder="Forneça o máximo de detalhes sobre o momento da perda…"
        hint="Ex.: fugiu durante o banho, arrombou o portão, saiu assustado com fogos. Quanto mais contexto, melhor para quem estiver ajudando na busca."
      />

      <div className="space-y-2">
        <span className="text-[13.5px] font-bold text-brand-dark">
          Foto “como estava no dia” (opcional)
        </span>
        <p className="text-[12.5px] text-gray-500">
          Útil se o pet estava com acessório diferente, tosado ou machucado. Se
          não enviar, usamos as fotos do perfil.
        </p>
        {fotoPreview && (
          <img
            src={fotoPreview}
            alt="Prévia da foto do dia"
            className="h-36 w-full max-w-xs rounded-xl object-contain bg-brand-50"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer">
            <span className="rounded-full border-[1.5px] border-brand-500 bg-white px-3 py-1.5 text-[12px] font-bold text-brand-500 hover:bg-brand-50">
              {fotoDia ? 'Trocar foto' : 'Escolher foto'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) =>
                handleFotoChange(e.target.files?.[0] ?? null)
              }
            />
          </label>
          {fotoDia && (
            <button
              type="button"
              className="text-[12px] font-semibold text-gray-400 hover:text-red-600"
              onClick={() => handleFotoChange(null)}
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <Input
        label="Contato alternativo para este caso (opcional)"
        type="text"
        value={contatoAlternativo}
        onChange={(e) => setContatoAlternativo(e.target.value)}
        placeholder="Outro número ou canal (WhatsApp, etc.)"
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-surface-border bg-[#fbfaff] px-4 py-3.5">
        <input
          type="checkbox"
          className="mt-1 accent-brand-500"
          checked={consentimento}
          onChange={(e) => setConsentimento(e.target.checked)}
        />
        <span className="text-[13px] leading-relaxed text-gray-600">
          {CONSENTIMENTO_OCORRENCIA_TEXTO}
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        variant="primary"
        disabled={!podeEnviar}
        className="w-full"
      >
        {loading ? 'Abrindo ocorrência…' : 'Abrir ocorrência de perda'}
      </Button>
    </form>
  )
}
