import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  authLinkClassName,
  FormError,
  SubmitButton,
} from '@/components/auth/AuthForm'
import { Input } from '@/components/ui/Input'
import { PetIdLogoMark } from '@/components/ui/PetIdLogo'
import { useAuth } from '@/contexts/AuthContext'
import {
  adminNeedsMfa,
  adminNeedsMfaEnrollment,
  isOrgApproved,
  mapAuthErrorMessage,
  resolveRoleFromUser,
  roleHomePath,
  signInWithPassword,
} from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  loginEmailAutofill,
  loginPasswordAutofill,
} from '@/lib/form-autofill'

export function LoginPage() {
  const { user, refreshUser, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    null

  function resolveRedirect(authUser: NonNullable<typeof user>) {
    if (authUser.role === 'orgao') {
      if (authUser.organizacao?.status_aprovacao === 'rejeitado') {
        return '/orgao/rejeitado'
      }
      if (!isOrgApproved(authUser)) {
        return '/orgao/aguardando'
      }
      return from ?? '/orgao'
    }

    if (authUser.role === 'admin') {
      if (adminNeedsMfaEnrollment(authUser)) {
        return '/admin/mfa/cadastrar'
      }
      if (adminNeedsMfa(authUser)) {
        return from ?? '/admin/mfa/verificar'
      }
      return from ?? '/admin'
    }

    return from ?? roleHomePath(authUser.role)
  }

  if (user && !mfaStep && from) {
    return <Navigate to={resolveRedirect(user)} replace />
  }

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (user) {
        await signOut()
      }

      await signInWithPassword(email, password)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const role = session?.user ? resolveRoleFromUser(session.user) : null

      if (role === 'admin') {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const verifiedFactor = (factors?.totp ?? []).find(
          (f) => f.status === 'verified',
        )

        if (verifiedFactor) {
          const { data: aal } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

          if (aal?.currentLevel !== 'aal2') {
            setFactorId(verifiedFactor.id)
            setMfaStep(true)
            return
          }
        }
      }

      const current = await refreshUser()
      if (current) {
        navigate(resolveRedirect(current), { replace: true })
      } else {
        setError(
          'Sessão iniciada, mas o perfil não pôde ser carregado. Tente novamente.',
        )
      }
    } catch (err) {
      setError(
        mapAuthErrorMessage(
          err instanceof Error ? err.message : 'Erro ao entrar',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaVerify(event: FormEvent) {
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
        code: mfaCode,
      })

      if (verifyError) throw verifyError

      const current = await refreshUser()
      if (current) {
        navigate(resolveRedirect(current), { replace: true })
      } else {
        setError(
          'MFA verificado, mas o perfil não pôde ser carregado. Tente novamente.',
        )
      }
    } catch (err) {
      setError(
        mapAuthErrorMessage(
          err instanceof Error ? err.message : 'Código inválido',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Formulário — esquerda */}
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <PetIdLogoMark />
            <h1 className="mt-5 font-display text-[26px] font-extrabold text-brand-dark sm:text-[28px]">
              {mfaStep ? 'Verificação MFA' : 'Bem-vindo de volta'}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
              {mfaStep
                ? 'Digite o código do autenticador (admin).'
                : 'Login único para tutores e órgãos. Após entrar, você vai para a área do seu perfil.'}
            </p>
          </div>

          {mfaStep ? (
            <form
              onSubmit={(e) => void handleMfaVerify(e)}
              className="space-y-5"
            >
              <Input
                label="Código TOTP"
                type="text"
                inputMode="numeric"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              {error && <FormError message={error} />}
              <SubmitButton loading={loading}>
                {loading ? 'Verificando…' : 'Confirmar MFA'}
              </SubmitButton>
            </form>
          ) : (
            <form
              onSubmit={(e) => void handlePasswordLogin(e)}
              className="space-y-5"
              autoComplete="on"
            >
              <Input
                label="E-mail"
                type="email"
                name="login-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                {...loginEmailAutofill}
              />

              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  name="login-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="[&_input]:pr-12"
                  {...loginPasswordAutofill}
                />
                <button
                  type="button"
                  className="absolute right-3 top-[38px] text-gray-400 transition-colors hover:text-brand-500"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M3 3l18 18M10.5 10.5a3 3 0 004 4M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7.5a12.3 12.3 0 01-4.2 5.1M6.1 6.1A12.3 12.3 0 001 12.5C2.7 16.9 7 20 12 20c1.6 0 3.1-.3 4.5-.9" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z" />
                      <circle cx="12" cy="12.5" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-[13.5px] text-gray-500">
                <Link to="/cadastro" className={authLinkClassName}>
                  Criar conta
                </Link>
              </p>

              {error && <FormError message={error} />}

              <SubmitButton loading={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {/* Painel visual — direita */}
      <aside className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <img
          src="/login-pet.png"
          alt="Pet encontrado pela PetID"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark/85 via-brand-800/75 to-brand-500/70" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <PetIdLogoMark />
            <span className="font-display text-lg font-extrabold text-white">
              PetID
            </span>
          </div>

          <div>
            <h2 className="font-display text-[32px] font-extrabold leading-tight text-white xl:text-[36px]">
              Reencontro de animais perdidos
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/85">
              Acesso único para tutores e órgãos parceiros. Depois do login, o
              sistema leva você ao painel certo.
            </p>

            <ul className="mt-8 space-y-3.5">
              {[
                'Tag QR + NFC com perfil público do pet',
                'Confirmação de resgate com localização',
                'Painel para prefeituras, ONGs e clínicas',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] text-white">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-vivid">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[13px] font-semibold text-white/70">
            Plataforma segura · intermediação sem expor contato do tutor
          </p>
        </div>
      </aside>
    </div>
  )
}
