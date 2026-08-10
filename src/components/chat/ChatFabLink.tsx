import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contarNaoLidasTutor } from '@/lib/chat'

/** Botão flutuante que abre a tela cheia de chat do tutor. */
export function ChatFabLink() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const n = await contarNaoLidasTutor()
        if (!cancelled) setUnread(n)
      } catch {
        /* ignore */
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <Link
      to="/tutor/chat"
      aria-label={
        unread > 0
          ? `Abrir mensagens, ${unread} não lida(s)`
          : 'Abrir mensagens'
      }
      className="fixed z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4"
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
    </Link>
  )
}
