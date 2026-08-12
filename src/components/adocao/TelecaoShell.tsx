import type { ReactNode } from 'react'

/**
 * Wrapper leve da área de adoção — sem fundo próprio
 * (usa o bg-brand-50 do AppLayout, como o restante do painel).
 */
export function TelecaoShell({ children }: { children: ReactNode }) {
  return <div className="pb-2">{children}</div>
}
