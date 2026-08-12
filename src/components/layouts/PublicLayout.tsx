import { Link, Outlet, useLocation } from 'react-router-dom'
import { PetIdLogo } from '@/components/ui/PetIdLogo'

function navLinkClass(isActive: boolean) {
  return [
    'text-sm font-semibold transition-colors',
    isActive
      ? 'text-brand-500'
      : 'text-gray-500 hover:text-brand-500',
  ].join(' ')
}

export function PublicLayout() {
  const { pathname } = useLocation()
  const isCadastro =
    pathname === '/cadastro' ||
    pathname === '/cadastro/tutor' ||
    pathname === '/cadastro/organizacao'
  const isEvento = pathname.startsWith('/evento')
  const isLogin = pathname === '/login'

  return (
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1080px] items-center justify-between px-4 sm:px-8">
          <PetIdLogo />
          <nav className="flex items-center gap-3.5 sm:gap-7">
            <Link
              to="/evento"
              className={navLinkClass(isEvento)}
              aria-current={isEvento ? 'page' : undefined}
            >
              evento
            </Link>
            <Link
              to="/cadastro"
              className={navLinkClass(isCadastro)}
              aria-current={isCadastro ? 'page' : undefined}
            >
              criar uma conta
            </Link>
            <Link
              to="/login"
              className={[
                'rounded-full border-[1.5px] px-[18px] py-2 text-sm font-semibold transition-colors',
                isLogin
                  ? 'border-brand-500 text-brand-500'
                  : 'border-surface-border text-brand-dark hover:border-brand-500 hover:text-brand-500',
              ].join(' ')}
              aria-current={isLogin ? 'page' : undefined}
            >
              entrar
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-10 sm:px-8 sm:py-[72px] sm:pb-10">
        <Outlet />
      </main>
    </div>
  )
}
