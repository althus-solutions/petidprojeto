import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import {
  abrirConversaPet,
  enviarMensagemFinder,
  enviarMensagemTutor,
  enviarMidiaFinder,
  enviarMidiaTutor,
  enviarPedidoLigacaoFinder,
  enviarPedidoLigacaoTutor,
  extrairTelefoneMensagem,
  listarConversasFinder,
  listarConversasTutor,
  listarMensagensFinder,
  listarMensagensTutor,
} from '@/lib/chat'
import { useAuth } from '@/contexts/AuthContext'
import {
  subtituloConversa,
  tituloConversa,
  type ChatConversaResumo,
  type ChatMensagem,
} from '@/types/chat'
import { Button } from '@/components/ui/Button'

export type ChatScreenMode = 'tutor' | 'finder'

interface ChatScreenProps {
  mode: ChatScreenMode
  backTo: string
  backLabel?: string
  qrPayload?: string | null
  leituraId?: string | null
  autoStart?: boolean
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

export function ChatScreen({
  mode,
  backTo,
  backLabel = 'Voltar',
  qrPayload,
  leituraId,
  autoStart = false,
}: ChatScreenProps) {
  const { user } = useAuth()
  const [conversas, setConversas] = useState<ChatConversaResumo[]>([])
  const [active, setActive] = useState<ChatConversaResumo | null>(null)
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const loadConversas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const lista =
        mode === 'tutor'
          ? await listarConversasTutor()
          : await listarConversasFinder()
      setConversas(lista)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar o chat.',
      )
    } finally {
      setLoading(false)
    }
  }, [mode])

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
    [mode],
  )

  const startOrOpenFinderChat = useCallback(async () => {
    if (mode !== 'finder' || !qrPayload) return
    setLoading(true)
    setError(null)
    try {
      const opened = await abrirConversaPet({
        qrPayload,
        leituraId,
      })
      const resumo: ChatConversaResumo = {
        id: opened.conversa_id,
        animal_id: '',
        animal_nome: opened.animal_nome,
        finder_rotulo: opened.finder_rotulo,
        updated_at: new Date().toISOString(),
        nao_lidas: 0,
        ultima_mensagem: null,
      }
      setActive(resumo)

      let msgs = await listarMensagensFinder(opened.conversa_id)
      if (leituraId && msgs.length === 0) {
        const autoMsg = await enviarMensagemFinder(
          opened.conversa_id,
          `Confirmei o resgate de ${opened.animal_nome} pela tag MyPetID.`,
        )
        msgs = [autoMsg]
      }

      setMensagens(msgs)
      await loadConversas()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível iniciar a conversa. Aplique a migration 020/034.',
      )
    } finally {
      setLoading(false)
    }
  }, [leituraId, loadConversas, mode, qrPayload])

  useEffect(() => {
    void loadConversas()
  }, [loadConversas])

  useEffect(() => {
    if (!autoStart || mode !== 'finder' || started.current) return
    started.current = true
    void startOrOpenFinderChat()
  }, [autoStart, mode, startOrOpenFinderChat])

  useEffect(() => {
    if (!active?.id) return
    void loadMensagens(active.id)
    const id = window.setInterval(
      () => void loadMensagens(active.id, { quiet: true }),
      8000,
    )
    return () => window.clearInterval(id)
  }, [active?.id, loadMensagens])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, active?.id])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!active?.id || !texto.trim()) return
    setSending(true)
    setError(null)
    try {
      const msg =
        mode === 'tutor'
          ? await enviarMensagemTutor(active.id, texto)
          : await enviarMensagemFinder(active.id, texto)
      setMensagens((prev) => [...prev, msg])
      setTexto('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar.')
    } finally {
      setSending(false)
    }
  }

  async function handlePhoto(file: File | null) {
    if (!file || !active?.id) return
    setSending(true)
    setError(null)
    try {
      const msg =
        mode === 'tutor'
          ? await enviarMidiaTutor(active.id, file, 'imagem')
          : await enviarMidiaFinder(active.id, file, 'imagem')
      setMensagens((prev) => [...prev, msg])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao enviar foto. Aplique a migration 034.',
      )
    } finally {
      setSending(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  async function toggleAudio() {
    if (!active?.id) return

    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mime })
        const file = new File([blob], `audio-${Date.now()}.webm`, {
          type: mime,
        })
        void (async () => {
          setSending(true)
          setError(null)
          try {
            const msg =
              mode === 'tutor'
                ? await enviarMidiaTutor(active.id, file, 'audio')
                : await enviarMidiaFinder(active.id, file, 'audio')
            setMensagens((prev) => [...prev, msg])
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : 'Falha ao enviar áudio. Aplique a migration 034.',
            )
          } finally {
            setSending(false)
          }
        })()
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError('Não foi possível acessar o microfone.')
    }
  }

  async function handleLigar() {
    if (!active?.id) return
    const ok = window.confirm(
      mode === 'tutor'
        ? 'Compartilhar seu telefone nesta conversa para facilitar a ligação?'
        : 'Pedir uma ligação ao tutor?',
    )
    if (!ok) return

    setSending(true)
    setError(null)
    try {
      const msg =
        mode === 'tutor'
          ? await enviarPedidoLigacaoTutor(active.id, user?.tutor?.telefone)
          : await enviarPedidoLigacaoFinder(active.id)
      setMensagens((prev) => [...prev, msg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao solicitar ligação.')
    } finally {
      setSending(false)
    }
  }

  const meAutor = mode === 'tutor' ? 'tutor' : 'finder'
  const headerTitle = active
    ? tituloConversa(active, mode)
    : 'Mensagens'
  const headerSub = active
    ? subtituloConversa(active)
    : mode === 'tutor'
      ? 'Conversas com quem encontrou seu pet'
      : 'Fale com o tutor pela MyPetID'

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-surface-border bg-white px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {active ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-500 hover:bg-brand-50"
            aria-label="Voltar para lista"
            onClick={() => {
              setActive(null)
              setMensagens([])
              void loadConversas()
            }}
          >
            <BackIcon />
          </button>
        ) : (
          <Link
            to={backTo}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-500 hover:bg-brand-50"
            aria-label={backLabel}
          >
            <BackIcon />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[16px] font-extrabold text-brand-dark">
            {headerTitle}
          </p>
          <p className="truncate text-[11.5px] text-gray-500">{headerSub}</p>
        </div>
        {active && (
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-500 hover:bg-brand-50"
            aria-label="Ligar"
            disabled={sending}
            onClick={() => void handleLigar()}
          >
            <PhoneIcon />
          </button>
        )}
      </header>

      {!active ? (
        <div className="flex-1 overflow-y-auto bg-brand-50/40 px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {loading && (
            <p className="p-4 text-center text-sm text-gray-500">Carregando…</p>
          )}
          {error && (
            <p className="mb-3 rounded-[14px] bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              {error}
            </p>
          )}
          {!loading && conversas.length === 0 && (
            <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
              <p className="max-w-xs text-sm text-gray-500">
                {mode === 'finder'
                  ? 'Nenhuma conversa ainda. Inicie o chat sobre este pet.'
                  : 'Nenhuma mensagem ainda. Quando alguém confirmar um resgate e escrever, aparece aqui.'}
              </p>
              {mode === 'finder' && qrPayload && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void startOrOpenFinderChat()}
                >
                  Iniciar conversa
                </Button>
              )}
            </div>
          )}
          <ul className="mx-auto max-w-lg space-y-1">
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-2xl border border-surface-border bg-white px-3.5 py-3 text-left shadow-card"
                  onClick={() => setActive(c)}
                >
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                    <UserMini />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-bold text-brand-dark">
                        {tituloConversa(c, mode)}
                      </span>
                      {c.nao_lidas > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {c.nao_lidas}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] font-semibold text-brand-500/80">
                      {subtituloConversa(c)}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-gray-500">
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
              const tipo = m.tipo ?? 'texto'
              const tel = tipo === 'chamada' ? extrairTelefoneMensagem(m.corpo) : null
              return (
                <div
                  key={m.id}
                  className={['flex', mine ? 'justify-end' : 'justify-start'].join(
                    ' ',
                  )}
                >
                  <div
                    className={[
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed',
                      mine
                        ? 'rounded-br-md bg-brand-500 text-white'
                        : 'rounded-bl-md bg-white text-brand-dark shadow-sm',
                    ].join(' ')}
                  >
                    {tipo === 'imagem' && m.midia_url && (
                      <a href={m.midia_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.midia_url}
                          alt="Foto enviada"
                          className="mb-1.5 max-h-56 w-full rounded-xl object-cover"
                        />
                      </a>
                    )}
                    {tipo === 'audio' && m.midia_url && (
                      <audio
                        controls
                        src={m.midia_url}
                        className="mb-1.5 max-w-full"
                      />
                    )}
                    {tipo === 'chamada' && (
                      <p className="mb-1 text-[12px] font-bold opacity-90">
                        📞 Pedido de ligação
                      </p>
                    )}
                    {(tipo === 'texto' ||
                      tipo === 'chamada' ||
                      (m.corpo && m.corpo !== 'Foto' && m.corpo !== 'Áudio')) && (
                      <p>{m.corpo}</p>
                    )}
                    {tel && (
                      <a
                        href={`tel:+${tel}`}
                        className={[
                          'mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold',
                          mine
                            ? 'bg-white/20 text-white'
                            : 'bg-brand-50 text-brand-500',
                        ].join(' ')}
                      >
                        <PhoneIcon /> Ligar agora
                      </a>
                    )}
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

          <div className="shrink-0 border-t border-surface-border bg-white px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center gap-1 px-1">
              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
              />
              <IconBtn
                label="Enviar foto"
                disabled={sending}
                onClick={() => photoRef.current?.click()}
              >
                <CameraIcon />
              </IconBtn>
              <IconBtn
                label={recording ? 'Parar gravação' : 'Enviar áudio'}
                disabled={sending}
                active={recording}
                onClick={() => void toggleAudio()}
              >
                <MicIcon />
              </IconBtn>
              <IconBtn
                label="Ligar"
                disabled={sending}
                onClick={() => void handleLigar()}
              >
                <PhoneIcon />
              </IconBtn>
              {recording && (
                <span className="ml-1 text-[12px] font-bold text-red-500">
                  Gravando… toque no microfone para enviar
                </span>
              )}
            </div>
            <form
              onSubmit={(e) => void handleSend(e)}
              className="flex gap-2 px-1"
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva uma mensagem…"
                maxLength={2000}
                disabled={recording}
                className="min-w-0 flex-1 rounded-full border border-surface-border bg-brand-50/50 px-4 py-2.5 text-[14px] outline-none focus:border-brand-500"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={sending || recording || !texto.trim()}
                className="shrink-0 !rounded-full px-5"
              >
                Enviar
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-40',
        active
          ? 'bg-red-500 text-white'
          : 'text-brand-500 hover:bg-brand-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function UserMini() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 6l1.5-2h5L16 6" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8.1 9.6a16 16 0 006.3 6.3l1.2-1.2a2 2 0 012.1-.5c.8.3 1.7.6 2.6.7A2 2 0 0122 16.9z" />
    </svg>
  )
}
