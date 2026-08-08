import type { HTMLAttributes, ReactNode } from 'react'

type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-50 text-brand-500',
  success: 'bg-[#E7F8EF] text-[#1F9D55]',
  warning: 'bg-[#FFF6DD] text-[#B7791F]',
  danger: 'bg-[#FCE9E9] text-[#E85D5D]',
}

export function Badge({
  variant = 'brand',
  children,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
