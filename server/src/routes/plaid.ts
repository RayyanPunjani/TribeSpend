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
import { itemQueries, accountQueries, syncedIdQueries } from '../db'
import { syncItem } from '../syncService'

const router = Router()

// ── POST /api/plaid/create-link-token ─────────────────────────────────────────

router.post('/create-link-token', async (_req: Request, res: Response) => {
  try {
    const linkToken = await createLinkToken()
    res.json({ link_token: linkToken })
  } catch (err: any) {
    console.error('[plaid] create-link-token error:', err?.response?.data || err)
    res.status(500).json({ error: 'Failed to create link token', detail: err?.message })
  }
})

// ── POST /api/plaid/exchange-token ────────────────────────────────────────────
// Body: { public_token, institution: { name, institution_id }, accounts: [...] }

router.post('/exchange-token', async (req: Request, res: Response) => {
  const { public_token, institution, accounts: metaAccounts } = req.body
  if (!public_token) {
    res.status(400).json({ error: 'public_token required' })
    return
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(public_token)
    const encryptedToken = encryptToken(accessToken)

    // Persist item
    const itemRowId = uuidv4()
    itemQueries.insert.run(
      itemRowId,
      encryptedToken,
      itemId,
      institution?.institution_id ?? null,
      institution?.name ?? null,
    )

    // Fetch full account list from Plaid
    const plaidAccounts = await getAccounts(accessToken)

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

router.post('/accounts/map', (req: Request, res: Response) => {
  const { mappings } = req.body as {
    mappings: Array<{ plaidAccountId: string; cardId: string }>
  }
  if (!Array.isArray(mappings)) {
    res.status(400).json({ error: 'mappings array required' })
    return
  }
  try {
    for (const { plaidAccountId, cardId } of mappings) {
      accountQueries.setCardId.run(cardId, plaidAccountId)
    }
    res.json({ success: true })
  } catch (err: any) {
    console.error('[plaid] accounts/map error:', err)
    res.status(500).json({ error: err?.message })
  }
})

// ── GET /api/plaid/items ──────────────────────────────────────────────────────

router.get('/items', (_req: Request, res: Response) => {
  try {
    const items = itemQueries.findAll.all()
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

router.post('/sync', async (req: Request, res: Response) => {
  const { itemId } = req.body as { itemId?: string }
  try {
    if (itemId) {
      const result = await syncItem(itemId)
      res.json({
        transactions: result.added,
        removedPlaidIds: result.removedPlaidIds,
        count: result.added.length,
      })
    } else {
      // Sync all items
      const items = itemQueries.findAll.all()
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

router.delete('/items/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const item = itemQueries.findById.get(id)
    if (!item) {
      res.status(404).json({ error: 'Item not found' })
      return
    }

    // Call Plaid to revoke access
    try {
      const accessToken = decryptToken(item.access_token)
      await removeItem(accessToken)
    } catch (plaidErr) {
      // Log but don't fail — still remove from our DB
      console.warn('[plaid] removeItem call failed (proceeding with local delete):', plaidErr)
    }

    // Clean up
    accountQueries.deleteByItem.run(id)
    itemQueries.delete.run(id)

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
