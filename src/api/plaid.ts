/**
 * Frontend API client for Plaid endpoints.
 * In dev, calls go to /api/plaid/* which Vite proxies to localhost:3001.
 * In production, calls go to the Netlify Function deployed with the app.
 */

import type { Transaction } from '@/types'
import { supabase } from '@/lib/supabase'

const BASE = import.meta.env.DEV ? '/api/plaid' : '/.netlify/functions/plaid'
const PREMIUM_REQUIRED_MESSAGE = 'Premium subscription required for Plaid access.'

async function plaidHeaders(hasBody = false): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)

  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again before connecting Plaid.')

  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  let parsed: { error?: string; details?: string } | T | null = null
  if (text && isJson) {
    try {
      parsed = JSON.parse(text) as { error?: string; details?: string } | T
    } catch {
      throw new Error(`Plaid request returned invalid JSON (${res.status}).`)
    }
  }

  if (!res.ok) {
    if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
      throw new Error(parsed.error)
    }
    const fallback = res.status === 403 ? PREMIUM_REQUIRED_MESSAGE : `Plaid request failed (${res.status})`
    throw new Error(text && !isJson ? `${fallback}: ${text.slice(0, 200)}` : fallback)
  }

  if (!text) return undefined as T
  if (!isJson) {
    throw new Error(`Plaid request returned non-JSON response (${res.status}): ${text.slice(0, 200)}`)
  }
  return parsed as T
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: await plaidHeaders(hasBody),
    body: hasBody ? JSON.stringify(body) : undefined,
  })
  return parseResponse<T>(res)
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: await plaidHeaders() })
  return parseResponse<T>(res)
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: await plaidHeaders() })
  return parseResponse<T>(res)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlaidAccount {
  plaidAccountId: string
  cardId: string | null
  name: string | null
  officialName: string | null
  type: string | null
  subtype: string | null
  mask: string | null
}

export interface PlaidItem {
  id: string
  itemId: string
  institutionName: string | null
  institutionId: string | null
  status: string
  lastSyncedAt: string | null
  createdAt: string
  accounts: PlaidAccount[]
}

export interface SyncResult {
  transactions: Transaction[]
  removedPlaidIds: string[]
  count: number
  errors?: Array<{ itemId: string; error: string }>
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch a Plaid Link token from the backend */
export async function createLinkToken(): Promise<{ link_token: string }> {
  return post('/create-link-token')
}

/** Exchange the public_token Plaid Link returns for a stored access token */
export async function exchangeToken(
  publicToken: string,
  institution: { name: string; institution_id: string } | null,
): Promise<{ success: boolean; itemId: string; accounts: PlaidAccount[] }> {
  return post('/exchange-token', {
    public_token: publicToken,
    institution,
  })
}

/** Save frontend card IDs → Plaid account IDs mapping */
export async function mapAccounts(
  mappings: Array<{ plaidAccountId: string; cardId: string }>,
): Promise<{ success: boolean }> {
  return post('/accounts/map', { mappings })
}

/** List all connected Plaid items (institutions) */
export async function getItems(): Promise<PlaidItem[]> {
  return get('/items')
}

/** Sync new transactions. Pass itemId to sync one institution, omit for all. */
export async function syncTransactions(itemId?: string): Promise<SyncResult> {
  return post('/sync', itemId ? { itemId } : {})
}

/** Disconnect a linked institution */
export async function disconnectItem(id: string): Promise<{ success: boolean }> {
  return del(`/items/${id}`)
}

/** Remove all Plaid account connections for the current household */
export async function removeAllPlaidConnections(): Promise<{ success: boolean; removed: number }> {
  return del('/account-connections')
}

/** Check if the server is reachable */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const healthUrl = import.meta.env.DEV ? '/api/health' : `${BASE}/health`
    const res = await fetch(healthUrl, {
      headers: await plaidHeaders(),
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    await parseResponse<unknown>(res)
    return true
  } catch {
    return false
  }
}
