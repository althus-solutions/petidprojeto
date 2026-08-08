import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type ButtonVariant = 'primary' | 'outline' | 'ghost'
type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white shadow-btn-primary hover:bg-brand-600 hover:-translate-y-0.5 disabled:bg-[#EDEBF6] disabled:text-gray-300 disabled:shadow-none disabled:hover:translate-y-0',
  outline:
    'border-[1.5px] border-brand-500 bg-transparent text-brand-500 hover:bg-brand-50 hover:-translate-y-0.5 disabled:border-gray-200 disabled:text-gray-300 disabled:hover:translate-y-0',
  ghost:
    'bg-transparent text-gray-500 hover:text-brand-500 disabled:text-gray-300',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-[26px] py-[13px] text-sm font-bold',
  sm: 'px-[18px] py-[9px] text-[13.5px] font-bold',
}

function getButtonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className: string,
) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-full font-sans transition-[transform,box-shadow,background-color,color] duration-150',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[getButtonClasses(variant, size, className), 'disabled:cursor-not-allowed']
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={getButtonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  )
}
