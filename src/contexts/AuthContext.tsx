import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface Profile {
  id: string
  household_id: string
  name: string
  color: string
  role: string
  subscription_status: string
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  householdId: string | null
  loading: boolean
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequestId = useRef(0)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        console.warn('[Auth] Profile fetch error:', error.message, error.details, error.hint)
        return null
      }
      return data as Profile | null
    } catch (err) {
      console.warn('[Auth] Profile fetch exception:', err)
      return null
    }
  }, [])

  const fetchProfileWithRetry = useCallback(async (userId: string): Promise<Profile | null> => {
    const delays = [0, 300, 800]
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[i]))
      }
      const p = await fetchProfile(userId)
      if (p?.household_id) return p
    }
    console.warn('[Auth] Profile could not be loaded after retry for user:', userId)
    return null
  }, [fetchProfile])

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return
    const p = await fetchProfileWithRetry(session.user.id)
    if (p) setProfile(p)
  }, [session, fetchProfileWithRetry])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      const requestId = ++profileRequestId.current
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user?.id) {
        const p = await fetchProfileWithRetry(s.user.id)
        if (mounted && requestId === profileRequestId.current) {
          setProfile(p)
        }
      } else {
        setProfile(null)
      }
      if (mounted) {
        setLoading(false)
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return
      const requestId = ++profileRequestId.current
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user?.id) {
        setLoading(true)
        const p = await fetchProfileWithRetry(s.user.id)
        if (mounted && requestId === profileRequestId.current) setProfile(p)
      } else {
        setProfile(null)
      }
      if (mounted && requestId === profileRequestId.current) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfileWithRetry])

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || email.split('@')[0] } },
    })
    return { error: error as Error | null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user, session, profile,
        householdId: profile?.household_id ?? null,
        loading, signUp, signIn, signInWithGoogle, signOut, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
