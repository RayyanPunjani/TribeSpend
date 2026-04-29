import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  createLinkToken,
  exchangePublicToken,
  removeItem,
  getAccounts,
  encryptToken,
  decryptToken,
} from '../plaidService'
import { itemQueries, accountQueries } from '../db'
import { syncItem } from '../syncService'
import { getPlaidAuthContext, getRequiredPlaidAuth, requirePremiumPlaid } from '../supabaseAuth'

const router = Router()
const MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD = 10

async function removeStoredPlaidItem(itemId: string): Promise<boolean> {
  const item = itemQueries.findById.get(itemId)
  if (!item) return false

  try {
    const accessToken = decryptToken(item.access_token)
    await removeItem(accessToken)
  } catch (plaidErr) {
    console.warn('[plaid] removeItem call failed during cleanup (proceeding with local delete):', plaidErr)
  }

  accountQueries.deleteByItem.run(itemId)
  itemQueries.delete.run(itemId)
  return true
}

function activeAccountCount(householdId: string): number {
  return accountQueries.countActiveByHousehold.get(householdId)?.count ?? 0
}

function activeConnectionCount(householdId: string): number {
  return itemQueries.countActiveByHousehold.get(householdId)?.count ?? 0
}

function hasConnectionCapacity(householdId: string, additionalAccounts = 0, additionalConnections = 0): boolean {
  const withinAccountLimit = activeAccountCount(householdId) + additionalAccounts <= MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD
  const withinConnectionLimit = activeConnectionCount(householdId) + additionalConnections <= MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD
  return withinAccountLimit && withinConnectionLimit
}

// ── POST /api/plaid/create-link-token ─────────────────────────────────────────

router.post('/create-link-token', requirePremiumPlaid, async (_req: Request, res: Response) => {
  const auth = getRequiredPlaidAuth(res)
  if (!hasConnectionCapacity(auth.householdId)) {
    res.status(403).json({ error: `Plaid account limit reached. Maximum ${MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD} active accounts per household.` })
    return
  }

  try {
    const linkToken = await createLinkToken(auth.userId)
    res.json({ link_token: linkToken })
  } catch (err: any) {
    console.error('[plaid] create-link-token error:', err?.response?.data || err)
    res.status(500).json({ error: 'Failed to create link token', detail: err?.message })
  }
})

// ── POST /api/plaid/exchange-token ────────────────────────────────────────────
// Body: { public_token, institution: { name, institution_id }, accounts: [...] }

router.post('/exchange-token', requirePremiumPlaid, async (req: Request, res: Response) => {
  const auth = getRequiredPlaidAuth(res)
  const { public_token, institution } = req.body
  if (!public_token) {
    res.status(400).json({ error: 'public_token required' })
    return
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(public_token)
    const encryptedToken = encryptToken(accessToken)
    const plaidAccounts = await getAccounts(accessToken)

    if (!hasConnectionCapacity(auth.householdId, plaidAccounts.length, 1)) {
      try {
        await removeItem(accessToken)
      } catch (removeErr) {
        console.warn('[plaid] removeItem after limit check failed:', removeErr)
      }
      res.status(403).json({ error: `Plaid account limit reached. Maximum ${MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD} active accounts per household.` })
      return
    }

    // Persist item
    const itemRowId = uuidv4()
    itemQueries.insert.run(
      itemRowId,
      auth.userId,
      auth.householdId,
      encryptedToken,
      itemId,
      institution?.institution_id ?? null,
      institution?.name ?? null,
    )

    // Persist account rows
    for (const acct of plaidAccounts) {
      const accountRowId = uuidv4()
      accountQueries.insert.run(
        accountRowId,
        itemRowId,
        acct.account_id,
        acct.name,
        acct.official_name ?? null,
        acct.type,
        acct.subtype ?? null,
        acct.mask ?? null,
      )
    }

    // Return account info for the frontend to configure
    const accountsPayload = plaidAccounts.map((a) => ({
      plaidAccountId: a.account_id,
      name: a.name,
      officialName: a.official_name ?? null,
      type: a.type,
      subtype: a.subtype ?? null,
      mask: a.mask ?? null,
    }))

    res.json({ success: true, itemId: itemRowId, accounts: accountsPayload })
  } catch (err: any) {
    console.error('[plaid] exchange-token error:', err?.response?.data || err)
    res.status(500).json({ error: 'Failed to exchange token', detail: err?.message })
  }
})

// ── POST /api/plaid/accounts/map ──────────────────────────────────────────────
// Body: { mappings: [{ plaidAccountId, cardId }] }
// Saves the frontend IndexedDB card IDs → Plaid account IDs

