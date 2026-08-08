import { Link } from 'react-router-dom'
import { authLinkClassName } from '@/components/auth/AuthForm'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

function PawIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z"
        fill="#6C4FE0"
      />
      <circle cx="6" cy="9" r="2.2" fill="#6C4FE0" />
      <circle cx="18" cy="9" r="2.2" fill="#6C4FE0" />
      <circle cx="9.5" cy="5.5" r="2" fill="#6C4FE0" />
      <circle cx="14.5" cy="5.5" r="2" fill="#6C4FE0" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6C4FE0"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}

const profileOptions = [
  {
    to: '/cadastro/tutor',
    title: 'Sou tutor',
    description: 'Quero cadastrar meu pet e receber alertas de reencontro.',
    cta: 'Continuar como tutor',
    icon: <PawIcon />,
    badge: null,
  },
  {
    to: '/cadastro/organizacao',
    title: 'Sou órgão ou ONG',
    description: 'Prefeitura, CCZ, bombeiros, clínica veterinária parceira…',
    cta: 'Solicitar cadastro',
    icon: <BuildingIcon />,
    badge: 'Sujeito a aprovação manual',
  },
] as const

export function RegisterHubPage() {
  return (
    <section className="mx-auto max-w-[720px] space-y-8">
      <div className="text-center">
        <h1 className="font-display text-[26px] font-extrabold text-brand-dark sm:text-[28px]">
          Criar conta
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-gray-500">
          Escolha como você vai usar o PetID. Depois você preenche o cadastro
          correspondente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {profileOptions.map((option) => (
          <Link
            key={option.to}
            to={option.to}
            className="group block rounded-card border border-surface-border bg-white p-7 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="mb-[18px] flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-50">
              {option.icon}
            </span>
            <h2 className="font-display text-[16.5px] font-extrabold text-brand-dark">
              {option.title}
            </h2>
            <p className="mb-4 mt-2 text-[13.5px] leading-relaxed text-gray-500">
              {option.description}
            </p>
            {option.badge && (
              <Badge variant="warning" className="mb-4">
                {option.badge}
              </Badge>
            )}
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-brand-500">
              {option.cta}
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      <Card className="border border-surface-border px-6 py-5 text-center shadow-card">
        <p className="text-[13.5px] text-gray-500">
          Já tem conta?{' '}
          <Link to="/login" className={authLinkClassName}>
            Entrar
          </Link>
        </p>
      </Card>
    </section>
  )
}
