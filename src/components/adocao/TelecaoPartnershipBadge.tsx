interface TelecaoPartnershipBadgeProps {
  className?: string
}

/** Destaque visual da parceria TeleCão (laranja). */
export function TelecaoPartnershipBadge({
  className = '',
}: TelecaoPartnershipBadgeProps) {
  return (
    <div
      className={[
        'overflow-hidden rounded-[16px] border border-telecao-200 bg-gradient-to-r from-telecao-500 to-telecao-600 text-white shadow-md',
        className,
      ].join(' ')}
      role="note"
      aria-label="Parceria com a TeleCão"
    >
      <div className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white/20 ring-1 ring-white/30"
          aria-hidden
        >
          <PawIcon />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/85">
            Em parceria com
          </p>
          <p className="font-display text-[18px] font-extrabold leading-tight tracking-tight sm:text-[20px]">
            TeleCão
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-white/90 sm:text-[12.5px]">
            Rede de atendimentos e adoção responsável
          </p>
        </div>
      </div>
    </div>
  )
}

function PawIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
      <circle cx="6" cy="9" r="2.2" />
      <circle cx="18" cy="9" r="2.2" />
      <circle cx="9.5" cy="5.5" r="2" />
      <circle cx="14.5" cy="5.5" r="2" />
    </svg>
  )
}
