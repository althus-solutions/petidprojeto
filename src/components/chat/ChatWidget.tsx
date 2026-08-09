import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  abrirConversaPet,
  contarNaoLidasFinder,
  contarNaoLidasTutor,
  enviarMensagemFinder,
  enviarMensagemTutor,
  listarConversasFinder,
  listarConversasTutor,
  listarMensagensFinder,
  listarMensagensTutor,
} from '@/lib/chat'
import type { ChatConversaResumo, ChatMensagem } from '@/types/chat'
import { Button } from '@/components/ui/Button'

export type ChatWidgetMode = 'tutor' | 'finder'

interface ChatWidgetProps {
  mode: ChatWidgetMode
  /** Finder: payload da tag para abrir/iniciar conversa deste pet */
  qrPayload?: string | null
  /** Finder: id da leitura após confirmar resgate */
  leituraId?: string | null
  /** Abrir painel automaticamente (ex.: após confirmar resgate) */
  autoOpen?: boolean
  /** Classes extras do FAB (ex.: offset acima da bottom nav) */
  fabClassName?: string
  /** Classes extras do painel de mensagens */
  panelClassName?: string
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function ChatWidget({
  mode,
  qrPayload,
  leituraId,
  autoOpen = false,
  fabClassName,
  panelClassName,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [conversas, setConversas] = useState<ChatConversaResumo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeNome, setActiveNome] = useState<string>('Chat')
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const openedAuto = useRef(false)

  const refreshUnread = useCallback(async () => {
    try {
      const n =
        mode === 'tutor'
          ? await contarNaoLidasTutor()
          : await contarNaoLidasFinder()
      setUnread(n)
    } catch {
      /* ignore */
    }
  }, [mode])

  const loadConversas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const lista =
        mode === 'tutor'
          ? await listarConversasTutor()
          : await listarConversasFinder()
      setConversas(lista)
      await refreshUnread()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar o chat.',
      )
    } finally {
      setLoading(false)
    }
  }, [mode, refreshUnread])

  const loadMensagens = useCallback(
    async (conversaId: string, opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true)
      setError(null)
      try {
        const msgs =
          mode === 'tutor'
            ? await listarMensagensTutor(conversaId)
            : await listarMensagensFinder(conversaId)
        setMensagens(msgs)
        await refreshUnread()
      } catch (err) {
        if (!opts?.quiet) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar mensagens.',
          )
        }
      } finally {
        if (!opts?.quiet) setLoading(false)
      }
    },
    [mode, refreshUnread],
  )

  useEffect(() => {
    void refreshUnread()
    // Tutor: polling mais curto para o badge aparecer após leitura da tag
    const ms = mode === 'tutor' ? 5000 : 12000
    const id = window.setInterval(() => void refreshUnread(), ms)
    return () => window.clearInterval(id)
  }, [mode, refreshUnread])

  const startOrOpenFinderChat = useCallback(async () => {
    if (mode !== 'finder' || !qrPayload) return
    setLoading(true)
    setError(null)
    try {
      const opened = await abrirConversaPet({
        qrPayload,
        leituraId,
      })
      setActiveId(opened.conversa_id)
      setActiveNome(opened.animal_nome)

      // Fallback: se a migration 029 ainda não rodou, garante mensagem
      // para o tutor ver o sinalizador no chat.
      let msgs = await listarMensagensFinder(opened.conversa_id)
      if (leituraId && msgs.length === 0) {
        const autoMsg = await enviarMensagemFinder(
          opened.conversa_id,
          `Confirmei o resgate de ${opened.animal_nome} pela tag PetID.`,
        )
        msgs = [autoMsg]
      }

      setMensagens(msgs)
      await refreshUnread()
      await loadConversas()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível iniciar a conversa. Aplique a migration 020.',
      )
    } finally {
      setLoading(false)
    }
  }, [leituraId, loadConversas, mode, qrPayload, refreshUnread])

  useEffect(() => {
    if (autoOpen && !openedAuto.current) {
      openedAuto.current = true
      setOpen(true)
      void startOrOpenFinderChat()
    }
  }, [autoOpen, startOrOpenFinderChat])

  useEffect(() => {
    if (!open) return
    void loadConversas()
  }, [open, loadConversas])

  useEffect(() => {
    if (!open || !activeId) return
    void loadMensagens(activeId)
    const id = window.setInterval(
      () => void loadMensagens(activeId, { quiet: true }),
      8000,
    )
    return () => window.clearInterval(id)
  }, [open, activeId, loadMensagens])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, open, activeId])

  function togglePanel() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (mode === 'finder' && qrPayload && !activeId) {
      void startOrOpenFinderChat()
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!activeId || !texto.trim()) return
    setSending(true)
    setError(null)
    try {
      const msg =
        mode === 'tutor'
          ? await enviarMensagemTutor(activeId, texto)
          : await enviarMensagemFinder(activeId, texto)
      setMensagens((prev) => [...prev, msg])
      setTexto('')
      await refreshUnread()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar.')
    } finally {
      setSending(false)
    }
  }

  const meAutor = mode === 'tutor' ? 'tutor' : 'finder'

  return (
    <>
      <button
        type="button"
        aria-label={
          unread > 0
            ? `Abrir chat, ${unread} mensagem(ns) nova(s)`
            : 'Abrir chat'
        }
        onClick={togglePanel}
        className={[
          'fixed z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
          fabClassName ?? 'bottom-5 right-5',
        ].join(' ')}
      >

        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a3 3 0 01-3 3H8l-5 3V6a3 3 0 013-3h12a3 3 0 013 3z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={[
            'fixed z-[70] flex h-[min(520px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-xl',
            panelClassName ?? 'bottom-24 right-5',
          ].join(' ')}
        >
          <div className="flex items-center justify-between border-b border-surface-border bg-brand-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-extrabold text-brand-dark">
                {activeId ? activeNome : 'Mensagens'}
              </p>
              <p className="text-[11.5px] text-gray-500">
                {mode === 'tutor'
                  ? 'Conversas com quem encontrou seu pet'
                  : 'Fale com o tutor pela PetID'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {activeId && (
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-[12px] font-semibold text-brand-500 hover:bg-white"
                  onClick={() => {
                    setActiveId(null)
                    setMensagens([])
                    void loadConversas()
                  }}
                >
                  Lista
                </button>
              )}
              <button
                type="button"
                aria-label="Fechar chat"
                className="rounded-full p-1.5 text-gray-500 hover:bg-white hover:text-brand-dark"
                onClick={() => setOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {!activeId ? (
            <div className="flex-1 overflow-y-auto p-3">
              {loading && (
                <p className="p-3 text-sm text-gray-500">Carregando…</p>
              )}
              {error && (
                <p className="mb-2 rounded-[12px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                  {error}
                </p>
              )}
              {!loading && conversas.length === 0 && (
                <div className="space-y-3 p-3 text-center">
                  <p className="text-sm text-gray-500">
                    {mode === 'finder'
                      ? 'Nenhuma conversa ainda. Inicie o chat sobre este pet.'
                      : 'Nenhuma mensagem ainda. Quando alguém confirmar um resgate e escrever, aparece aqui.'}
                  </p>
                  {mode === 'finder' && qrPayload && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => void startOrOpenFinderChat()}
                    >
                      Iniciar conversa
                    </Button>
                  )}
                </div>
              )}
              <ul className="space-y-1">
                {conversas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-brand-50"
                      onClick={() => {
                        setActiveId(c.id)
                        setActiveNome(c.animal_nome)
                      }}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
                          <circle cx="6" cy="9" r="2.2" />
                          <circle cx="18" cy="9" r="2.2" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13.5px] font-bold text-brand-dark">
                            {c.animal_nome}
                          </span>
                          {c.nao_lidas > 0 && (
                            <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                              {c.nao_lidas}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-gray-500">
                          {c.ultima_mensagem ?? 'Sem mensagens'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-[#fbfaff] px-3 py-3">
                {loading && mensagens.length === 0 && (
                  <p className="text-center text-sm text-gray-500">Carregando…</p>
                )}
                {error && (
                  <p className="rounded-[12px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                    {error}
                  </p>
                )}
                {mensagens.map((m) => {
                  const mine = m.autor === meAutor
                  return (
                    <div
                      key={m.id}
                      className={[
                        'flex',
                        mine ? 'justify-end' : 'justify-start',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                          mine
                            ? 'rounded-br-md bg-brand-500 text-white'
                            : 'rounded-bl-md bg-white text-brand-dark shadow-sm',
                        ].join(' ')}
                      >
                        <p>{m.corpo}</p>
                        <p
                          className={[
                            'mt-1 text-[10px]',
                            mine ? 'text-white/70' : 'text-gray-400',
                          ].join(' ')}
                        >
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <form
                onSubmit={(e) => void handleSend(e)}
                className="flex gap-2 border-t border-surface-border p-3"
              >
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escreva uma mensagem…"
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-full border border-surface-border bg-white px-3.5 py-2 text-[13.5px] outline-none focus:border-brand-500"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sending || !texto.trim()}
                  className="shrink-0 !rounded-full px-4"
                >
                  Enviar
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
