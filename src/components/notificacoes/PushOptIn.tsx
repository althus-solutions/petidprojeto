import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import {
  getPushPermission,
  isPushSupported,
  subscribeToPushNotifications,
} from '@/lib/push'

export function PushOptIn() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canalPreferido = user?.tutor?.canal_notificacao_preferido

  useEffect(() => {
    void getPushPermission().then(setPermission)
  }, [])

  const handleSubscribe = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    const result = await subscribeToPushNotifications()
    setLoading(false)

    if (result.ok) {
      setPermission('granted')
      setMessage('Notificações push ativadas neste dispositivo.')
    } else {
      setMessage(result.error ?? 'Não foi possível ativar o push.')
    }
  }, [])

  if (!user?.tutor) return null

  if (!isPushSupported()) {
    return (
      <p className="rounded-card border border-surface-border bg-white px-5 py-4 text-sm text-gray-500">
        Notificações push não são suportadas neste navegador. Use e-mail ou WhatsApp como
        canal preferido.
      </p>
    )
  }

  if (permission === 'granted') {
    return (
      <p className="rounded-card border border-surface-border bg-brand-50 px-5 py-4 text-sm text-brand-dark">
        Notificações push ativas neste dispositivo.
        {canalPreferido === 'push'
          ? ' Este é seu canal preferido de alerta.'
          : ' Seu canal preferido é outro; push funciona como complemento.'}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-card bg-[#FFF6DD] px-6 py-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#B7791F"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#B7791F]">
            Receba alertas instantâneos no celular
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#8A6216]">
            Ative as notificações push para ser avisado quando alguém ler o QR Code do seu pet
            {canalPreferido === 'push' ? ' (seu canal preferido)' : ''}.
          </p>
          {message && <p className="mt-2 text-xs text-red-600">{message}</p>}
        </div>
      </div>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={loading}
        onClick={() => void handleSubscribe()}
        className="shrink-0 whitespace-nowrap"
      >
        {loading ? 'Ativando…' : 'Ativar notificações push'}
      </Button>
    </div>
  )
}
