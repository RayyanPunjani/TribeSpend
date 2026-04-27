import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      console.log('[Auth] Fetching profile for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        console.error('[Auth] Profile fetch error:', error.message, error.details, error.hint)
        return null
      }
      console.log('[Auth] Profile loaded:', data?.name, 'household:', data?.household_id)
      return data as Profile
    } catch (err) {
      console.error('[Auth] Profile fetch exception:', err)
      return null
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const p = await fetchProfile(user.id)
    if (p) setProfile(p)
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true
    console.log('[Auth] Initializing...')

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      console.log('[Auth] Session:', s ? 'found' : 'none')
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user) {
        const p = await fetchProfile(s.user.id)
        if (mounted) {
          setProfile(p)
          console.log('[Auth] Profile set:', p ? p.name : 'null')
        }
      }
      if (mounted) {
        setLoading(false)
        console.log('[Auth] Loading complete')
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return
      console.log('[Auth] State change:', _event)
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user) {
        const p = await fetchProfile(s.user.id)
        if (mounted) setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

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
