import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'

const ADMIN_MFA_NAME = 'PetID Admin'

export interface AdminMfaEnrollment {
  factorId: string
  secret: string
  qrCodeDataUrl: string
}

async function buildQrFromUri(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
}

/**
 * Garante um único fator TOTP pendente para o admin e retorna QR otpauth:// válido.
 * Remove fator "unverified" anterior (não dá para recuperar o QR/secret dele).
 */
export async function prepareAdminMfaEnrollment(): Promise<AdminMfaEnrollment> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw listError

  const totpFactors = factors?.totp ?? []
  const verified = totpFactors.find((f) => f.status === 'verified')
  if (verified) {
    throw new Error('MFA_ALREADY_VERIFIED')
  }

  for (const factor of totpFactors) {
    if (factor.status !== 'verified') {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      })
      if (unenrollError) throw unenrollError
    }
  }

  const { data, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: ADMIN_MFA_NAME,
  })

  if (enrollError) throw enrollError

  const uri = data.totp.uri
  const qrCodeDataUrl = uri
    ? await buildQrFromUri(uri)
    : data.totp.qr_code

  return {
    factorId: data.id,
    secret: data.totp.secret,
    qrCodeDataUrl,
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
