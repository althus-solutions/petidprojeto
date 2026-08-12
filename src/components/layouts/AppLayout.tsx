import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { countAlertasPendentes } from '@/lib/ocorrencia-alertas'
import { listOcorrenciasAbertasTutor } from '@/lib/ocorrencias'
import { ChatFabLink } from '@/components/chat/ChatFabLink'
import { PetIdLogoMark } from '@/components/ui/PetIdLogo'

interface AppLayoutProps {
  area: 'tutor' | 'orgao' | 'admin'
}

const areaLabels: Record<AppLayoutProps['area'], string> = {
  tutor: 'Painel do tutor',
  orgao: 'Painel do órgão',
  admin: 'Painel admin',
}

function labelAreaOrgao(tipo?: string | null) {
  if (tipo === 'prefeitura') return 'Painel da prefeitura'
  if (tipo === 'ong') return 'Painel da ONG'
  return areaLabels.orgao
}

const tutorBottomNav = [
  {
    to: '/tutor',
    label: 'Meus pets',
    end: true,
    icon: PetsIcon,
  },
  {
    to: '/tutor/ocorrencias',
    label: 'Ocorrências',
    end: false,
    icon: MapPinIcon,
  },
  // Adoção (TeleCão) oculta — reativar com rotas em routes/index.tsx
  {
    to: '/tutor/perfil',
    label: 'Perfil',
    end: false,
    icon: ProfileIcon,
  },
] as const

function PetsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.7'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="7.5" cy="8" rx="2.2" ry="2.8" />
      <ellipse cx="16.5" cy="8" rx="2.2" ry="2.8" />
      <ellipse cx="4.8" cy="13.2" rx="2" ry="2.5" />
      <ellipse cx="19.2" cy="13.2" rx="2" ry="2.5" />
      <ellipse cx="12" cy="15.5" rx="4" ry="3.6" />
    </svg>
  )
}

function MapPinIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.7'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.7'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
    </svg>
  )
}

export function AppLayout({ area }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [ocorrenciaAlertas, setOcorrenciaAlertas] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const isTutor = area === 'tutor'

  function isTutorNavActive(to: string, end: boolean) {
    const path = location.pathname
    if (to === '/tutor/ocorrencias') {
      return path.startsWith('/tutor/ocorrencias')
    }
    if (to === '/tutor/perfil') {
      return path.startsWith('/tutor/perfil')
    }
    // Meus pets: ativo em /tutor e rotas de pet; não em ocorrências/perfil
    if (end) {
      return (
        path === '/tutor' ||
        path.startsWith('/tutor/pets') ||
        path.startsWith('/tutor/matches')
      )
    }
    return path.startsWith(to)
  }

  const refreshOcorrenciaAlertas = useCallback(async () => {
    if (!isTutor || !user?.tutor?.id) {
      setOcorrenciaAlertas(0)
      return
    }
    try {
      const lista = await listOcorrenciasAbertasTutor()
      setOcorrenciaAlertas(countAlertasPendentes(lista))
    } catch {
      /* ignore — migration pode faltar */
    }
  }, [isTutor, user?.tutor?.id])

  useEffect(() => {
    if (!isTutor) return
    void refreshOcorrenciaAlertas()
    const id = window.setInterval(() => void refreshOcorrenciaAlertas(), 5000)
    const onDismiss = () => void refreshOcorrenciaAlertas()
    window.addEventListener('petid:ocorrencia-alerta', onDismiss)
    window.addEventListener('focus', onDismiss)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('petid:ocorrencia-alerta', onDismiss)
      window.removeEventListener('focus', onDismiss)
    }
  }, [isTutor, refreshOcorrenciaAlertas])

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header
        className={[
          'z-40',
          isTutor
            ? 'sticky top-0 px-3 pt-3 sm:px-6 sm:pt-4'
            : 'sticky top-0 border-b border-surface-border bg-white/95 backdrop-blur-sm',
        ].join(' ')}
      >
        <div
          className={[
            'mx-auto flex max-w-[1120px] items-center gap-3',
            isTutor
              ? 'h-14 justify-center rounded-[22px] border border-surface-border bg-white/95 px-3.5 shadow-soft backdrop-blur-sm sm:h-[60px] sm:px-5'
              : 'h-14 justify-between px-4 sm:h-[64px] sm:px-8',
          ].join(' ')}
        >
          <Link to={`/${area}`} className="flex shrink-0 items-center gap-2.5">
            <PetIdLogoMark />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[17px] font-extrabold text-brand-dark sm:text-lg">
                MyPetID
              </span>
              {!isTutor && (
                <span className="text-xs font-semibold text-gray-500">
                  {area === 'orgao'
                    ? labelAreaOrgao(user?.organizacao?.tipo)
                    : areaLabels[area]}
                </span>
              )}
            </span>
          </Link>

          {!isTutor && (
            <div className="relative flex shrink-0 items-center gap-3" ref={menuRef}>
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

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-surface-border bg-brand-50 text-brand-500 transition-colors hover:border-brand-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                aria-label="Menu da conta"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-surface-border bg-white py-1 shadow-lg"
                  style={{ top: '100%' }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left text-[13.5px] font-semibold text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand-500"
                    onClick={() => {
                      setMenuOpen(false)
                      void signOut()
                    }}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main
        className={[
          'mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-8 sm:py-10',
          isTutor
            ? 'pb-[calc(6.25rem+env(safe-area-inset-bottom))]'
            : 'sm:pb-[60px]',
        ].join(' ')}
      >
        <Outlet />
      </main>

      {isTutor && (
        <nav
          aria-label="Navegação do tutor"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <div className="pointer-events-auto mx-auto flex h-[64px] max-w-[1120px] items-stretch overflow-hidden rounded-[22px] border border-surface-border bg-white/95 shadow-soft backdrop-blur-sm">
            {tutorBottomNav.map((item) => {
              const showBadge =
                item.to === '/tutor/ocorrencias' && ocorrenciaAlertas > 0
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={() => {
                    const active = isTutorNavActive(item.to, item.end)
                    return [
                      'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors',
                      active
                        ? 'text-brand-500'
                        : 'text-gray-400 hover:text-brand-500',
                    ].join(' ')
                  }}
                  aria-label={
                    showBadge
                      ? `${item.label}, ${ocorrenciaAlertas} alerta(s) novo(s)`
                      : item.label
                  }
                >
                  {() => {
                    const active = isTutorNavActive(item.to, item.end)
                    return (
                      <>
                        <span className="relative inline-flex">
                          <Icon active={active} />
                          {showBadge && (
                            <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {ocorrenciaAlertas > 9 ? '9+' : ocorrenciaAlertas}
                            </span>
                          )}
                        </span>
                        <span>{item.label}</span>
                        {active && (
                          <span className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-brand-500" />
                        )}
                      </>
                    )
                  }}
                </NavLink>
              )
            })}
          </div>
        </nav>
      )}

      {isTutor && <ChatFabLink />}
    </div>
  )
}
