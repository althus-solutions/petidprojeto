import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'

const OTP_LENGTH = 6

export interface MfaOtpInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  'aria-label'?: string
}

export function MfaOtpInput({
  id,
  value,
  onChange,
  disabled = false,
  'aria-label': ariaLabel = 'Código de verificação de 6 dígitos',
}: MfaOtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? '')

  const focusIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index))
    inputRefs.current[clamped]?.focus()
  }, [])

  useEffect(() => {
    if (value.length === 0) {
      focusIndex(0)
    }
  }, [focusIndex, value.length])

  function updateDigit(index: number, digit: string) {
    const next = digits.slice()
    next[index] = digit
    onChange(next.join('').slice(0, OTP_LENGTH))
    if (digit && index < OTP_LENGTH - 1) {
      focusIndex(index + 1)
    }
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    updateDigit(index, digit)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      updateDigit(index - 1, '')
      focusIndex(index - 1)
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusIndex(index - 1)
      return
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault()
      focusIndex(index + 1)
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH)
    if (!pasted) return
    onChange(pasted)
    focusIndex(Math.min(pasted.length, OTP_LENGTH - 1))
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      className="flex justify-center gap-2.5"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${index + 1} de ${OTP_LENGTH}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            'h-[52px] w-11 rounded-[10px] border-[1.5px] text-center font-display text-xl font-extrabold text-brand-dark outline-none transition-[border-color,box-shadow,background-color] duration-150',
            digit
              ? 'border-brand-500 bg-brand-50'
              : 'border-surface-border bg-white',
            'focus:border-brand-500 focus:ring-4 focus:ring-brand-100',
            'disabled:cursor-not-allowed disabled:opacity-60',
          ].join(' ')}
        />
      ))}
    </div>
  )
}
