import type { FocusEvent } from 'react'

/** Impede autofill do navegador em formulários de cadastro (não reutilizar credenciais de login). */
export function clearReadonlyOnFocus(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  event.currentTarget.removeAttribute('readonly')
}

export const signupFieldAntiAutofill = {
  autoComplete: 'off' as const,
  readOnly: true,
  onFocus: clearReadonlyOnFocus,
}

export const signupPasswordAntiAutofill = {
  autoComplete: 'new-password' as const,
  readOnly: true,
  onFocus: clearReadonlyOnFocus,
}

export const loginEmailAutofill = {
  autoComplete: 'username' as const,
}

export const loginPasswordAutofill = {
  autoComplete: 'current-password' as const,
}
