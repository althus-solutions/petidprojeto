import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { mapEventoError, registrarCadastroEvento } from '@/lib/evento'
import {
  EVENTO_ESPECIES,
  EVENTO_INTERESSES_TUTOR,
} from '@/types/evento'

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function EventoTutorFormPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('SP')
  const [qtdPets, setQtdPets] = useState('1')
  const [especies, setEspecies] = useState<string[]>([])
  const [jaConhece, setJaConhece] = useState(false)
  const [interesses, setInteresses] = useState<string[]>([])
  const [comoSoube, setComoSoube] = useState('')
  const [aceitaContato, setAceitaContato] = useState(true)
  const [lgpd, setLgpd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (especies.length === 0) {
      setError('Selecione ao menos uma espécie de pet.')
      return
    }
    if (!lgpd) {
      setError('Aceite o consentimento LGPD para continuar.')
      return
    }
    setLoading(true)
    try {
      await registrarCadastroEvento({
        tipo_publico: 'tutor',
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        qtd_pets: Number(qtdPets) || 0,
        especies_pets: especies,
        ja_conhece_mypetid: jaConhece,
        interesses_tutor: interesses,
        como_soube: comoSoube.trim(),
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
            Obrigado, {nome.split(' ')[0]}. Nossa equipe pode entrar em contato
            com novidades do MyPetID após o evento.
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
          Cadastro — Tutor
        </h1>
        <p className="mt-1 text-[13.5px] text-gray-500">
          Preencha para registrarmos seu interesse no evento. Não cria conta —
          só coleta para contato.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <Input
            label="Nome completo *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="E-mail *"
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
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
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

          <Select
            label="Quantos pets você tem / cuida? *"
            value={qtdPets}
            onChange={(e) => setQtdPets(e.target.value)}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={String(n)}>
                {n === 0 ? 'Ainda não tenho' : n === 10 ? '10+' : String(n)}
              </option>
            ))}
          </Select>

          <fieldset>
            <legend className="mb-2 text-[13.5px] font-bold text-brand-dark">
              Espécie(s) *
            </legend>
            <div className="flex flex-wrap gap-2">
              {EVENTO_ESPECIES.map((esp) => {
                const on = especies.includes(esp.id)
                return (
                  <button
                    key={esp.id}
                    type="button"
                    onClick={() => toggle(especies, esp.id, setEspecies)}
                    className={[
                      'rounded-full px-3 py-1.5 text-[12px] font-bold',
                      on
                        ? 'bg-brand-500 text-white'
                        : 'bg-brand-50 text-brand-700',
                    ].join(' ')}
                  >
                    {esp.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[13.5px] font-bold text-brand-dark">
              O que mais te interessa?
            </legend>
            <div className="space-y-2">
              {EVENTO_INTERESSES_TUTOR.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-brand-50/80 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-brand-500"
                    checked={interesses.includes(item.id)}
                    onChange={() =>
                      toggle(interesses, item.id, setInteresses)
                    }
                  />
                  <span className="text-[13px] text-brand-dark">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Select
            label="Já conhece o MyPetID?"
            value={jaConhece ? 'sim' : 'nao'}
            onChange={(e) => setJaConhece(e.target.value === 'sim')}
          >
            <option value="nao">Ainda não</option>
            <option value="sim">Sim</option>
          </Select>

          <Input
            label="Como soube do evento?"
            value={comoSoube}
            onChange={(e) => setComoSoube(e.target.value)}
            placeholder="Instagram, indicação, feira…"
          />

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-brand-50 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-500"
              checked={aceitaContato}
              onChange={(e) => setAceitaContato(e.target.checked)}
            />
            <span className="text-[13px] leading-relaxed text-gray-700">
              Autorizo a MyPetID a me contatar após o evento sobre a plataforma.
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
              Li e aceito o tratamento dos meus dados conforme a LGPD, só para
              fins deste cadastro e contato relacionado. *
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