router.post('/accounts/map', requirePremiumPlaid, (req: Request, res: Response) => {
  const auth = getRequiredPlaidAuth(res)
  const { mappings } = req.body as {
    mappings: Array<{ plaidAccountId: string; cardId: string }>
  }
  if (!Array.isArray(mappings)) {
    res.status(400).json({ error: 'mappings array required' })
    return
  }
  try {
    for (const { plaidAccountId, cardId } of mappings) {
      accountQueries.setCardIdForHousehold.run(cardId, plaidAccountId, auth.householdId)
    }
    res.json({ success: true })
  } catch (err: any) {
    console.error('[plaid] accounts/map error:', err)
    res.status(500).json({ error: err?.message })
  }
})

// ── GET /api/plaid/items ──────────────────────────────────────────────────────

router.get('/items', requirePremiumPlaid, (_req: Request, res: Response) => {
  const auth = getRequiredPlaidAuth(res)
  try {
    const items = itemQueries.findAllByHousehold.all(auth.householdId)
    const result = items.map((item) => {
      const accounts = accountQueries.findByItem.all(item.id)
      return {
        id: item.id,
        itemId: item.item_id,
        institutionName: item.institution_name,
        institutionId: item.institution_id,
        status: item.status,
        lastSyncedAt: item.last_synced_at,
        createdAt: item.created_at,
        accounts: accounts.map((a) => ({
          plaidAccountId: a.plaid_account_id,
          cardId: a.card_id,
          name: a.name,
          officialName: a.official_name,
          type: a.type,
          subtype: a.subtype,
          mask: a.mask,
        })),
      }
    })
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message })
  }
})

// ── POST /api/plaid/sync ──────────────────────────────────────────────────────
// Body (optional): { itemId } — if omitted, syncs all items

router.post('/sync', requirePremiumPlaid, async (req: Request, res: Response) => {
  const auth = getRequiredPlaidAuth(res)
  const { itemId } = req.body as { itemId?: string }
  try {
    if (itemId) {
      const item = itemQueries.findById.get(itemId)
      if (!item || (item.household_id && item.household_id !== auth.householdId)) {
        res.status(404).json({ error: 'Item not found' })
        return
      }

      const result = await syncItem(itemId)
      res.json({
        transactions: result.added,
        removedPlaidIds: result.removedPlaidIds,
        count: result.added.length,
      })
    } else {
      // Sync all items
      const items = itemQueries.findAllByHousehold.all(auth.householdId)
      const allAdded: any[] = []
      const allRemoved: string[] = []
      const errors: Array<{ itemId: string; error: string }> = []

      for (const item of items) {
        try {
          const result = await syncItem(item.id)
          allAdded.push(...result.added)
          allRemoved.push(...result.removedPlaidIds)
        } catch (err) {
          errors.push({ itemId: item.id, error: String(err) })
          console.error(`[plaid] sync error for item ${item.id}:`, err)
        }
      }

      res.json({
        transactions: allAdded,
        removedPlaidIds: allRemoved,
        count: allAdded.length,
        errors,
      })
    }
  } catch (err: any) {
    console.error('[plaid] sync error:', err)
    res.status(500).json({ error: err?.message })
  }
})

// ── DELETE /api/plaid/items/:id ───────────────────────────────────────────────

router.delete('/account-connections', async (req: Request, res: Response) => {
  try {
    const auth = await getPlaidAuthContext(req)
    const items = itemQueries.findAllByHousehold.all(auth.householdId)
    let removed = 0

    for (const item of items) {
      if (await removeStoredPlaidItem(item.id)) removed += 1
    }

    res.json({ success: true, removed })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Failed to remove Plaid connections'
    if (message === 'Authentication required' || message === 'Profile not found') {
      res.status(401).json({ error: message })
      return
    }
    console.error('[plaid] account connection cleanup failed:', err)
    res.status(500).json({ error: message })
  }
})

router.delete('/items/:id', requirePremiumPlaid, async (req: Request, res: Response) => {
  const auth = getRequiredPlaidAuth(res)
  const { id } = req.params
  try {
    const item = itemQueries.findById.get(id)
    if (!item) {
      res.status(404).json({ error: 'Item not found' })
      return
    }
    if (item.household_id && item.household_id !== auth.householdId) {
      res.status(404).json({ error: 'Item not found' })
      return
    }

    await removeStoredPlaidItem(id)

    res.json({ success: true })
  } catch (err: any) {
    console.error('[plaid] delete item error:', err)
    res.status(500).json({ error: err?.message })
  }
})

// ── POST /api/plaid/webhook ───────────────────────────────────────────────────
// In production, Plaid sends webhooks here when new transactions are available

router.post('/webhook', (req: Request, res: Response) => {
  const { webhook_type, webhook_code, item_id } = req.body
  console.log(`[plaid] Webhook: ${webhook_type}/${webhook_code} for item ${item_id}`)

  if (webhook_type === 'TRANSACTIONS' && webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    const item = itemQueries.findByItemId.get(item_id)
    if (item) {
      // Fire-and-forget sync
      syncItem(item.id).catch((err) =>
        console.error('[plaid] Webhook-triggered sync failed:', err),
      )
    }
  }

  res.sendStatus(200)
})

export default router
