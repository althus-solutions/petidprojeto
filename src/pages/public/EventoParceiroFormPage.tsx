import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { mapEventoError, registrarCadastroEvento } from '@/lib/evento'
import {
  EVENTO_INTERESSES_PARCEIRO,
  EVENTO_ORG_TIPOS,
  type EventoOrgTipo,
} from '@/types/evento'

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function EventoParceiroFormPage() {
  const [organizacaoNome, setOrganizacaoNome] = useState('')
  const [organizacaoTipo, setOrganizacaoTipo] =
    useState<EventoOrgTipo>('ong')
  const [organizacaoTipoOutro, setOrganizacaoTipoOutro] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('SP')
  const [regiao, setRegiao] = useState('')
  const [volume, setVolume] = useState('')
  const [interesses, setInteresses] = useState<string[]>([])
  const [jaUsaSistema, setJaUsaSistema] = useState(false)
  const [aceitaContato, setAceitaContato] = useState(true)
  const [lgpd, setLgpd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function toggleInteresse(id: string) {
    setInteresses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!lgpd) {
      setError('Aceite o consentimento LGPD para continuar.')
      return
    }
    if (organizacaoTipo === 'outro' && !organizacaoTipoOutro.trim()) {
      setError('Descreva o tipo de organização.')
      return
    }
    setLoading(true)
    try {
      await registrarCadastroEvento({
        tipo_publico: 'parceiro',
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        organizacao_nome: organizacaoNome.trim(),
        organizacao_tipo: organizacaoTipo,
        organizacao_tipo_outro: organizacaoTipoOutro.trim(),
        cnpj: cnpj.trim(),
        cargo: cargo.trim(),
        regiao_atuacao: regiao.trim(),
        volume_animais_mes: volume.trim(),
        interesses_parceiro: interesses,
        ja_usa_sistema: jaUsaSistema,
        aceita_contato: aceitaContato,
        aceite_lgpd: lgpd,
      })
      setDone(true)
    } catch (err) {
      setError(
        mapEventoError(
          err instanceof Error ? err.message : 'Erro ao enviar cadastro.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <section className="mx-auto max-w-lg">
        <Card className="space-y-4 p-8 text-center">
          <h1 className="font-display text-xl font-extrabold text-brand-dark">
            Cadastro recebido!
          </h1>
          <p className="text-[14px] leading-relaxed text-gray-500">
            Obrigado, {nome.split(' ')[0]}. Registramos o interesse de{' '}
            <strong>{organizacaoNome}</strong>. Nossa equipe pode entrar em
            contato para parceria ou demonstração.
          </p>
          <Link to="/evento" className="inline-block font-bold text-brand-500">
            ← Voltar
          </Link>
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <div>
        <Link to="/evento" className="text-[13px] font-bold text-brand-500 hover:underline">
          ← Escolher outro perfil
        </Link>
        <h1 className="mt-2 font-display text-[24px] font-extrabold text-brand-dark">
          Cadastro — Parceiro
        </h1>
        <p className="mt-1 text-[13.5px] text-gray-500">
          ONG, prefeitura, clínica, pet shop e outros. Coleta para contato —
          não cria conta automaticamente.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <h2 className="font-display text-[15px] font-extrabold text-brand-dark">
            Organização
          </h2>
          <Input
            label="Nome da organização *"
            value={organizacaoNome}
            onChange={(e) => setOrganizacaoNome(e.target.value)}
            required
          />
          <Select
            label="Tipo *"
            value={organizacaoTipo}
            onChange={(e) =>
              setOrganizacaoTipo(e.target.value as EventoOrgTipo)
            }
          >
            {EVENTO_ORG_TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          {organizacaoTipo === 'outro' && (
            <Input
              label="Qual tipo? *"
              value={organizacaoTipoOutro}
              onChange={(e) => setOrganizacaoTipoOutro(e.target.value)}
              required
            />
          )}
          <Input
            label="CNPJ (opcional)"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />

          <h2 className="pt-2 font-display text-[15px] font-extrabold text-brand-dark">
            Responsável
          </h2>
          <Input
            label="Nome do responsável *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Cargo / função *"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            required
            placeholder="Diretor, veterinário, gestor…"
          />
          <Input
            label="E-mail institucional *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Telefone / WhatsApp *"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            required
            autoComplete="tel"
          />

          <h2 className="pt-2 font-display text-[15px] font-extrabold text-brand-dark">
            Atuação
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                label="Cidade *"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                required
              />
            </div>
            <Select
              label="UF *"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              required
            >
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Região / bairros de atuação"
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            placeholder="Ex.: Zona Sul, região metropolitana…"
          />
          <Select
            label="Volume aproximado de animais / mês"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          >
            <option value="">Prefiro não informar</option>
            <option value="1-10">1 a 10</option>
            <option value="11-50">11 a 50</option>
            <option value="51-200">51 a 200</option>
            <option value="200+">Mais de 200</option>
          </Select>

          <fieldset>
            <legend className="mb-2 text-[13.5px] font-bold text-brand-dark">
              Interesses
            </legend>
            <div className="space-y-2">
              {EVENTO_INTERESSES_PARCEIRO.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-brand-50/80 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-brand-500"
                    checked={interesses.includes(item.id)}
                    onChange={() => toggleInteresse(item.id)}
                  />
                  <span className="text-[13px] text-brand-dark">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Select
            label="Já usa algum sistema de gestão de animais?"
            value={jaUsaSistema ? 'sim' : 'nao'}
            onChange={(e) => setJaUsaSistema(e.target.value === 'sim')}
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </Select>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-brand-50 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-500"
              checked={aceitaContato}
              onChange={(e) => setAceitaContato(e.target.checked)}
            />
            <span className="text-[13px] leading-relaxed text-gray-700">
              Autorizo a MyPetID a contatar a organização após o evento.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-brand-50 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-500"
              checked={lgpd}
              onChange={(e) => setLgpd(e.target.checked)}
              required
            />
            <span className="text-[13px] leading-relaxed text-gray-700">
              Li e aceito o tratamento dos dados conforme a LGPD, só para fins
              deste cadastro e contato comercial/parceria. *
            </span>
          </label>

          {error && (
            <p className="rounded-[12px] bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Enviando…' : 'Enviar cadastro'}
          </Button>
        </form>
      </Card>
    </section>
  )
}
