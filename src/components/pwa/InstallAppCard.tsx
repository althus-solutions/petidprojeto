import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export function InstallAppCard() {
  const { status, busy, canPrompt, promptInstall } = usePwaInstall()
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleDownload() {
    if (canPrompt) {
      const ok = await promptInstall()
      if (ok) return
    }
    setShowHelp(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setShowHelp(true)
    }
  }

  const helpVisible = status !== 'installed' && (showHelp || !canPrompt)

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex gap-4 border-b border-surface-border bg-gradient-to-br from-brand-50 to-white px-5 py-5 sm:px-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-500 shadow-btn-primary">
          <img
            src="/pwa-192.png"
            alt=""
            className="h-full w-full object-cover"
            width={56}
            height={56}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-extrabold text-brand-dark">
            Baixar o aplicativo
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-gray-500">
            Instale o PetID na tela inicial do celular — abre como app, sem loja
            de aplicativos.
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-5 sm:px-6">
        {status === 'installed' ? (
          <p className="rounded-[14px] border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-[13.5px] font-semibold text-[#027A48]">
            PetID já está instalado neste aparelho.
          </p>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              className="w-full py-[14px] text-[15px]"
              disabled={busy}
              onClick={() => void handleDownload()}
            >
              {busy ? 'Abrindo…' : 'Baixar aplicativo'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void copyLink()}
            >
              {copied ? 'Link copiado!' : 'Copiar link para instalar'}
            </Button>
          </>
        )}

        {helpVisible && (
          <div className="rounded-[14px] border border-surface-border bg-[#fbfaff] px-4 py-3.5">
            {status === 'ios_manual' && (
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-gray-600">
                <li>
                  No Safari, toque em <strong>Compartilhar</strong>.
                </li>
                <li>
                  Escolha <strong>Adicionar à Tela de Início</strong>.
                </li>
                <li>
                  Confirme em <strong>Adicionar</strong>.
                </li>
              </ol>
            )}

            {(status === 'android_manual' ||
              (showHelp && status === 'can_install')) && (
              <p className="text-[13px] leading-relaxed text-gray-600">
                No Chrome, abra o menu <strong>⋮</strong> e toque em{' '}
                <strong>Instalar app</strong> ou{' '}
                <strong>Adicionar à tela inicial</strong>. Use o Chrome
                diretamente (não o navegador interno do WhatsApp/Instagram).
              </p>
            )}

            {status === 'desktop_hint' && (
              <p className="text-[13px] leading-relaxed text-gray-600">
                Abra este link no celular (Chrome ou Safari) e toque em{' '}
                <strong>Baixar aplicativo</strong>. No computador, use o ícone
                de instalação na barra do navegador, se aparecer.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
