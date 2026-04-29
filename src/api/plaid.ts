/**
 * Frontend API client for Plaid endpoints.
 * In dev, calls go to /api/plaid/* which Vite proxies to localhost:3001.
 * In production, calls go to the Netlify Function deployed with the app.
 */

import type { Transaction } from '@/types'
import { supabase } from '@/lib/supabase'

const BASE = import.meta.env.DEV ? '/api/plaid' : '/.netlify/functions/plaid'
const PREMIUM_REQUIRED_MESSAGE = 'Premium subscription required for Plaid access.'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || (res.status === 403 ? PREMIUM_REQUIRED_MESSAGE : `Request failed: ${res.status}`))
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: await authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || (res.status === 403 ? PREMIUM_REQUIRED_MESSAGE : `Request failed: ${res.status}`))
  }
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: await authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || (res.status === 403 ? PREMIUM_REQUIRED_MESSAGE : `Request failed: ${res.status}`))
  }
  return res.json()
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
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
