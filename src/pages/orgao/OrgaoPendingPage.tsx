import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PetIdLogo } from '@/components/ui/PetIdLogo'
import { useAuth } from '@/contexts/AuthContext'

interface OrgaoStatusLayoutProps {
  icon: ReactNode
  iconClassName: string
  title: string
  description: string
  children?: ReactNode
  onSignOut: () => void
}

function BuildingChipIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#6C4FE0" aria-hidden>
      <path d="M4 21V9l8-6 8 6v12H4z" />
    </svg>
  )
}

function OrgaoStatusShell({
  icon,
  iconClassName,
  title,
  description,
  children,
  onSignOut,
}: OrgaoStatusLayoutProps) {
  const { user } = useAuth()
  const orgName = user?.organizacao?.nome

  return (
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-4 sm:px-8">
          <PetIdLogo />
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full border-[1.5px] border-brand-500 bg-transparent px-4 py-2 text-[13px] font-bold text-brand-500 transition-colors hover:bg-brand-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[460px] px-4 py-[90px] text-center sm:px-6">
        <Card className="border border-surface-border px-9 py-11 shadow-soft sm:px-9">
          <div
            className={`mx-auto mb-[22px] flex h-16 w-16 items-center justify-center rounded-full ${iconClassName}`}
          >
            {icon}
          </div>

          {orgName && (
            <span className="mb-[26px] inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-[7px] text-[12.5px] font-bold text-brand-dark">
              <BuildingChipIcon />
              {orgName}
            </span>
          )}

          <h1 className="font-display text-xl font-extrabold text-brand-dark">
            {title}
          </h1>
          <p className="mb-[26px] mt-2.5 text-[13.5px] leading-relaxed text-gray-500">
            {description}
          </p>

          {children}
        </Card>
      </main>
    </div>
  )
}

export function OrgaoPendingPage() {
  const { signOut } = useAuth()

  return (
    <OrgaoStatusShell
      icon={
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B7791F"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      }
      iconClassName="bg-[#FFF6DD]"
      title="Cadastro em análise"
      description="Recebemos sua solicitação de cadastro como órgão parceiro. Nosso time vai revisar as informações e aprovar o acesso em até 2 dias úteis. Você receberá um e-mail assim que for liberado."
      onSignOut={() => void signOut()}
    >
      <ButtonLink
        to="/login"
        variant="outline"
        className="inline-flex px-6 py-3"
      >
        Voltar ao início
      </ButtonLink>
    </OrgaoStatusShell>
  )
}

export function OrgaoRejectedPage() {
  const { signOut } = useAuth()

  return (
    <OrgaoStatusShell
      icon={
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E85D5D"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      }
      iconClassName="bg-[#FCE9E9]"
      title="Cadastro não aprovado"
      description="Não foi possível validar as informações enviadas. Entre em contato com o suporte para entender os próximos passos ou reenviar a solicitação."
      onSignOut={() => void signOut()}
    >
      <div className="flex flex-col items-center gap-3">
        <a
          href="mailto:suporte@petid.com.br"
          className="inline-flex rounded-full border-[1.5px] border-brand-500 bg-transparent px-6 py-3 text-[13.5px] font-bold text-brand-500 transition-colors hover:bg-brand-50"
        >
          Falar com o suporte
        </a>
        <ButtonLink
          to="/login"
          variant="outline"
          className="inline-flex px-6 py-3"
        >
          Voltar ao início
        </ButtonLink>
      </div>
    </OrgaoStatusShell>
  )
}
