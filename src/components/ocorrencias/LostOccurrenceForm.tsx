import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authLinkClassName } from '@/components/auth/AuthForm'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getGeolocation } from '@/lib/geolocation'
import { abrirOcorrenciaPerdido, mapOcorrenciaError } from '@/lib/ocorrencias'
import type { Animal } from '@/types/pet'

interface LostOccurrenceFormProps {
  animal: Animal
  onSuccess?: () => void
}

export function LostOccurrenceForm({ animal, onSuccess }: LostOccurrenceFormProps) {
  const [dataPerda, setDataPerda] = useState(
    () => new Date().toISOString().split('T')[0],
  )
  const [endereco, setEndereco] = useState('')
  const [retroativa, setRetroativa] = useState(false)
  const [latManual, setLatManual] = useState('')
  const [lngManual, setLngManual] = useState('')
  const [usarManual, setUsarManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let latitude: number
      let longitude: number

      if (usarManual) {
        latitude = Number(latManual)
        longitude = Number(lngManual)
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
          throw new Error('Latitude e longitude inválidas.')
        }
      } else {
        const position = await getGeolocation()
        latitude = position.coords.latitude
        longitude = position.coords.longitude
      }

      await abrirOcorrenciaPerdido({
        animalId: animal.id,
        dataPerda,
        latitude,
        longitude,
        enderecoAproximado: endereco.trim() || undefined,
        retroativa,
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
          <h2 className="font-bold">Ocorrência aberta</h2>
          <p className="mt-2 text-sm">
            A perda de <strong>{animal.nome}</strong> foi registrada. O sistema
            buscará matches com animais resgatados na região.
          </p>
        </div>
        <Link to={`/tutor/pets/${animal.id}`} className={authLinkClassName}>
          Voltar ao pet
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <p className="text-sm text-gray-500">
        Abra uma ocorrência para <strong className="text-brand-dark">{animal.nome}</strong>.
        A localização ajuda no matching com registros de resgate na região.
      </p>

      <Input
        label="Data da perda *"
        type="date"
        required
        value={dataPerda}
        max={new Date().toISOString().split('T')[0]}
        onChange={(e) => setDataPerda(e.target.value)}
      />

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={retroativa}
          onChange={(e) => setRetroativa(e.target.checked)}
          className="mt-0.5 accent-brand-500"
        />
        <span className="text-gray-600">
          Perda retroativa (animal já estava perdido antes de usar a plataforma)
        </span>
      </label>

      <Input
        label="Endereço aproximado"
        type="text"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
        placeholder="Ex.: Rua das Flores, Centro"
      />

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={usarManual}
          onChange={(e) => setUsarManual(e.target.checked)}
          className="mt-0.5 accent-brand-500"
        />
        <span className="text-gray-600">Informar coordenadas manualmente</span>
      </label>

      {usarManual ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Latitude *"
            type="number"
            step="any"
            required
            value={latManual}
            onChange={(e) => setLatManual(e.target.value)}
          />
          <Input
            label="Longitude *"
            type="number"
            step="any"
            required
            value={lngManual}
            onChange={(e) => setLngManual(e.target.value)}
          />
        </div>
      ) : (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-dark">
          Ao enviar, o navegador solicitará permissão para usar sua localização
          atual como referência do local da perda.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Abrindo ocorrência…' : 'Abrir ocorrência de perda'}
      </Button>
    </form>
  )
}
