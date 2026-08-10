import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildPetPublicUrl } from '@/lib/pets'
import type { Animal } from '@/types/pet'

interface QrCodeDisplayProps {
  animal: Animal
}

export function QrCodeDisplay({ animal }: QrCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const payload = animal.qr_payload
  const tagUrl = payload ? buildPetPublicUrl(payload) : ''

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !tagUrl) return

    void QRCode.toCanvas(canvas, tagUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#6C4FE0', light: '#ffffff' },
    }).catch((err: Error) => setError(err.message))
  }, [tagUrl])

  if (!payload) return null

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `petid-qr-${animal.nome.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function handleCopyNfcLink() {
    try {
      await navigator.clipboard.writeText(tagUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Não foi possível copiar o link. Selecione e copie manualmente.')
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold text-brand-dark">
          Tag registrada — {animal.nome}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Este animal já tem coleira/tag com QR e NFC. Baixe o PNG e copie o
          link para gravar no chip.
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <canvas
          ref={canvasRef}
          className="rounded-2xl border border-surface-border shadow-card"
        />
        <div className="w-full space-y-4 text-sm sm:flex-1">
          <div>
            <p className="font-bold text-brand-dark">1. QR Code (imagem)</p>
            <p className="mt-1 text-xs text-gray-500">
              Baixe o PNG para imprimir na plaqueta/coleira.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleDownload}
            >
              Baixar PNG do QR
            </Button>
          </div>

          <div>
            <p className="font-bold text-brand-dark">2. Link NFC (mesma URL)</p>
            <p className="mt-1 break-all rounded-[14px] bg-brand-50 px-3 py-2.5 font-mono text-xs text-brand-dark">
              {tagUrl}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void handleCopyNfcLink()}
            >
              {copied ? 'Link copiado!' : 'Copiar link para NFC'}
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-gray-400">
            Payload da tag: <code>{animal.qr_payload}</code>
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  )
}
