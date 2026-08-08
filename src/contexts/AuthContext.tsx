import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import {
  getCurrentUser,
  signOut,
  syncProfilesFromMetadata,
  type AuthUser,
} from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const current = await getCurrentUser()
    flushSync(() => setUser(current))
    return current
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(initialSession)

      if (initialSession?.user) {
        await syncProfilesFromMetadata(initialSession.user)
        const current = await getCurrentUser()
        if (mounted) setUser(current)
      }

      setLoading(false)
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      if (nextSession?.user) {
        await syncProfilesFromMetadata(nextSession.user)
        const current = await getCurrentUser()
        flushSync(() => setUser(current))
      } else {
        flushSync(() => setUser(null))
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signOut,
      refreshUser,
    }),
    [user, session, loading, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
