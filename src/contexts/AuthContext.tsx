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

const INITIAL_SESSION_TIMEOUT_MS = 3500
const PROFILE_FETCH_TIMEOUT_MS = 4500
const AUTH_LOADING_TIMEOUT_MS = 6500

export interface Profile {
  id: string
  household_id: string
  name: string
  color: string
  role: string
  subscription_status: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_current_period_end?: string | null
  plaid_access_enabled?: boolean | null
  account_status?: string | null
  deleted_at?: string | null
  onboarding_completed?: boolean | null
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Auth] ${label} timed out after ${ms}ms; continuing without blocking render`)
      resolve(null)
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const authFlowId = useRef(0)
  const profileRef = useRef<Profile | null>(null)
  const sessionRef = useRef<Session | null>(null)

  const setProfileState = useCallback((p: Profile | null) => {
    profileRef.current = p
    setProfile(p)
  }, [])

  const setSessionState = useCallback((s: Session | null) => {
    sessionRef.current = s
    setSession(s)
    setUser(s?.user ?? null)
  }, [])

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
      const profile = data as Profile | null
      if (profile?.account_status === 'deleted' || profile?.deleted_at) {
        console.warn('[Auth] Account profile is deactivated')
        return null
      }
      return profile
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
    const userId = sessionRef.current?.user?.id
    if (!userId) return

    const p = await withTimeout(
      fetchProfileWithRetry(userId),
      PROFILE_FETCH_TIMEOUT_MS,
      'Manual profile refresh',
    )
    if (p) setProfileState(p)
  }, [fetchProfileWithRetry, setProfileState])

  useEffect(() => {
    let mounted = true

    const applyAuthSession = async (
      event: string,
      s: Session | null,
      options: { forceProfileFetch?: boolean; showLoading?: boolean } = {},
    ) => {
      const requestId = ++authFlowId.current
      const userId = s?.user?.id ?? null
      const existingProfile = profileRef.current
      const hasCurrentProfile = !!userId && existingProfile?.id === userId && !!existingProfile.household_id

      try {
        if (options.showLoading && !hasCurrentProfile) setLoading(true)

        setSessionState(s)

        if (!userId) {
          setProfileState(null)
          return
        }

        if (existingProfile && existingProfile.id !== userId) {
          setProfileState(null)
        }

        if (hasCurrentProfile && !options.forceProfileFetch) {
          return
        }

        const p = await withTimeout(
          fetchProfileWithRetry(userId),
          PROFILE_FETCH_TIMEOUT_MS,
          `${event} profile fetch`,
        )

        if (!mounted || requestId !== authFlowId.current) return
        if (p) {
          setProfileState(p)
        }
      } catch (err) {
        console.error(`[Auth] ${event} error:`, err)
      } finally {
        if (mounted && requestId === authFlowId.current) {
          setLoading(false)
        }
      }
    }

    const initializeAuth = async () => {
      const requestId = ++authFlowId.current

      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          INITIAL_SESSION_TIMEOUT_MS,
          'Initial session fetch',
        )

        if (!mounted || requestId !== authFlowId.current) return

        const s = result?.data.session ?? null
        await applyAuthSession('INITIAL_SESSION', s, {
          forceProfileFetch: true,
          showLoading: true,
        })
      } catch (err) {
        console.error('[Auth] getSession error:', err)
      } finally {
        if (mounted && requestId === authFlowId.current) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return
      const userId = s?.user?.id ?? null
      const currentUserId = sessionRef.current?.user?.id ?? null
      const isSameUserRefresh = _event === 'TOKEN_REFRESHED' && userId && userId === currentUserId

      await applyAuthSession(_event, s, {
        forceProfileFetch: !isSameUserRefresh,
        showLoading: !isSameUserRefresh,
      })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfileWithRetry, setProfileState, setSessionState])

  useEffect(() => {
    if (!loading) return

    const timeoutId = window.setTimeout(() => {
      console.warn(`[Auth] Loading exceeded ${AUTH_LOADING_TIMEOUT_MS}ms; releasing loading state`)
      setLoading(false)
    }, AUTH_LOADING_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [loading])

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || email.split('@')[0] },
        emailRedirectTo: `${window.location.origin}/login`,
      },
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
    setSessionState(null)
    setProfileState(null)
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
