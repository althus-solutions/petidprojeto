import { useState } from 'react'
import { PetIdLogoMark } from '@/components/ui/PetIdLogo'

interface TagPreviewProps {
  petName?: string
}

/** Preview 3D simples da plaqueta: frente (logo) / verso (QR + NFC). */
export function TagPreview({ petName }: TagPreviewProps) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        className="group relative h-[200px] w-[200px] [perspective:900px]"
        onClick={() => setFlipped((v) => !v)}
        aria-label={flipped ? 'Ver frente da tag' : 'Ver verso da tag'}
      >
        <div
          className={[
            'relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]',
            flipped ? '[transform:rotateY(180deg)]' : '',
          ].join(' ')}
        >
          {/* Frente */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-full border-[6px] border-white bg-gradient-to-br from-brand-vivid via-brand-500 to-brand-800 shadow-soft [backface-visibility:hidden]">
            <PetIdLogoMark />
            <span className="font-display text-lg font-extrabold text-white">
              MyPetID
            </span>
            {petName && (
              <span className="max-w-[140px] truncate px-3 text-[12px] font-semibold text-white/85">
                {petName}
              </span>
            )}
          </div>

          {/* Verso */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-full border-[6px] border-brand-100 bg-white shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="grid grid-cols-5 gap-0.5 rounded-xl border border-surface-border bg-brand-50 p-2.5">
              {Array.from({ length: 25 }).map((_, i) => (
                <span
                  key={i}
                  className={[
                    'h-2.5 w-2.5 rounded-[2px]',
                    [0, 1, 2, 4, 5, 6, 10, 14, 18, 20, 21, 22, 24].includes(i)
                      ? 'bg-brand-500'
                      : 'bg-brand-200',
                  ].join(' ')}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-brand-500">
              <NfcIcon />
              <span className="text-[12px] font-bold">NFC</span>
            </div>
            <span className="text-[11px] font-semibold text-gray-400">
              QR + NFC
            </span>
          </div>
        </div>
      </button>
      <p className="text-center text-[12px] text-gray-500">
        Toque na tag para ver o verso (QR + NFC)
      </p>
    </div>
  )
}

function NfcIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 8c2.5-2.5 6.5-2.5 9 0" />
      <path d="M8 11c1.5-1.5 4.5-1.5 6 0" />
      <path d="M10 14c.8-.8 2.2-.8 3 0" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
