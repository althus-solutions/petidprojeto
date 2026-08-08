import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  adminNeedsMfa,
  adminNeedsMfaEnrollment,
  isOrgApproved,
} from '@/lib/auth'
import type { UserRole } from '@/types/auth'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
  requireOrgApproved?: boolean
  requireAdminMfa?: boolean
  /** Rota só para órgão ainda não aprovado */
  onlyPendingOrgao?: boolean
}

export function ProtectedRoute({
  allowedRoles,
  requireOrgApproved = false,
  requireAdminMfa = false,
  onlyPendingOrgao = false,
}: ProtectedRouteProps) {
  const { user, session, loading, refreshUser } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!loading && session && !user) {
      void refreshUser()
    }
  }, [loading, session, user, refreshUser])

  if (loading || (session && !user)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-slate-600">Carregando sessão…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && (!user.role || !allowedRoles.includes(user.role))) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'orgao') {
    const approved = isOrgApproved(user)
    const status = user.organizacao?.status_aprovacao

    if (onlyPendingOrgao) {
      if (approved) return <Navigate to="/orgao" replace />
      if (status === 'rejeitado') {
        return <Navigate to="/orgao/rejeitado" replace />
      }
      return <Outlet />
    }

    if (requireOrgApproved && !approved) {
      if (status === 'rejeitado') {
        return <Navigate to="/orgao/rejeitado" replace />
      }
      return <Navigate to="/orgao/aguardando" replace />
    }
  }

  if (user.role === 'admin' && requireAdminMfa) {
    if (adminNeedsMfaEnrollment(user)) {
      return <Navigate to="/admin/mfa/cadastrar" replace />
    }
    if (adminNeedsMfa(user)) {
      return (
        <Navigate
          to="/admin/mfa/verificar"
          state={{ from: location }}
          replace
        />
      )
    }
  }

  return <Outlet />
}
