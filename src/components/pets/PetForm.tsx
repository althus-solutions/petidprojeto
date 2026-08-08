import { useEffect, useState, type FormEvent } from 'react'
import type { CampoFormularioPet, PetFormValues } from '@/types/pet'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'

interface PetFormProps {
  campos: CampoFormularioPet[]
  initialValues?: PetFormValues
  onSubmit: (values: PetFormValues) => Promise<void>
  submitLabel?: string
}

export function PetForm({
  campos,
  initialValues = {},
  onSubmit,
  submitLabel = 'Salvar pet',
}: PetFormProps) {
  const [values, setValues] = useState<PetFormValues>(initialValues)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function setField(nome: string, valor: string | number | File | null) {
    setValues((prev) => ({ ...prev, [nome]: valor }))
  }

  function fieldLabel(label: string, obrigatorio?: boolean) {
    return obrigatorio ? `${label} *` : label
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    for (const campo of campos) {
      if (!campo.obrigatorio || campo.tipo === 'foto') continue
      const valor = values[campo.nome]
      if (valor === undefined || valor === null || valor === '') {
        setError(`O campo "${campo.label}" é obrigatório.`)
        return
      }
    }

    setLoading(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar pet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {campos.map((campo) => {
        if (campo.tipo === 'foto') {
          return (
            <div key={campo.nome} className="space-y-1.5">
              <span className="text-[13.5px] font-bold text-brand-dark">
                {fieldLabel(campo.label, campo.obrigatorio)}
              </span>
              <div className="flex items-center gap-3 rounded-input border-[1.5px] border-dashed border-surface-border bg-brand-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6C4FE0"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M8 5l1.5-2h5L16 5" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-brand-dark">
                    {fileName ?? 'Nenhum arquivo escolhido'}
                  </p>
                  <p className="text-xs text-gray-500">JPG ou PNG, até 5MB</p>
                </div>
                <label className="shrink-0 cursor-pointer rounded-full border-[1.5px] border-brand-500 bg-white px-4 py-2 text-xs font-bold text-brand-500 transition-colors hover:bg-brand-50">
                  Escolher arquivo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      setField('foto', file)
                      setFileName(file?.name ?? null)
                      if (preview) URL.revokeObjectURL(preview)
                      setPreview(file ? URL.createObjectURL(file) : null)
                    }}
                  />
                </label>
              </div>
              {preview && (
                <img
                  src={preview}
                  alt="Prévia da foto"
                  className="mt-2 h-40 w-40 rounded-2xl border border-surface-border object-cover"
                />
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
      })}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        className="mt-2 w-full text-[15px]"
      >
        {loading ? 'Salvando…' : submitLabel}
      </Button>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-400">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        Estes campos são definidos pelo administrador da plataforma.
      </p>
    </form>
  )
}
