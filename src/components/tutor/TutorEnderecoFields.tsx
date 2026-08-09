import { useEffect, useRef, useState } from 'react'
import { Select, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  geocodeEnderecoCompleto,
  GoogleGeocodeError,
  hasGoogleGeocodingKey,
} from '@/lib/geocode'
import {
  ESTADOS_UF,
  fetchCidadesByUf,
  fetchEnderecoByCep,
  type CidadeOption,
} from '@/lib/localidades-br'
import type { TutorEndereco } from '@/types/tutor-endereco'

export type TutorEnderecoDraft = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  latitude: number | null
  longitude: number | null
}

const EMPTY: TutorEnderecoDraft = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  latitude: null,
  longitude: null,
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function fromSaved(e: TutorEndereco | null | undefined): TutorEnderecoDraft {
  if (!e) return { ...EMPTY }
  return {
    cep: e.cep ? formatCep(e.cep) : '',
    logradouro: e.logradouro,
    numero: e.numero ?? '',
    complemento: e.complemento ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade,
    estado: e.estado,
    latitude: e.latitude,
    longitude: e.longitude,
  }
}

interface TutorEnderecoFieldsProps {
  initial?: TutorEndereco | null
  disabled?: boolean
  onSave: (endereco: TutorEnderecoDraft) => Promise<void>
  onRemove?: () => Promise<void>
}

