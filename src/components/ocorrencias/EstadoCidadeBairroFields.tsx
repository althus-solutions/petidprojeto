import { useEffect, useState } from 'react'
import { Select } from '@/components/ui/Input'
import {
  ESTADOS_UF,
  fetchBairrosByCidadeUf,
  fetchCidadesByUf,
  geocodeBairroDigitado,
  type BairroOption,
  type CidadeOption,
} from '@/lib/localidades-br'

export interface LocalidadeConfirmada {
  estado: string
  cidade: string
  bairro: string
  latitude: number
  longitude: number
}

interface EstadoCidadeBairroFieldsProps {
  estado: string
  cidade: string
  bairro: string
  disabled?: boolean
  onEstadoChange: (uf: string) => void
  onCidadeChange: (cidade: string) => void
  onBairroChange: (bairro: string) => void
  onConfirm: (local: LocalidadeConfirmada) => void
  onClearConfirmation: () => void
}

export function EstadoCidadeBairroFields({
  estado,
  cidade,
  bairro,
  disabled,
  onEstadoChange,
  onCidadeChange,
  onBairroChange,
  onConfirm,
  onClearConfirmation,
}: EstadoCidadeBairroFieldsProps) {
  const [cidades, setCidades] = useState<CidadeOption[]>([])
  const [bairros, setBairros] = useState<BairroOption[]>([])
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [loadingBairros, setLoadingBairros] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subLabelClass = 'text-[12.5px] font-semibold text-gray-500'

  useEffect(() => {
    if (!estado) {
      setCidades([])
      return
    }

    const controller = new AbortController()
    setLoadingCidades(true)
    setError(null)

    void fetchCidadesByUf(estado, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setCidades(list)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setCidades([])
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar cidades.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCidades(false)
      })

    return () => controller.abort()
  }, [estado])

  useEffect(() => {
    if (!estado || !cidade) {
      setBairros([])
      return
    }

    const controller = new AbortController()
    setLoadingBairros(true)
    setError(null)

    void fetchBairrosByCidadeUf(cidade, estado, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setBairros(list)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setBairros([])
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar bairros.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBairros(false)
      })

    return () => controller.abort()
  }, [estado, cidade])

  async function confirmarLocal(nomeBairro: string) {
    if (!estado || !cidade || !nomeBairro.trim()) return

    setConfirming(true)
    setError(null)
    onClearConfirmation()
    onBairroChange(nomeBairro)

    try {
      const geo = await geocodeBairroDigitado(nomeBairro, cidade, estado)
      if (!geo || geo.latitude == null || geo.longitude == null) {
        // Bairro já está escolhido na lista; coords são internas ao matching.
        // Sem mensagem ao usuário — o submit pede só a seleção do bairro.
        return
      }

      onConfirm({
        estado,
        cidade,
        bairro: nomeBairro.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
      })
    } catch {
      /* silencioso — seleção do bairro permanece */
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Estado *"
          labelClassName={subLabelClass}
          value={estado}
          disabled={disabled}
          onChange={(e) => {
            onEstadoChange(e.target.value)
            onCidadeChange('')
            onBairroChange('')
            onClearConfirmation()
          }}
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
          labelClassName={subLabelClass}
          value={cidade}
          disabled={disabled || !estado || loadingCidades}
          onChange={(e) => {
            onCidadeChange(e.target.value)
            onBairroChange('')
            onClearConfirmation()
          }}
          hint={loadingCidades ? 'Carregando cidades…' : undefined}
        >
          <option value="">
            {!estado ? 'Selecione' : loadingCidades ? 'Carregando…' : 'Selecione'}
          </option>
          {cidades.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </Select>

        <Select
          label="Bairro *"
          labelClassName={subLabelClass}
          value={bairro}
          disabled={
            disabled ||
            !cidade ||
            loadingBairros ||
            confirming ||
            bairros.length === 0
          }
          onChange={(e) => {
            const nome = e.target.value
            if (nome) void confirmarLocal(nome)
          }}
          hint={
            loadingBairros
              ? 'Carregando bairros…'
              : confirming
                ? 'Confirmando localização…'
                : undefined
          }
        >
          <option value="">
            {!cidade ? 'Selecione' : loadingBairros ? 'Carregando…' : 'Selecione'}
          </option>
          {bairros.map((b) => (
            <option key={b.id} value={b.nome}>
              {b.nome}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
