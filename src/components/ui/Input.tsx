import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

type InputFieldProps = {
  label: string
  hint?: string
  error?: string
  className?: string
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & InputFieldProps

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  InputFieldProps

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  InputFieldProps & {
    children: ReactNode
  }

export const inputFieldClassName =
  'w-full rounded-input border-[1.5px] border-surface-border bg-white px-3.5 py-3 text-sm text-brand-dark outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60'

function FieldWrapper({
  label,
  hint,
  error,
  className = '',
  children,
}: InputFieldProps & { children: ReactNode }) {
  return (
    <label className={['block space-y-1.5', className].filter(Boolean).join(' ')}>
      <span className="text-[13.5px] font-bold text-brand-dark">{label}</span>
      {children}
      {hint && !error && (
        <span className="block text-xs text-gray-400">{hint}</span>
      )}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  )
}

function fieldErrorClass(error?: string) {
  return error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''
}

export function Input({
  label,
  hint,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <input
        id={inputId}
        className={[inputFieldClassName, fieldErrorClass(error)]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </FieldWrapper>
  )
}

export function Select({
  label,
  hint,
  error,
  className = '',
  id,
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <select
        id={selectId}
        className={[inputFieldClassName, fieldErrorClass(error)]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  )
}

export function Textarea({
  label,
  hint,
  error,
  className = '',
  id,
  rows = 3,
  ...props
}: TextareaProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <FieldWrapper label={label} hint={hint} error={error} className={className}>
      <textarea
        id={inputId}
        rows={rows}
        className={[
          inputFieldClassName,
          'resize-y',
          fieldErrorClass(error),
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </FieldWrapper>
  )
}
