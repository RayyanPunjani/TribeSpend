import { createClient } from '@supabase/supabase-js'
import { createMockClient } from './supabaseMock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

function buildClient() {
  if (USE_MOCK) return createMockClient() as unknown as ReturnType<typeof createClient>
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = buildClient()
