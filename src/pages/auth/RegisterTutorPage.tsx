import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AuthCard,
  authLinkClassName,
  authMutedLinkClassName,
  FormError,
  FormSuccess,
  SubmitButton,
} from '@/components/auth/AuthForm'
import { Input, Select } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { signUpTutor } from '@/lib/auth'
import {
  signupFieldAntiAutofill,
  signupPasswordAntiAutofill,
} from '@/lib/form-autofill'
import type { CanalNotificacao } from '@/types/auth'

export function RegisterTutorPage() {
  const { user, signOut } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [password, setPassword] = useState('')
  const [canal, setCanal] = useState<CanalNotificacao>('email')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (success) {
    return (
      <AuthCard
        title="Cadastro recebido"
        description="Se a confirmação por e-mail estiver ativa no projeto, verifique sua caixa de entrada antes de entrar."
        footer={
          <p className="text-center text-[13.5px] text-gray-500">
            <Link to="/login" className={authLinkClassName}>
              Ir para login
            </Link>
          </p>
        }
      >
        <FormSuccess message={success} />
      </AuthCard>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (user) {
        await signOut()
      }

      const result = await signUpTutor({
        email,
        password,
        nome,
        telefone: telefone || undefined,
        canal_notificacao_preferido: canal,
      })

      if (result.session) {
        window.location.href = '/tutor'
        return
      }

      setSuccess(
        'Conta criada com sucesso. Confirme seu e-mail (se solicitado) e faça login.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar tutor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Cadastro de tutor"
      description="Crie sua conta para cadastrar pets e receber alertas de reencontro."
      footer={
        <div className="space-y-2.5 text-center text-[13.5px] text-gray-500">
          <p>
            Já tem conta?{' '}
            <Link to="/login" className={authLinkClassName}>
              Entrar
            </Link>
          </p>
          <p>
            <Link to="/cadastro" className={authMutedLinkClassName}>
              ← Escolher outro perfil
            </Link>
          </p>
        </div>
      }
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5"
        autoComplete="off"
      >
        <Input
          label="Nome completo"
          type="text"
          name="tutor-nome"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          {...signupFieldAntiAutofill}
        />

        <Input
          label="E-mail"
          type="email"
          name="tutor-email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...signupFieldAntiAutofill}
        />

        <Input
          label="Telefone (opcional)"
          type="tel"
          name="tutor-telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 99999-9999"
          {...signupFieldAntiAutofill}
        />

        <Select
          label="Canal de notificação preferido"
          value={canal}
          onChange={(e) => setCanal(e.target.value as CanalNotificacao)}
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="email">E-mail</option>
          <option value="push">Push (PWA)</option>
        </Select>

        <Input
          label="Senha"
          type="password"
          name="tutor-senha"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Mínimo de 8 caracteres."
          {...signupPasswordAntiAutofill}
        />

        {error && <FormError message={error} />}

        <SubmitButton loading={loading}>
          {loading ? 'Cadastrando…' : 'Criar conta de tutor'}
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
