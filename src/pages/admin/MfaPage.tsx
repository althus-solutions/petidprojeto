import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MfaOtpInput } from '@/components/admin/MfaOtpInput'
import { FormError } from '@/components/auth/AuthForm'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PetIdLogo } from '@/components/ui/PetIdLogo'
import { useAuth } from '@/contexts/AuthContext'
import { roleHomePath } from '@/lib/auth'
import { copyTextToClipboard, prepareAdminMfaEnrollment } from '@/lib/mfa'
import { supabase } from '@/lib/supabase'

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6C4FE0"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  )
}

function MfaPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center px-4 sm:px-8">
          <PetIdLogo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[420px] flex-1 px-6 py-[70px]">
        <div className="mb-5 flex justify-center">
          <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-brand-100">
            <LockIcon />
          </span>
        </div>
        {children}
      </main>
    </div>
  )
}

export function MfaEnrollPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const enrollStarted = useRef(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [preparing, setPreparing] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin' || user.mfa.enrolled) return
    if (enrollStarted.current) return
    enrollStarted.current = true

    async function enroll() {
      setPreparing(true)
      setError(null)
      try {
        const data = await prepareAdminMfaEnrollment()
        setFactorId(data.factorId)
        setQrCode(data.qrCodeDataUrl)
        setSecret(data.secret)
      } catch (err) {
        if (err instanceof Error && err.message === 'MFA_ALREADY_VERIFIED') {
          navigate('/admin', { replace: true })
          return
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível iniciar o cadastro MFA.',
        )
      } finally {
        setPreparing(false)
      }
    }

    void enroll()
  }, [user, navigate])

  if (user?.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  if (user.mfa.enrolled && user.mfa.verified) {
    return <Navigate to="/admin" replace />
  }

  async function handleCopySecret() {
    if (!secret) return
    try {
      await copyTextToClipboard(secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Não foi possível copiar a chave. Selecione e copie manualmente.')
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault()
    if (!factorId) return

    setError(null)
    setLoading(true)

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })

      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })

      if (verifyError) throw verifyError

      await refreshUser()
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MfaPageShell>
      <Card className="px-[34px] py-[38px] text-center">
        <h1 className="font-display text-xl font-extrabold text-brand-dark">
          Configurar MFA (obrigatório)
        </h1>
        <p className="mb-4 mt-2 text-[13.5px] leading-relaxed text-gray-500">
          Administradores devem usar autenticação em dois fatores (TOTP).
          Confirme com o código de 6 dígitos do aplicativo autenticador.
        </p>

        <div className="mb-5 rounded-[14px] bg-[#FFF6DD] px-4 py-3 text-left text-[13px] leading-relaxed text-[#B7791F]">
          <strong className="block">Como escanear corretamente</strong>
          Abra o <strong>Google Authenticator</strong> ou{' '}
          <strong>Microsoft Authenticator</strong>, toque em <strong>+</strong> e
          escolha <strong>Escanear QR code</strong> dentro do app.
          <span className="mt-1 block">
            Não use a câmera do celular nem o Bloco de Notas — isso só copia a
            chave como texto.
          </span>
        </div>

        <div className="space-y-5 text-left">
          {preparing && (
            <p className="text-center text-sm text-gray-500">
              Preparando QR Code…
            </p>
          )}

          {qrCode && !preparing && (
            <div className="flex justify-center">
              <img
                src={qrCode}
                alt="QR Code otpauth para autenticador TOTP"
                className="h-48 w-48 rounded-2xl border border-surface-border bg-white p-2 shadow-card"
              />
            </div>
          )}

          {secret && !preparing && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-brand-dark">
                Ou cadastre manualmente no autenticador
              </p>
              <p className="break-all rounded-[14px] bg-brand-50 px-4 py-3 font-mono text-xs text-gray-600">
                Chave: {secret}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void handleCopySecret()}
              >
                {copied ? 'Chave copiada!' : 'Copiar chave'}
              </Button>
              <p className="text-xs text-gray-400">
                Conta: MyPetID Admin · Tipo: baseada em horário (TOTP)
              </p>
            </div>
          )}

          <form onSubmit={(e) => void handleVerify(e)} className="space-y-6">
            <MfaOtpInput
              id="mfa-enroll-code"
              value={code}
              onChange={setCode}
              disabled={loading || preparing || !factorId}
              aria-label="Código do autenticador"
            />

            {error && <FormError message={error} />}

            <Button
              type="submit"
              variant="primary"
              disabled={loading || preparing || !factorId || code.length < 6}
              className="w-full py-3.5 text-[15px]"
            >
              {loading ? 'Verificando…' : 'Ativar MFA'}
            </Button>
          </form>
        </div>

        <Link
          to="/login"
          className="mt-5 inline-block text-[13px] font-semibold text-gray-400 transition-colors hover:text-brand-500"
        >
          Voltar ao login
        </Link>
      </Card>
    </MfaPageShell>
  )
}

export function MfaVerifyPage() {
  const { user, refreshUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    roleHomePath('admin')

  useEffect(() => {
    async function loadFactor() {
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = (data?.totp ?? []).find((f) => f.status === 'verified')
      const pending = (data?.totp ?? []).find((f) => f.status !== 'verified')
      if (verified) {
        setFactorId(verified.id)
        return
      }
      if (pending) {
        navigate('/admin/mfa/cadastrar', { replace: true })
      }
    }

    void loadFactor()
  }, [navigate])

  if (user?.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  if (user.mfa.verified) {
    return <Navigate to={from} replace />
  }

  if (!user.mfa.enrolled) {
    return <Navigate to="/admin/mfa/cadastrar" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!factorId) {
      setError('Nenhum fator MFA encontrado. Configure o MFA primeiro.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })

      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })

      if (verifyError) throw verifyError

      await refreshUser()
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MfaPageShell>
      <Card className="px-[34px] py-[38px] text-center">
        <h1 className="font-display text-xl font-extrabold text-brand-dark">
          Verificação em duas etapas
        </h1>
        <p className="mb-7 mt-2 text-[13.5px] leading-relaxed text-gray-500">
          Digite o código de 6 dígitos gerado no seu aplicativo autenticador para
          acessar o painel admin.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          <MfaOtpInput
            id="mfa-verify-code"
            value={code}
            onChange={setCode}
            disabled={loading}
          />

          {error && <FormError message={error} />}

          <Button
            type="submit"
            variant="primary"
            disabled={loading || code.length < 6}
            className="w-full py-3.5 text-[15px]"
          >
            {loading ? 'Verificando…' : 'Verificar e entrar'}
          </Button>
        </form>
      </Card>
    </MfaPageShell>
  )
}
