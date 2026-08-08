import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { authLinkClassName } from '@/components/auth/AuthForm'

interface TutorBackLinkProps {
  to: string
  children: ReactNode
}

export function TutorBackLink({ to, children }: TutorBackLinkProps) {
  return (
    <Link to={to} className={`text-[13.5px] ${authLinkClassName}`}>
      ← {children}
    </Link>
  )
}