export function TutorEnderecoFields({
  initial,
  disabled,
  onSave,
  onRemove,
}: TutorEnderecoFieldsProps) {
  const [draft, setDraft] = useState<TutorEnderecoDraft>(() => fromSaved(initial))
  const [cidades, setCidades] = useState<CidadeOption[]>([])
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const numeroRef = useRef<HTMLInputElement>(null)
  const lastCepFetched = useRef<string>('')

  useEffect(() => {
    setDraft(fromSaved(initial))
    lastCepFetched.current = ''
  }, [initial])

  useEffect(() => {
    if (!draft.estado) {
      setCidades([])
      return
    }
    const controller = new AbortController()
    setLoadingCidades(true)
    void fetchCidadesByUf(draft.estado, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setCidades(list)
      })
      .catch(() => {
        if (!controller.signal.aborted) setCidades([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCidades(false)
      })
    return () => controller.abort()
  }, [draft.estado])

  // Auto-preenche rua/UF/cidade/bairro ao completar o CEP
  useEffect(() => {
    const digits = draft.cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    if (digits === lastCepFetched.current) return

    const controller = new AbortController()
    setLoadingCep(true)
    setError(null)
    setOk(null)

    void fetchEnderecoByCep(digits, controller.signal)
      .then((addr) => {
        if (controller.signal.aborted) return
        lastCepFetched.current = digits
        if (!addr) {
          setError('CEP não encontrado. Confira o número ou preencha manualmente.')
          return
        }
        setDraft((prev) => ({
          ...prev,
          cep: formatCep(addr.cep),
          logradouro: addr.logradouro || prev.logradouro,
          bairro: addr.bairro || prev.bairro,
          cidade: addr.cidade,
          estado: addr.estado,
          complemento: prev.complemento || addr.complemento || '',
          latitude: null,
          longitude: null,
        }))
        setOk('Endereço preenchido pelo CEP. Informe o número e salve no mapa.')
        requestAnimationFrame(() => numeroRef.current?.focus())
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível consultar o CEP.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCep(false)
      })

    return () => controller.abort()
  }, [draft.cep])

  function patch(p: Partial<TutorEnderecoDraft>) {
    setDraft((prev) => ({
      ...prev,
      ...p,
      latitude: p.latitude !== undefined ? p.latitude : null,
      longitude: p.longitude !== undefined ? p.longitude : null,
    }))
    setOk(null)
    setError(null)
  }

  async function handleLocateAndSave() {
    setSaving(true)
    setLocating(true)
    setError(null)
    setOk(null)
    try {
      const geo = await geocodeEnderecoCompleto({
        logradouro: draft.logradouro,
        numero: draft.numero || undefined,
        bairro: draft.bairro || undefined,
        cidade: draft.cidade,
        estado: draft.estado,
      })
      if (!geo) {
        setError(
          'Não encontramos este endereço. Confira rua, número, bairro e cidade.',
        )
        return
      }
      const next = {
        ...draft,
        latitude: geo.latitude,
        longitude: geo.longitude,
      }
      setDraft(next)
      await onSave(next)
      if (geo.precisao === 'numero') {
        setOk('Salvo no mapa com localização precisa do número.')
      } else if (geo.provider === 'google') {
        setOk(
          'Salvo no mapa. A precisão do número neste endereço é limitada pelo provedor.',
        )
      } else if (!hasGoogleGeocodingKey()) {
        setOk(
          'Salvo com posição aproximada da rua. Para precisão do número, configure VITE_GOOGLE_MAPS_API_KEY (Geocoding API) e salve de novo.',
        )
      } else {
        setOk('Salvo no mapa (posição aproximada da rua).')
      }
    } catch (err) {
      if (err instanceof GoogleGeocodeError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao salvar endereço.')
      }
    } finally {
      setLocating(false)
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!onRemove) return
    setRemoving(true)
    setError(null)
    try {
      await onRemove()
      setDraft({ ...EMPTY })
      lastCepFetched.current = ''
      setOk('Endereço removido.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover.')
    } finally {
      setRemoving(false)
    }
  }

  const subLabel = 'text-[12.5px] font-semibold text-gray-500'
  const cepOk = Boolean(draft.logradouro && draft.cidade && draft.estado)

  return (
    <div className="space-y-3">
      <Input
        label="CEP *"
        labelClassName={subLabel}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        value={draft.cep}
        disabled={disabled || loadingCep}
        onChange={(e) => {
          const formatted = formatCep(e.target.value)
          const digits = formatted.replace(/\D/g, '')
          if (digits.length < 8) lastCepFetched.current = ''
          patch({ cep: formatted })
        }}
        hint={
          loadingCep
            ? 'Buscando endereço…'
            : 'Digite o CEP — preenchemos rua, bairro, cidade e estado.'
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          ref={numeroRef}
          label="Número *"
          labelClassName={subLabel}
          placeholder="123"
          value={draft.numero}
          disabled={disabled}
          onChange={(e) => patch({ numero: e.target.value })}
        />
        <div className="sm:col-span-2">
          <Input
            label="Complemento"
            labelClassName={subLabel}
            placeholder="Apto, bloco…"
            value={draft.complemento}
            disabled={disabled}
            onChange={(e) => patch({ complemento: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Rua / logradouro *"
            labelClassName={subLabel}
            autoComplete="street-address"
            placeholder="Preenchido pelo CEP"
            value={draft.logradouro}
            disabled={disabled}
            onChange={(e) => patch({ logradouro: e.target.value })}
          />
        </div>
        <Select
          label="Estado *"
          labelClassName={subLabel}
          value={draft.estado}
          disabled={disabled}
          onChange={(e) =>
            patch({ estado: e.target.value, cidade: '', bairro: draft.bairro })
          }
        >
          <option value="">UF</option>
          {ESTADOS_UF.map((uf) => (
            <option key={uf.sigla} value={uf.sigla}>
              {uf.sigla}
            </option>
          ))}
        </Select>
        <Select
          label="Cidade *"
          labelClassName={subLabel}
          value={draft.cidade}
          disabled={disabled || !draft.estado || loadingCidades}
          onChange={(e) => patch({ cidade: e.target.value })}
          hint={loadingCidades ? 'Carregando…' : undefined}
        >
          <option value="">Selecione</option>
          {cidades.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
          {/* Garante opção do ViaCEP mesmo antes da lista IBGE carregar */}
          {draft.cidade &&
            !cidades.some((c) => c.nome === draft.cidade) && (
              <option value={draft.cidade}>{draft.cidade}</option>
            )}
        </Select>
        <div className="sm:col-span-2">
          <Input
            label="Bairro"
            labelClassName={subLabel}
            placeholder="Preenchido pelo CEP"
            value={draft.bairro}
            disabled={disabled}
            onChange={(e) => patch({ bairro: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={
            disabled ||
            saving ||
            loadingCep ||
            !cepOk ||
            !draft.numero.trim()
          }
          onClick={() => void handleLocateAndSave()}
        >
          {locating || saving ? 'Localizando…' : 'Salvar no mapa'}
        </Button>
        {initial?.id && onRemove && (
          <button
            type="button"
            className="text-[12.5px] font-semibold text-gray-400 hover:text-red-600"
            disabled={disabled || removing || saving}
            onClick={() => void handleRemove()}
          >
            {removing ? 'Removendo…' : 'Remover endereço'}
          </button>
        )}
        {draft.latitude != null && draft.longitude != null && (
          <span className="text-[12px] font-medium text-[#1F9D55]">
            Endereço no mapa
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {ok && <p className="text-xs font-medium text-[#1F9D55]">{ok}</p>}
    </div>
  )
}
