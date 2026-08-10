import { Button } from '@/components/ui/Button'

export type LocationModalPhase =
  | 'ask'
  | 'requesting'
  | 'denied'
  | 'submitting'

interface LocationConsentModalProps {
  petName: string
  phase: LocationModalPhase
  error?: string | null
  onShare: () => void
  onSkip: () => void
  onClose?: () => void
}

export function LocationConsentModal({
  petName,
  phase,
  error,
  onShare,
  onSkip,
  onClose,
}: LocationConsentModalProps) {
  const busy = phase === 'requesting' || phase === 'submitting'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loc-consent-title"
    >
      <div className="w-full max-w-md rounded-[22px] border border-surface-border bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <PinIcon />
        </div>

        <h2
          id="loc-consent-title"
          className="font-display text-[20px] font-extrabold text-brand-dark"
        >
          Compartilhar localização?
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">
          Isso ajuda o tutor de <strong className="text-brand-dark">{petName}</strong>{' '}
          a ver no mapa onde o animal foi encontrado. Você pode continuar sem
          compartilhar.
        </p>

        {phase === 'denied' && (
          <p className="mt-3 rounded-[14px] bg-[#FFF6DD] px-3.5 py-3 text-[13px] text-[#B7791F]">
            Não foi possível obter a localização (permissão negada ou GPS
            indisponível). Você pode tentar de novo ou seguir sem o ponto no
            mapa.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-[14px] bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center"
            disabled={busy}
            onClick={onShare}
          >
            {phase === 'requesting'
              ? 'Obtendo localização…'
              : phase === 'submitting'
                ? 'Confirmando…'
                : phase === 'denied'
                  ? 'Tentar novamente'
                  : 'Sim, compartilhar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            disabled={busy}
            onClick={onSkip}
          >
            {phase === 'submitting' ? 'Confirmando…' : 'Continuar sem localização'}
          </Button>
          {onClose && phase === 'ask' && (
            <button
              type="button"
              className="mt-1 text-center text-[13px] font-semibold text-gray-400 hover:text-brand-500"
              onClick={onClose}
            >
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PinIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}
