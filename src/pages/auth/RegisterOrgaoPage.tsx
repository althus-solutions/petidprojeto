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
import { signUpOrgao } from '@/lib/auth'
import {
  signupFieldAntiAutofill,
  signupPasswordAntiAutofill,
} from '@/lib/form-autofill'
import type { OrganizacaoTipo } from '@/types/auth'

const tiposOrganizacao: { value: OrganizacaoTipo; label: string }[] = [
  { value: 'prefeitura', label: 'Prefeitura' },
  { value: 'pm', label: 'Polícia Militar / Guarda' },
  { value: 'bombeiros', label: 'Bombeiros' },
  { value: 'ccz', label: 'CCZ / Centro de controle zoonoses' },
  { value: 'ong', label: 'ONG' },
  { value: 'veterinaria', label: 'Clínica veterinária parceira' },
]

function ApprovalNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] bg-[#FFF6DD] px-4 py-3.5 text-[13px] leading-relaxed text-[#B7791F]">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-0.5 shrink-0"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <p>
        Após o cadastro, um administrador da plataforma validará a identidade
        da organização antes de liberar o acesso ao painel.
      </p>
    </div>
  )
}

export function RegisterOrgaoPage() {
  const { user, signOut } = useAuth()
  const [nomeOrg, setNomeOrg] = useState('')
  const [tipo, setTipo] = useState<OrganizacaoTipo>('ong')
  const [responsavel, setResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (user) {
        await signOut()
      }

      const result = await signUpOrgao({
        email,
        password,
        nome: nomeOrg,
        tipo,
        responsavel,
      })

      if (result.session) {
        window.location.href = '/orgao/aguardando'
        return
      }

      setSuccess(
        'Solicitação registrada. Confirme seu e-mail (se solicitado) e aguarde aprovação manual no painel admin. A organização já aparece como pendente para o administrador.',
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao solicitar cadastro',
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthCard
        title="Solicitação enviada"
        description="Sua organização ficará com status pendente até validação manual."
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

  return (
    <AuthCard
      title="Solicitar cadastro de organização"
      description="Órgãos públicos e ONGs passam por aprovação manual antes de acessar o painel. Não é liberação automática."
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
        <ApprovalNotice />

        <Input
          label="Nome da organização"
          type="text"
          name="org-nome"
          required
          value={nomeOrg}
          onChange={(e) => setNomeOrg(e.target.value)}
          {...signupFieldAntiAutofill}
        />

        <Select
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as OrganizacaoTipo)}
        >
          {tiposOrganizacao.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>

        <Input
          label="Nome do responsável"
          type="text"
          name="org-responsavel"
          required
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          {...signupFieldAntiAutofill}
        />

        <Input
          label="E-mail institucional"
          type="email"
          name="org-email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...signupFieldAntiAutofill}
        />

        <Input
          label="Senha"
          type="password"
          name="org-senha"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          {...signupPasswordAntiAutofill}
        />

        {error && <FormError message={error} />}

        <SubmitButton loading={loading}>
          {loading ? 'Enviando…' : 'Enviar solicitação'}
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
