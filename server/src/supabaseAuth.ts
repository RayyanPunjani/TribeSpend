import type { NextFunction, Request, Response } from 'express'

const PREMIUM_REQUIRED_MESSAGE = 'Premium subscription required for Plaid access.'

export interface PlaidAuthContext {
  userId: string
  householdId: string
  plaidAccessEnabled: boolean
}

type SupabaseUserResponse = {
  id?: string
}

type ProfileResponse = Array<{
  id: string
  household_id: string | null
  plaid_access_enabled: boolean | null
}>

function getBearerToken(req: Request): string | null {
  const authHeader = req.header('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey }
}

async function fetchJson<T>(url: string, token: string, supabaseAnonKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Supabase request failed (${response.status}): ${details}`)
  }

  return response.json() as Promise<T>
}

export async function getPlaidAuthContext(req: Request): Promise<PlaidAuthContext> {
  const token = getBearerToken(req)
  if (!token) throw new Error('Authentication required')

  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getSupabaseConfig()
  const user = await fetchJson<SupabaseUserResponse>(
    `${supabaseUrl}/auth/v1/user`,
    token,
    supabaseAnonKey,
  )

  if (!user.id) throw new Error('Authentication required')

  const profileQuery = new URL(`${supabaseUrl}/rest/v1/profiles`)
  profileQuery.searchParams.set('id', `eq.${user.id}`)
  profileQuery.searchParams.set('select', 'id,household_id,plaid_access_enabled')

  const profileAuthToken = serviceRoleKey ?? token
  const profileApiKey = serviceRoleKey ?? supabaseAnonKey
  const profiles = await fetchJson<ProfileResponse>(
    profileQuery.toString(),
    profileAuthToken,
    profileApiKey,
  )
  const profile = profiles[0]

  if (!profile?.household_id) throw new Error('Profile not found')

  return {
    userId: user.id,
    householdId: profile.household_id,
    plaidAccessEnabled: profile.plaid_access_enabled === true,
  }
}

export async function requirePremiumPlaid(req: Request, res: Response, next: NextFunction) {
  try {
    const plaidAuth = await getPlaidAuthContext(req)
    if (!plaidAuth.plaidAccessEnabled) {
      res.status(403).json({ error: PREMIUM_REQUIRED_MESSAGE })
      return
    }

    res.locals.plaidAuth = plaidAuth
    next()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication required'
    if (message === 'Authentication required' || message === 'Profile not found') {
      res.status(401).json({ error: message })
      return
    }

    console.error('[plaid] auth check failed:', err)
    res.status(500).json({ error: 'Failed to verify Plaid access' })
  }
}

export function getRequiredPlaidAuth(res: Response): PlaidAuthContext {
  return res.locals.plaidAuth as PlaidAuthContext
}
