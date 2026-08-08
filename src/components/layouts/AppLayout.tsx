import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { PetIdLogoMark } from '@/components/ui/PetIdLogo'

interface AppLayoutProps {
  area: 'tutor' | 'orgao' | 'admin'
}

const areaLabels: Record<AppLayoutProps['area'], string> = {
  tutor: 'Painel do tutor',
  orgao: 'Painel do órgão',
  admin: 'Painel admin',
}

export function AppLayout({ area }: AppLayoutProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-4 sm:px-8">
          <Link to={`/${area}`} className="flex items-center gap-3">
            <PetIdLogoMark />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-lg font-extrabold text-brand-dark">
                PetID
              </span>
              <span className="text-xs font-semibold text-gray-500">
                {areaLabels[area]}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {area === 'tutor' && (
              <Link
                to="/tutor/perfil"
                className="hidden text-[13.5px] font-semibold text-gray-500 hover:text-brand-500 sm:inline"
              >
                Meu perfil
              </Link>
            )}
            {area === 'admin' && user?.mfa?.verified && (
              <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-500 sm:inline-flex">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" />
                </svg>
                MFA verificado
              </span>
            )}
            {user?.email && (
              <span className="hidden text-[13.5px] text-gray-500 sm:inline">
                {user.email}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 sm:px-8 sm:py-11 sm:pb-[60px]">
        <Outlet />
      </main>
    </div>
  )
}
