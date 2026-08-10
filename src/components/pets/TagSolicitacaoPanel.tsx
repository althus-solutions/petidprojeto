import { useState } from 'react'
import { TagPreview } from '@/components/pets/TagPreview'
import { QrCodeDisplay } from '@/components/pets/QrCodeDisplay'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { gerarTagDigital, solicitarTag } from '@/lib/pets'
import type { Animal } from '@/types/pet'

interface TagSolicitacaoPanelProps {
  animal: Animal
  onAnimalChange: (animal: Animal) => void
}

export function TagSolicitacaoPanel({
  animal,
  onAnimalChange,
}: TagSolicitacaoPanelProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = animal.tag_status ?? (animal.qr_payload ? 'registrada' : 'nao_solicitada')
  const registrada = status === 'registrada' && Boolean(animal.qr_payload)

  async function handleSolicitar() {
    setBusy(true)
    setError(null)
    try {
      const updated = await solicitarTag(animal.id)
      onAnimalChange(updated)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível solicitar a tag. Aplique a migration 035.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGerar() {
    setBusy(true)
    setError(null)
    try {
      const updated = await gerarTagDigital(animal.id)
      onAnimalChange(updated)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o QR/NFC. Aplique a migration 035.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (registrada && animal.qr_payload) {
    return (
      <div className="space-y-3">
        <QrCodeDisplay animal={{ ...animal, qr_payload: animal.qr_payload }} />
      </div>
    )
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-brand-dark">
          Tag MyPetID
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          Solicite a tag da coleira (QR + NFC). Depois você gera o código digital
          para gravar na plaqueta.
        </p>
      </div>

      <TagPreview petName={animal.nome} />

      {status === 'nao_solicitada' && (
        <div className="space-y-3">
          <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-700">
            Etapa 1 — peça a tag física. Em breve haverá pagamento e envio da
            coleira/plaqueta.
          </p>
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center sm:w-auto"
            disabled={busy}
            onClick={() => void handleSolicitar()}
          >
            {busy ? 'Solicitando…' : 'Solicitar tag'}
          </Button>
        </div>
      )}

      {status === 'solicitada' && (
        <div className="space-y-3">
          <p className="rounded-[14px] border border-[#F0E4B8] bg-[#FFF6DD] px-4 py-3 text-[13px] leading-relaxed text-[#B7791F]">
            Tag solicitada. A etapa de pagamento será adicionada aqui. Por
            enquanto, você já pode gerar o QR Code e o link NFC.
          </p>
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center sm:w-auto"
            disabled={busy}
            onClick={() => void handleGerar()}
          >
            {busy ? 'Gerando…' : 'Gerar QR Code e NFC'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  )
}
