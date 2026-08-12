import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type {
  CampoFormularioPet,
  FotoSlot,
  PetFormValues,
  PetFotoSlotValue,
} from '@/types/pet'
import { FOTO_SLOTS, MAX_PET_FOTO_BYTES, MAX_PET_FOTOS } from '@/types/pet'
import { validatePetFotoFile } from '@/lib/pets'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'

interface PetFormProps {
  campos: CampoFormularioPet[]
  initialValues?: PetFormValues
  onSubmit: (values: PetFormValues) => Promise<void>
  submitLabel?: string
  /** create = cadastro; edit = atualiza dados/fotos sem alterar QR/link */
  mode?: 'create' | 'edit'
}

function slotTemFoto(slot: PetFotoSlotValue | undefined): boolean {
  return Boolean(slot?.file instanceof File || slot?.storagePath)
}

function emptyFotoSlots(): PetFotoSlotValue[] {
  return FOTO_SLOTS.map((s) => ({ slot: s.slot, file: null, previewUrl: null }))
}

export function PetForm({
  campos,
  initialValues = {},
  onSubmit,
  submitLabel = 'Salvar pet',
  mode = 'create',
}: PetFormProps) {
  const [values, setValues] = useState<PetFormValues>(() => ({
    idade_modo: 'estimada',
    idade_estimada_unidade: 'anos',
    cores: [],
    fotos: emptyFotoSlots(),
    consentimento_fotos: false,
    ...initialValues,
  }))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fotoSlots = useMemo(() => {
    const slots = values.fotos
    if (Array.isArray(slots) && slots.length > 0) {
      return slots as PetFotoSlotValue[]
    }
    return emptyFotoSlots()
  }, [values.fotos])

  const fotoCampo = useMemo(
    () => campos.find((c) => c.tipo === 'fotos' || c.tipo === 'foto'),
    [campos],
  )
  const outrosCampos = useMemo(
    () => campos.filter((c) => c.tipo !== 'fotos' && c.tipo !== 'foto'),
    [campos],
  )

  const coresSelecionadas = useMemo(() => {
    const raw = values.cores
    return Array.isArray(raw) ? (raw as string[]) : []
  }, [values.cores])

  useEffect(() => {
    return () => {
      for (const slot of fotoSlots) {
        if (slot.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(slot.previewUrl)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on unmount
  }, [])

  function setField(nome: string, valor: PetFormValues[string]) {
    setValues((prev) => ({ ...prev, [nome]: valor }))
  }

  function fieldLabel(label: string, obrigatorio?: boolean) {
    return obrigatorio ? `${label} *` : label
  }

  function toggleCor(opcao: string) {
    setValues((prev) => {
      const atual = Array.isArray(prev.cores) ? [...(prev.cores as string[])] : []
      const idx = atual.indexOf(opcao)
      if (idx >= 0) atual.splice(idx, 1)
      else atual.push(opcao)
      const next: PetFormValues = { ...prev, cores: atual }
      if (!atual.includes('Outro')) next.cor_outro = ''
      return next
    })
  }

  function setFotoSlot(index: number, file: File | null) {
    setValues((prev) => {
      const atual = Array.isArray(prev.fotos)
        ? ([...(prev.fotos as PetFotoSlotValue[])] as PetFotoSlotValue[])
        : emptyFotoSlots()
      while (atual.length < MAX_PET_FOTOS) {
        const slot = FOTO_SLOTS[atual.length]?.slot ?? ('outro' as FotoSlot)
        atual.push({ slot, file: null, previewUrl: null })
      }

      const old = atual[index]
      if (old?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(old.previewUrl)
      }

      if (file) {
        try {
          validatePetFotoFile(file)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Foto inválida')
          return prev
        }
      }

      atual[index] = {
        slot: FOTO_SLOTS[index]?.slot ?? old?.slot ?? 'outro',
        file,
        previewUrl: file ? URL.createObjectURL(file) : null,
        storagePath: null,
      }
      setError(null)
      return { ...prev, fotos: atual }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    for (const campo of campos) {
      if (!campo.obrigatorio) continue
      if (campo.tipo === 'foto' || campo.tipo === 'fotos' || campo.tipo === 'idade') {
        continue
      }
      if (campo.tipo === 'multiselect') {
        const arr = values[campo.nome]
        if (!Array.isArray(arr) || arr.length === 0) {
          setError(`O campo "${campo.label}" é obrigatório.`)
          return
        }
        continue
      }
      const valor = values[campo.nome]
      if (valor === undefined || valor === null || valor === '') {
        setError(`O campo "${campo.label}" é obrigatório.`)
        return
      }
    }

    const filledFotos = fotoSlots.filter(slotTemFoto)
    const fotosObrigatorias = campos.some(
      (c) => (c.tipo === 'fotos' || c.tipo === 'foto') && c.obrigatorio,
    )
    if (fotosObrigatorias && filledFotos.length < 1) {
      setError(
        mode === 'edit'
          ? 'Mantenha ao menos 1 foto do pet.'
          : 'Envie ao menos 1 foto do pet.',
      )
      return
    }
    if (filledFotos.length > MAX_PET_FOTOS) {
      setError(`Máximo de ${MAX_PET_FOTOS} fotos.`)
      return
    }
    for (const slot of filledFotos) {
      if (!(slot.file instanceof File)) continue
      try {
        validatePetFotoFile(slot.file)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Foto inválida')
        return
      }
    }

    if (coresSelecionadas.includes('Outro')) {
      const outro = String(values.cor_outro ?? '').trim()
      if (!outro) {
        setError('Descreva a cor em “Outro”.')
        return
      }
    }

    if (!values.consentimento_fotos) {
      setError('Marque o consentimento para uso das fotos e características.')
      return
    }

    setLoading(true)
    try {
      await onSubmit({ ...values, fotos: fotoSlots })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar pet')
    } finally {
      setLoading(false)
    }
  }

  function renderFotosBlock(campo: CampoFormularioPet) {
    const slot = fotoSlots[0]
    const hasFoto = slotTemFoto(slot)
    const label = campo.label?.replace(/fotos?/i, 'Foto') || 'Foto do pet'

    return (
      <div key={campo.nome} className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[13.5px] font-bold text-brand-dark">
              {fieldLabel(label, true)}
            </span>
            <p className="mt-1 text-[12.5px] text-gray-500">
              JPG ou PNG, até {MAX_PET_FOTO_BYTES / (1024 * 1024)}MB.
              {mode === 'edit'
                ? ' Trocar a foto não altera o QR Code nem o link da tag.'
                : ''}
            </p>
          </div>
          {hasFoto && (
            <button
              type="button"
              className="shrink-0 text-[12px] font-semibold text-gray-400 hover:text-red-600"
              onClick={() => setFotoSlot(0, null)}
            >
              Remover
            </button>
          )}
        </div>
        <div className="rounded-[16px] border border-dashed border-surface-border bg-[#fbfaff] p-4">
          {slot?.previewUrl ? (
            <img
              src={slot.previewUrl}
              alt="Foto do pet"
              className="mb-3 mx-auto aspect-[4/5] max-h-64 w-full max-w-[240px] rounded-2xl bg-brand-50 object-contain"
            />
          ) : (
            <div className="mb-3 mx-auto flex aspect-[4/5] max-h-64 w-full max-w-[240px] items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </div>
          )}
          <div className="flex justify-center">
            <label className="inline-flex cursor-pointer">
              <span className="rounded-full border-[1.5px] border-brand-500 bg-white px-4 py-2 text-[13px] font-bold text-brand-500 hover:bg-brand-50">
                {hasFoto ? 'Trocar foto' : 'Escolher foto'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={(e) => setFotoSlot(0, e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      </div>
    )
  }

  function renderCampo(campo: CampoFormularioPet) {
        if (campo.tipo === 'multiselect') {
          const opcoes = campo.opcoes ?? []
          return (
            <div key={campo.nome} className="space-y-2">
              <span className="text-[13.5px] font-bold text-brand-dark">
                {fieldLabel(campo.label, campo.obrigatorio)}
              </span>
              <div className="flex flex-wrap gap-2">
                {opcoes.map((opcao) => {
                  const active = coresSelecionadas.includes(opcao)
                  return (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => toggleCor(opcao)}
                      className={[
                        'rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                        active
                          ? 'bg-brand-500 text-white'
                          : 'border border-surface-border bg-white text-gray-600 hover:border-brand-500 hover:text-brand-500',
                      ].join(' ')}
                    >
                      {opcao}
                    </button>
                  )
                })}
              </div>
              {coresSelecionadas.includes('Outro') && (
                <Input
                  label="Descreva a outra cor *"
                  value={String(values.cor_outro ?? '')}
                  onChange={(e) => setField('cor_outro', e.target.value)}
                />
              )}
            </div>
          )
        }

        if (campo.tipo === 'idade') {
          const modo = String(values.idade_modo ?? 'estimada')
          return (
            <div key={campo.nome} className="space-y-3">
              <span className="text-[13.5px] font-bold text-brand-dark">
                {fieldLabel(campo.label, campo.obrigatorio)}
              </span>
              <div className="flex gap-2">
                {(
                  [
                    ['estimada', 'Idade estimada'],
                    ['nascimento', 'Data de nascimento'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField('idade_modo', value)}
                    className={[
                      'rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                      modo === value
                        ? 'bg-brand-500 text-white'
                        : 'border border-surface-border bg-white text-gray-600 hover:border-brand-500 hover:text-brand-500',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {modo === 'nascimento' ? (
                <Input
                  label="Data de nascimento"
                  type="date"
                  value={String(values.data_nascimento ?? '')}
                  onChange={(e) => setField('data_nascimento', e.target.value)}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Valor"
                    type="number"
                    min="0"
                    step="1"
                    value={
                      values.idade_estimada_valor === undefined ||
                      values.idade_estimada_valor === null
                        ? ''
                        : String(values.idade_estimada_valor)
                    }
                    onChange={(e) =>
                      setField('idade_estimada_valor', e.target.value)
                    }
                  />
                  <Select
                    label="Unidade"
                    value={String(values.idade_estimada_unidade ?? 'anos')}
                    onChange={(e) =>
                      setField('idade_estimada_unidade', e.target.value)
                    }
                  >
                    <option value="anos">Anos</option>
                    <option value="meses">Meses</option>
                  </Select>
                </div>
              )}
            </div>
          )
        }

        if (campo.tipo === 'textarea') {
          return (
            <Textarea
              key={campo.nome}
              label={fieldLabel(campo.label, campo.obrigatorio)}
              value={String(values[campo.nome] ?? '')}
              onChange={(e) => setField(campo.nome, e.target.value)}
              rows={3}
            />
          )
        }

        if (campo.tipo === 'select') {
          return (
            <Select
              key={campo.nome}
              label={fieldLabel(campo.label, campo.obrigatorio)}
              value={String(values[campo.nome] ?? '')}
              onChange={(e) => setField(campo.nome, e.target.value)}
              required={campo.obrigatorio}
            >
              <option value="">Selecione…</option>
              {(campo.opcoes ?? []).map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </Select>
          )
        }

        return (
          <Input
            key={campo.nome}
            label={fieldLabel(campo.label, campo.obrigatorio)}
            type={campo.tipo === 'number' ? 'number' : 'text'}
            step={campo.tipo === 'number' ? '0.1' : undefined}
            min={campo.tipo === 'number' ? '0' : undefined}
            value={
              campo.tipo === 'number'
                ? values[campo.nome] === undefined || values[campo.nome] === null
                  ? ''
                  : String(values[campo.nome])
                : String(values[campo.nome] ?? '')
            }
            onChange={(e) => setField(campo.nome, e.target.value)}
            required={campo.obrigatorio}
          />
        )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {renderFotosBlock(
        fotoCampo ?? {
          nome: 'fotos',
          label: 'Foto do pet',
          tipo: 'foto',
          obrigatorio: true,
        },
      )}
      {outrosCampos.map((campo) => renderCampo(campo))}

      <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-surface-border bg-[#fbfaff] px-4 py-3.5">
        <input
          type="checkbox"
          className="mt-1 accent-brand-500"
          checked={Boolean(values.consentimento_fotos)}
          onChange={(e) => setField('consentimento_fotos', e.target.checked)}
        />
        <span className="text-[13px] leading-relaxed text-gray-600">
          Autorizo o uso da foto e características deste pet para fins de
          identificação e matching automático na plataforma, conforme a{' '}
          <Link
            to="/privacidade"
            className="font-semibold text-brand-500 underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        className="mt-2 w-full text-[15px]"
      >
        {loading ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}
