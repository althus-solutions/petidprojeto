import { useEffect, useId, useState, type FormEvent } from 'react'
import { TutorEnderecoFields } from '@/components/tutor/TutorEnderecoFields'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import {
  deleteTutorEndereco,
  getTutorEndereco,
  upsertTutorEndereco,
} from '@/lib/tutor-enderecos'
import {
  getTutorPhotoSignedUrl,
  listTutorContatos,
  mapPerfilError,
  salvarPerfilTutor,
} from '@/lib/tutor-perfil'
import type { TutorEndereco } from '@/types/tutor-endereco'
import type { TutorContato } from '@/types/tutor-perfil'

type ContatoDraft = TutorContato & { key: string }

function newContatoKey() {
  return `tmp_${crypto.randomUUID()}`
}

function toDraft(contato: TutorContato): ContatoDraft {
  return {
    ...contato,
    key: contato.id ?? newContatoKey(),
  }
}

export function TutorProfilePage() {
  const { user, refreshUser } = useAuth()
  const formId = useId()

  const [nome, setNome] = useState('')
  const [contatos, setContatos] = useState<ContatoDraft[]>([])
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [endereco, setEndereco] = useState<TutorEndereco | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  useEffect(() => {
    async function load() {
      if (!user?.tutor?.id) {
        setError('Perfil de tutor não encontrado.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        setNome(user.tutor.nome)
        setFotoPath(user.tutor.foto_url ?? null)
        setFotoFile(null)

        if (user.tutor.foto_url) {
          const signed = await getTutorPhotoSignedUrl(user.tutor.foto_url)
          setFotoPreview(signed)
        } else {
          setFotoPreview(null)
        }

        try {
          setEndereco(await getTutorEndereco(user.tutor.id))
        } catch {
          setEndereco(null)
        }

        let lista: TutorContato[] = []
        try {
          lista = await listTutorContatos(user.tutor.id)
        } catch {
          // Migration 015 ainda não aplicada: fallback para telefone único
          lista = []
        }

        if (lista.length === 0 && user.tutor.telefone) {
          lista = [
            {
              telefone: user.tutor.telefone,
              rotulo: 'Principal',
              principal: true,
            },
          ]
        }

        if (lista.length === 0) {
          lista = [{ telefone: '', rotulo: 'Celular', principal: true }]
        }

        setContatos(lista.map(toDraft))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar perfil.',
        )
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [user])

  function handleFotoChange(file: File | null) {
    if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
    setFotoFile(file)
    setFotoPreview(file ? URL.createObjectURL(file) : null)
  }

  function updateContato(key: string, patch: Partial<TutorContato>) {
    setContatos((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    )
  }

  function setPrincipal(key: string) {
    setContatos((prev) =>
      prev.map((c) => ({ ...c, principal: c.key === key })),
    )
  }

  function addContato() {
    setContatos((prev) => [
      ...prev,
      {
        key: newContatoKey(),
        telefone: '',
        rotulo: 'Outro',
        principal: prev.length === 0,
      },
    ])
  }

  function removeContato(key: string) {
    setContatos((prev) => {
      const next = prev.filter((c) => c.key !== key)
      if (next.length === 0) {
        return [
          {
            key: newContatoKey(),
            telefone: '',
            rotulo: 'Celular',
            principal: true,
          },
        ]
      }
      if (!next.some((c) => c.principal)) {
        next[0] = { ...next[0], principal: true }
      }
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user?.tutor?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const filled = contatos.filter((c) => c.telefone.trim().length > 0)
      if (filled.length === 0) {
        setError('Informe ao menos um telefone de contato.')
        return
      }
      if (!filled.some((c) => c.principal)) {
        filled[0] = { ...filled[0], principal: true }
      }

      const result = await salvarPerfilTutor(user.tutor.id, {
        nome,
        canal_notificacao_preferido:
          user.tutor.canal_notificacao_preferido ?? 'email',
        contatos: filled.map(({ telefone, rotulo, principal }) => ({
          telefone,
          rotulo,
          principal,
        })),
        fotoFile,
        foto_url: fotoPath,
      })

      setContatos(result.contatos.map(toDraft))
      setFotoPath(result.foto_url)
      setFotoFile(null)
      if (result.foto_url) {
        const signed = await getTutorPhotoSignedUrl(result.foto_url)
        if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
        setFotoPreview(signed)
      }
      await refreshUser()
      setSuccess('Perfil atualizado com sucesso.')
    } catch (err) {
      setError(
        mapPerfilError(
          err instanceof Error ? err.message : 'Erro ao salvar perfil.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-[620px] space-y-6">
      <TutorBackLink to="/tutor/perfil">Voltar ao perfil</TutorBackLink>

      <div>
        <h1 className="font-display text-[25px] font-extrabold text-brand-dark">
          Meu perfil
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Atualize foto, dados, endereço (só no seu mapa) e telefones de contato.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando perfil…</p>}

      {!loading && (
        <Card className="p-8 sm:px-10">
          <form id={formId} className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-[13.5px] font-bold text-brand-dark">
                  Foto do tutor
                </span>
                <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-dashed border-surface-border bg-[#fbfaff] p-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-500">
                    {fotoPreview ? (
                      <img
                        src={fotoPreview}
                        alt="Foto do tutor"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <circle cx="12" cy="8" r="3.5" />
                        <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="inline-flex cursor-pointer">
                      <span className="rounded-full border-[1.5px] border-brand-500 px-4 py-2 text-[13px] font-bold text-brand-500 transition-colors hover:bg-brand-50">
                        {fotoPreview ? 'Trocar foto' : 'Escolher foto'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) =>
                          handleFotoChange(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <p className="text-[12.5px] text-gray-500">
                      JPG, PNG ou WebP. A foto fica só no seu perfil.
                    </p>
                  </div>
                </div>
              </div>

              <Input
                label="Nome completo *"
                name="tutor-perfil-nome"
                autoComplete="name"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />

              <Input
                label="E-mail"
                type="email"
                value={user?.email ?? user?.tutor?.email ?? ''}
                disabled
                hint="O e-mail de login não pode ser alterado nesta tela."
              />
            </div>

            <div className="space-y-3 border-t border-surface-border pt-6">
              <div>
                <h2 className="font-display text-base font-extrabold text-brand-dark">
                  Endereço
                </h2>
                <p className="mt-1 text-[12.5px] text-gray-500">
                  Aparece só no seu mapa de ocorrências. Nunca é mostrado para
                  quem encontrar o pet. Com a Geocoding API do Google
                  configurada, o pin usa o número da casa com precisão.
                </p>
              </div>
              <TutorEnderecoFields
                initial={endereco}
                onSave={async (draft) => {
                  if (!user?.tutor?.id) return
                  const saved = await upsertTutorEndereco(user.tutor.id, {
                    cep: draft.cep || null,
                    logradouro: draft.logradouro,
                    numero: draft.numero || null,
                    complemento: draft.complemento || null,
                    bairro: draft.bairro || null,
                    cidade: draft.cidade,
                    estado: draft.estado,
                    latitude: draft.latitude ?? undefined,
                    longitude: draft.longitude ?? undefined,
                  })
                  setEndereco(saved)
                }}
                onRemove={async () => {
                  if (!user?.tutor?.id) return
                  await deleteTutorEndereco(user.tutor.id)
                  setEndereco(null)
                }}
              />
            </div>

            <div className="space-y-3 border-t border-surface-border pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-extrabold text-brand-dark">
                    Telefones de contato
                  </h2>
                  <p className="mt-1 text-[12.5px] text-gray-500">
                    Marque o número principal — é o que recebe WhatsApp e aparece
                    para quem confirma o resgate na tag.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addContato}
                >
                  + Adicionar número
                </Button>
              </div>

              <ul className="space-y-3">
                {contatos.map((contato, index) => (
                  <li
                    key={contato.key}
                    className="rounded-[14px] border border-surface-border bg-[#fbfaff] p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-brand-dark">
                        <input
                          type="radio"
                          name={`${formId}-principal`}
                          className="accent-brand-500"
                          checked={contato.principal}
                          onChange={() => setPrincipal(contato.key)}
                        />
                        Número principal
                      </label>
                      {contatos.length > 1 && (
                        <button
                          type="button"
                          className="text-[12.5px] font-semibold text-gray-400 hover:text-red-600"
                          onClick={() => removeContato(contato.key)}
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={`Telefone ${index + 1} *`}
                        name={`tutor-telefone-${contato.key}`}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="11999998888"
                        value={contato.telefone}
                        onChange={(e) =>
                          updateContato(contato.key, {
                            telefone: e.target.value,
                          })
                        }
                        hint="Com DDD, só números"
                      />
                      <Input
                        label="Rótulo"
                        name={`tutor-rotulo-${contato.key}`}
                        placeholder="Celular, Trabalho…"
                        value={contato.rotulo ?? ''}
                        onChange={(e) =>
                          updateContato(contato.key, {
                            rotulo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-[14px] bg-[#E7F8EF] px-4 py-3 text-sm text-[#1F9D55]">
                {success}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full py-[15px] text-[15px]"
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar perfil'}
            </Button>
          </form>
        </Card>
      )}
    </section>
  )
}
