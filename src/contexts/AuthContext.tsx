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

function getProfileNameFromUser(user: User): string {
  const metadata = user.user_metadata ?? {}
  const metadataName = typeof metadata.name === 'string' ? metadata.name.trim() : ''
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
  const emailPrefix = user.email?.split('@')[0]?.trim() ?? ''
  return metadataName || fullName || emailPrefix || 'New User'
}

function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getAccountHolderPersonName(profile: Profile, user: User): string {
  const metadata = user.user_metadata ?? {}
  const metadataName = typeof metadata.name === 'string' ? metadata.name.trim() : ''
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
  const profileName = profile.name?.trim() ?? ''
  const emailPrefix = user.email?.split('@')[0]?.trim() ?? ''
  return metadataName || fullName || profileName || emailPrefix || 'New User'
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return ['42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')
    || /could not find|does not exist|schema cache/i.test(error.message ?? '')
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

  const reactivateProfile = useCallback(async (profile: Profile, user: User): Promise<Profile | null> => {
    const name = getProfileNameFromUser(user)
    const basePatch = {
      name,
      subscription_status: 'free',
      plaid_access_enabled: false,
      onboarding_completed: false,
    }
    const fullPatch = {
      ...basePatch,
      account_status: 'active',
      deleted_at: null,
    }

    let result = await supabase
      .from('profiles')
      .update(fullPatch)
      .eq('id', profile.id)
      .select('*')
      .maybeSingle()

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from('profiles')
        .update(basePatch)
        .eq('id', profile.id)
        .select('*')
        .maybeSingle()
    }

    if (result.error) {
      console.warn('[Auth] Profile reactivation failed:', result.error.message, result.error.details, result.error.hint)
      return null
    }

    return result.data as Profile | null
  }, [])

  const fetchProfile = useCallback(async (user: User): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.warn('[Auth] Profile fetch error:', error.message, error.details, error.hint)
        return null
      }
      const profile = data as Profile | null
      const isDeletedProfile =
        profile?.account_status === 'deleted' ||
        !!profile?.deleted_at ||
        profile?.name === 'Deleted Account'

      if (profile && isDeletedProfile) {
        console.info('[Auth] Reactivating previously deleted account profile')
        return reactivateProfile(profile, user)
      }
      return profile
    } catch (err) {
      console.warn('[Auth] Profile fetch exception:', err)
      return null
    }
  }, [reactivateProfile])

  const fetchProfileWithRetry = useCallback(async (user: User): Promise<Profile | null> => {
    const delays = [0, 300, 800]
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[i]))
      }
      const p = await fetchProfile(user)
      if (p?.household_id) return p
    }
    console.warn('[Auth] Profile could not be loaded after retry for user:', user.id)
    return null
  }, [fetchProfile])

  const ensureAccountHolderPerson = useCallback(async (profile: Profile, user: User) => {
    if (!profile.household_id) return

    const name = getAccountHolderPersonName(profile, user)
    const normalizedName = normalizePersonName(name)

    try {
      const { data, error } = await supabase
        .from('people')
        .select('id, name')
        .eq('household_id', profile.household_id)

      if (error) {
        console.warn('[Auth] Unable to check account holder person:', error.message)
        return
      }

      const alreadyExists = (data ?? []).some((person) =>
        normalizePersonName(String(person.name ?? '')) === normalizedName,
      )
      if (alreadyExists) return

      const { error: insertError } = await supabase.from('people').insert({
        id: crypto.randomUUID(),
        household_id: profile.household_id,
        name,
        color: profile.color || '#14b8a6',
      })

      if (insertError) {
        console.warn('[Auth] Unable to create account holder person:', insertError.message)
      }
    } catch (error) {
      console.warn('[Auth] Account holder person setup failed:', error)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const currentUser = sessionRef.current?.user
    if (!currentUser) return

    const p = await withTimeout(
      fetchProfileWithRetry(currentUser),
      PROFILE_FETCH_TIMEOUT_MS,
      'Manual profile refresh',
    )
    if (p) {
      await withTimeout(
        ensureAccountHolderPerson(p, currentUser),
        2500,
        'Account holder person setup',
      )
      setProfileState(p)
    }
  }, [ensureAccountHolderPerson, fetchProfileWithRetry, setProfileState])

  useEffect(() => {
    let mounted = true

    const applyAuthSession = async (
      event: string,
      s: Session | null,
      options: { forceProfileFetch?: boolean; showLoading?: boolean } = {},
    ) => {
      const requestId = ++authFlowId.current
      const authUser = s?.user ?? null
      const userId = authUser?.id ?? null
      const existingProfile = profileRef.current
      const hasCurrentProfile = !!userId && existingProfile?.id === userId && !!existingProfile.household_id

      try {
        if (options.showLoading && !hasCurrentProfile) setLoading(true)

        setSessionState(s)

        if (!authUser) {
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
          fetchProfileWithRetry(authUser),
          PROFILE_FETCH_TIMEOUT_MS,
          `${event} profile fetch`,
        )

        if (!mounted || requestId !== authFlowId.current) return
        if (p) {
          await withTimeout(
            ensureAccountHolderPerson(p, authUser),
            2500,
            'Account holder person setup',
          )
          if (!mounted || requestId !== authFlowId.current) return
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
  }, [ensureAccountHolderPerson, fetchProfileWithRetry, setProfileState, setSessionState])

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
