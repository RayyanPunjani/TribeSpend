import { plaidClient, decryptToken } from './plaidService'
import { itemQueries, accountQueries, syncedIdQueries } from './db'
import { v4 as uuidv4 } from 'uuid'

// ── Plaid → TribeSpend category mapping ──────────────────────────────────────

const PLAID_CATEGORY_MAP: Record<string, string> = {
  // Primary categories
  FOOD_AND_DRINK: 'Dining',
  GROCERIES: 'Groceries',
  TRANSPORTATION: 'Transportation',
  GAS_STATIONS: 'Gas & EV Charging',
  TRAVEL: 'Travel',
  GENERAL_MERCHANDISE: 'Shopping',
  ONLINE_MARKETPLACES: 'Shopping',
  ENTERTAINMENT_AND_RECREATION: 'Entertainment',
  PERSONAL_CARE: 'Personal Care',
  MEDICAL: 'Health & Medical',
  PHARMACIES_AND_SUPPLEMENTS: 'Health & Medical',
  GYMS_AND_FITNESS_CENTERS: 'Fitness',
  INSURANCE: 'Insurance',
  RENT_AND_UTILITIES: 'Home & Utilities',
  HOME_IMPROVEMENT: 'Home & Utilities',
  GOVERNMENT_AND_NON_PROFIT: 'Government & Fees',
  GENERAL_SERVICES: 'Miscellaneous',
  EDUCATION: 'Education',
  CHARITABLE_GIVING: 'Donations & Charity',
  TELECOMMUNICATION_SERVICES: 'Telecom',
  PET_SUPPLIES_AND_SERVICES: 'Pets',
  GIFTS_AND_DONATIONS: 'Gifts',
  // Detailed categories
  AIRLINES_AND_AVIATION_SERVICES: 'Travel',
  LODGING: 'Travel',
  CAR_RENTAL_AND_TAXI: 'Transportation',
  DIGITAL_PURCHASES: 'Subscriptions',
  SUBSCRIPTION: 'Subscriptions',
  // Exclude these
  LOAN_PAYMENTS: 'exclude',
  CREDIT_CARD_PAYMENTS: 'exclude',
  TRANSFER_IN: 'exclude',
  TRANSFER_OUT: 'exclude',
  BANK_FEES: 'exclude',
}

function mapPlaidCategory(category: { primary?: string; detailed?: string } | null | undefined): string {
  if (!category) return 'Miscellaneous'
  // Try detailed first, then primary
  const detailed = (category.detailed || '').toUpperCase().replace(/[^A-Z_]/g, '_')
  const primary = (category.primary || '').toUpperCase().replace(/[^A-Z_]/g, '_')
  return PLAID_CATEGORY_MAP[detailed] || PLAID_CATEGORY_MAP[primary] || 'Miscellaneous'
}

// ── TribeSpend Transaction shape (matches frontend types) ────────────────────

export interface SyncedTransaction {
  id: string
  transDate: string
  postDate: string
  description: string
  cleanDescription: string
  amount: number
  category: string
  cardId: string
  cardholderName: string
  isPayment: boolean
  isCredit: boolean
  isBalancePayment: boolean
  statementId: string
  reimbursementStatus: 'none'
  reimbursementPaid: false
  source: 'plaid'
  plaidTransactionId: string
}

// ── Sync a single item ────────────────────────────────────────────────────────

export async function syncItem(itemId: string): Promise<{
  added: SyncedTransaction[]
  removedPlaidIds: string[]
  hasMore: boolean
  nextCursor: string | null
}> {
  const item = itemQueries.findById.get(itemId)
  if (!item) throw new Error(`Item not found: ${itemId}`)

  const accessToken = decryptToken(item.access_token)
  const accounts = accountQueries.findByItem.all(itemId)

  // Build plaid_account_id → { card_id, name } lookup
  const accountMap = new Map(accounts.map((a) => [a.plaid_account_id, a]))

  const added: SyncedTransaction[] = []
  const removedPlaidIds: string[] = []
  let cursor: string | undefined = item.last_cursor ?? undefined
  let hasMore = true
  let nextCursor: string | null = null

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      options: { include_personal_finance_category: true },
    })

    const { added: newTxns, modified, removed, next_cursor, has_more } = response.data

    // Process new transactions
    for (const txn of newTxns) {
      // Skip if already synced
      const alreadySynced = syncedIdQueries.has.get(txn.transaction_id)
      if (alreadySynced && alreadySynced.count > 0) continue

      const category = mapPlaidCategory(
        txn.personal_finance_category as { primary?: string; detailed?: string } | undefined,
      )
      if (category === 'exclude') continue

      const account = accountMap.get(txn.account_id)
      const cardId = account?.card_id || 'unknown'

      const spendTxn: SyncedTransaction = {
        id: uuidv4(),
        transDate: txn.date,
        postDate: txn.authorized_date || txn.date,
        description: txn.original_description || txn.name,
        cleanDescription: txn.merchant_name || txn.name,
        amount: txn.amount,          // Plaid: positive = charge, negative = credit
        category,
        cardId,
        cardholderName: account?.name || '',
        isPayment: false,
        isCredit: txn.amount < 0,
        isBalancePayment: false,
        statementId: `plaid-${itemId}`,
        reimbursementStatus: 'none',
        reimbursementPaid: false,
        source: 'plaid',
        plaidTransactionId: txn.transaction_id,
      }

      added.push(spendTxn)
      syncedIdQueries.insert.run(txn.transaction_id, txn.account_id)
    }

    // Handle modified (update in synced_ids, client will need to handle)
    for (const txn of modified) {
      // Re-sync: remove old record so it gets re-added
      syncedIdQueries.delete.run(txn.transaction_id)
    }

    // Handle removed
    for (const txn of removed) {
      removedPlaidIds.push(txn.transaction_id)
      syncedIdQueries.delete.run(txn.transaction_id)
    }

    cursor = next_cursor
    hasMore = has_more
    nextCursor = next_cursor
  }

  // Save cursor
  if (nextCursor) {
    itemQueries.updateCursor.run(nextCursor, itemId)
  }

  return { added, removedPlaidIds, hasMore: false, nextCursor }
}

// ── Sync all active items ─────────────────────────────────────────────────────

export async function syncAllItems(): Promise<{
  totalAdded: number
  totalRemoved: number
  errors: Array<{ itemId: string; error: string }>
}> {
  const items = itemQueries.findAll.all()
  let totalAdded = 0
  let totalRemoved = 0
  const errors: Array<{ itemId: string; error: string }> = []

  for (const item of items) {
    try {
      const result = await syncItem(item.id)
      totalAdded += result.added.length
      totalRemoved += result.removedPlaidIds.length
    } catch (err) {
      errors.push({ itemId: item.id, error: String(err) })
      console.error(`[sync] Error syncing item ${item.id}:`, err)
    }
  }

  return { totalAdded, totalRemoved, errors }
}
