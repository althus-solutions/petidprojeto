import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { inputFieldClassName } from '@/components/ui/Input'

interface AuthCardProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="mx-auto max-w-[480px] space-y-6 p-8 sm:p-11 sm:px-10">
      <div>
        <h1 className="font-display text-[26px] font-extrabold text-brand-dark">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[14.5px] leading-relaxed text-gray-500">
            {description}
          </p>
        )}
      </div>
      {children}
      {footer}
    </Card>
  )
}

interface FormFieldProps {
  label: string
  children: ReactNode
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13.5px] font-bold text-brand-dark">{label}</span>
      {children}
    </label>
  )
}

export const inputClassName = inputFieldClassName

export const selectClassName = inputFieldClassName

export const authLinkClassName =
  'font-bold text-brand-500 no-underline transition-opacity hover:opacity-80'

export const authMutedLinkClassName =
  'text-[13px] font-semibold text-gray-400 no-underline transition-colors hover:text-brand-500'

export function FormError({ message }: { message: string }) {
  return <p className="text-sm text-red-600">{message}</p>
}

export function FormSuccess({ message }: { message: string }) {
  return (
    <p className="rounded-[14px] bg-[#E7F8EF] px-4 py-3 text-sm text-[#1F9D55]">
      {message}
    </p>
  )
}

export function SubmitButton({
  loading,
  children,
}: {
  loading: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={loading}
      className="mt-1.5 w-full text-[15px]"
    >
      {children}
    </Button>
  )
}
