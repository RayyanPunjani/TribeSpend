import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext, type AuthContextType, type Profile } from '@/contexts/AuthContext'

const MOCK_PROFILE: Profile = {
  id: 'mock-user',
  household_id: 'mock-household',
  name: 'Mock User',
  color: '#3b82f6',
  role: 'owner',
  subscription_status: 'active',
}

const MOCK_USER = { id: 'mock-user', email: 'test@local.dev' } as unknown as User

const mockValue: AuthContextType = {
  user: MOCK_USER,
  session: null,
  profile: MOCK_PROFILE,
  householdId: 'mock-household',
  loading: false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={mockValue}>{children}</AuthContext.Provider>
}
