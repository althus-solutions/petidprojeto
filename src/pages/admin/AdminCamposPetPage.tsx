import { useEffect, useState } from 'react'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { inputFieldClassName } from '@/components/ui/Input'
import {
  fetchCamposFormularioPet,
  saveCamposFormularioPet,
} from '@/lib/configuracoes'
import type { CampoFormularioPet } from '@/types/pet'

export function AdminCamposPetPage() {
  const [campos, setCampos] = useState<CampoFormularioPet[]>([])
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchCamposFormularioPet()
      .then((lista) => {
        setCampos(lista)
        setJsonText(JSON.stringify({ campos: lista }, null, 2))
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar'),
      )
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setError(null)
    setMessage(null)
    setSaving(true)

    try {
      const parsed = JSON.parse(jsonText) as { campos: CampoFormularioPet[] }
      if (!Array.isArray(parsed.campos)) {
        throw new Error('JSON deve conter um array "campos"')
      }
      await saveCamposFormularioPet(parsed.campos)
      setCampos(parsed.campos)
      setMessage('Campos do formulário atualizados com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <AdminBreadcrumb current="Campos do pet" />

      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-brand-dark">
          Campos do formulário de pet
        </h1>
        <p className="mt-1.5 max-w-[560px] text-sm leading-relaxed text-gray-500">
          RF-01: altere campos sem deploy de código. Tipos suportados: text,
          number, textarea, select, multiselect, idade, foto, fotos.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}

      {!loading && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-surface-border px-7 py-5 sm:px-8">
            <p className="text-[13.5px] font-bold text-brand-dark">
              Configuração JSON
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {campos.length} campo(s) ativos:{' '}
              {campos.map((c) => c.nome).join(', ') || '—'}
            </p>
          </div>

          <div className="bg-[#fbfaff] px-4 py-4 sm:px-6 sm:py-5">
            <label className="block">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={24}
                spellCheck={false}
                aria-label="Configuração JSON dos campos do pet"
                className={`${inputFieldClassName} resize-y border-transparent bg-white font-mono text-[13px] leading-relaxed shadow-sm`}
              />
            </label>
          </div>

          <div className="space-y-4 border-t border-surface-border px-7 py-5 sm:px-8">
            {error && (
              <p className="rounded-[14px] bg-[#FCE9E9] px-4 py-3 text-sm text-[#E85D5D]">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-[14px] bg-[#E7F8EF] px-4 py-3 text-sm text-[#1F9D55]">
                {message}
              </p>
            )}

            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full sm:w-auto"
            >
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </Button>
          </div>
        </Card>
      )}
    </section>
  )
}
