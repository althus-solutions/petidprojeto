import { Link } from 'react-router-dom'

export function PetIdLogoMark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const boxClass =
    size === 'sm'
      ? 'h-[34px] w-[34px] rounded-[10px]'
      : 'h-9 w-9 rounded-[10px]'

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-vivid to-brand-500 ${boxClass}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z"
          fill="white"
        />
        <circle cx="6" cy="9" r="2.2" fill="white" />
        <circle cx="18" cy="9" r="2.2" fill="white" />
        <circle cx="9.5" cy="5.5" r="2" fill="white" />
        <circle cx="14.5" cy="5.5" r="2" fill="white" />
      </svg>
    </span>
  )
}

interface PetIdLogoProps {
  subtitle?: string
  to?: string
}

export function PetIdLogo({ subtitle, to = '/login' }: PetIdLogoProps) {
  return (
    <Link to={to} className="flex items-center gap-3">
      <PetIdLogoMark size={subtitle ? 'sm' : 'md'} />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-extrabold text-brand-dark">
          MyPetID
        </span>
        {subtitle && (
          <span className="text-xs font-semibold text-gray-500">{subtitle}</span>
        )}
      </span>
    </Link>
  )
}
