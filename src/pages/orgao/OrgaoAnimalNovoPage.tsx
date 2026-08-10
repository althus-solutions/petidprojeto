import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import {
  criarAnimalOrganizacao,
  mapOrgaoAnimalError,
  STATUS_ANIMAL_ORG,
} from '@/lib/orgao-animais'
import type { AnimalOrganizacaoStatus } from '@/types/orgao-animais'

export function OrgaoAnimalNovoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const orgId = user?.organizacao?.id

  const [nome, setNome] = useState('')
  const [especie, setEspecie] = useState('')
  const [sexo, setSexo] = useState('')
  const [porte, setPorte] = useState('')
  const [cor, setCor] = useState('')
  const [raca, setRaca] = useState('')
  const [microchip, setMicrochip] = useState('')
  const [caracteristicas, setCaracteristicas] = useState('')
  const [status, setStatus] =
    useState<AnimalOrganizacaoStatus>('sob_cuidados')
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!orgId) {
      setError('Organização não encontrada.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await criarAnimalOrganizacao(
        {
          nome,
          especie,
          sexo,
          porte,
          cor,
          raca,
          microchip,
          caracteristicas,
          foto,
          status,
        },
        orgId,
      )
      navigate('/orgao/animais')
    } catch (err) {
      setError(
        mapOrgaoAnimalError(
          err instanceof Error ? err.message : 'Erro ao cadastrar.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-[13px] font-semibold text-gray-500">
          <Link to="/orgao/animais" className="text-brand-500 hover:underline">
            Animais
          </Link>
          {' · '}
          Novo
        </p>
        <h1 className="mt-1 font-display text-[22px] font-extrabold text-brand-dark">
          Cadastrar animal
        </h1>
        <p className="mt-1 text-[13.5px] text-gray-500">
          Inclui no inventário da sua organização. Para acionar o matching
          automático, use também “Encontrei um animal”.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 rounded-[18px] border border-surface-border bg-white p-5 shadow-card"
      >
        <label className="block cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-surface-border bg-brand-50 px-4 py-5 text-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              setFoto(file)
              if (preview) URL.revokeObjectURL(preview)
              setPreview(file ? URL.createObjectURL(file) : null)
            }}
          />
          {preview ? (
            <img
              src={preview}
              alt=""
              className="mx-auto mb-2 h-36 rounded-[12px] object-cover"
            />
          ) : null}
          <span className="text-[13px] font-bold text-brand-dark">
            {preview ? 'Trocar foto' : 'Adicionar foto (opcional)'}
          </span>
        </label>

        <Input
          label="Nome (se conhecido)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Thor / Desconhecido"
        />
        <Select
          label="Espécie"
          value={especie}
          onChange={(e) => setEspecie(e.target.value)}
        >
          <option value="">Selecione</option>
          <option value="Cão">Cão</option>
          <option value="Gato">Gato</option>
          <option value="Outro">Outro</option>
        </Select>
        <Select
          label="Sexo"
          value={sexo}
          onChange={(e) => setSexo(e.target.value)}
        >
          <option value="">Selecione</option>
          <option value="Macho">Macho</option>
          <option value="Fêmea">Fêmea</option>
          <option value="Não sei">Não sei</option>
        </Select>
        <Select
          label="Porte"
          value={porte}
          onChange={(e) => setPorte(e.target.value)}
        >
          <option value="">Selecione</option>
          <option value="Pequeno">Pequeno</option>
          <option value="Médio">Médio</option>
          <option value="Grande">Grande</option>
        </Select>
        <Input
          label="Cor"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
        />
        <Input
          label="Raça"
          value={raca}
          onChange={(e) => setRaca(e.target.value)}
        />
        <Input
          label="Número do microchip"
          value={microchip}
          onChange={(e) => setMicrochip(e.target.value)}
          placeholder="Opcional — 15 dígitos ou código nacional"
          inputMode="text"
          autoComplete="off"
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as AnimalOrganizacaoStatus)
          }
        >
          {STATUS_ANIMAL_ORG.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Textarea
          label="Características"
          value={caracteristicas}
          onChange={(e) => setCaracteristicas(e.target.value)}
          rows={3}
        />

        {error && (
          <p className="rounded-[12px] bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <ButtonLink to="/orgao/animais" variant="outline" size="sm">
            Cancelar
          </ButtonLink>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar no inventário'}
          </Button>
        </div>
      </form>
    </section>
  )
}
