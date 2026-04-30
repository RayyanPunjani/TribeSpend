import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD = 10
const PREMIUM_REQUIRED_MESSAGE = 'Premium subscription required for Plaid access.'

const PLAID_CATEGORY_MAP = {
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
  AIRLINES_AND_AVIATION_SERVICES: 'Travel',
  LODGING: 'Travel',
  CAR_RENTAL_AND_TAXI: 'Transportation',
  DIGITAL_PURCHASES: 'Subscriptions',
  SUBSCRIPTION: 'Subscriptions',
  LOAN_PAYMENTS: 'exclude',
  CREDIT_CARD_PAYMENTS: 'exclude',
  TRANSFER_IN: 'exclude',
  TRANSFER_OUT: 'exclude',
  BANK_FEES: 'exclude',
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

function json(statusCode, body) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(body) }
}

function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined)
}

function getSupabaseConfig() {
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase server configuration')
  }

  return { supabaseUrl, anonKey, serviceRoleKey }
}

function getPlaidBaseUrl() {
  const env = process.env.PLAID_ENV || 'sandbox'
  if (env === 'production') return 'https://production.plaid.com'
  if (env === 'development') return 'https://development.plaid.com'
  return 'https://sandbox.plaid.com'
}

function getPlaidConfig() {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  if (!clientId || !secret) throw new Error('Missing Plaid server configuration')
  return { clientId, secret, baseUrl: getPlaidBaseUrl() }
}

async function plaidPost(path, body) {
  const { clientId, secret, baseUrl } = getPlaidConfig()
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.error_message || data.error_code || `Plaid request failed (${response.status})`
    const error = new Error(message)
    error.details = data
    throw error
  }
  return data
}

function tokenKey() {
  const secret = process.env.PLAID_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
  if (!secret) throw new Error('Missing Plaid token encryption secret')
  return crypto.scryptSync(secret, 'tribespend-plaid-salt', 32)
}

function encryptToken(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptToken(ciphertext) {
  const [scheme, ivHex, tagHex, encryptedHex] = ciphertext.split(':')
  if (scheme !== 'gcm') throw new Error('Unsupported Plaid token format')
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

function getBearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

async function getAuthContext(event, requirePremium = true) {
  const token = getBearerToken(event)
  if (!token) {
    const error = new Error('Authentication required')
    error.statusCode = 401
    throw error
  }

  const { supabaseUrl, anonKey, serviceRoleKey } = getSupabaseConfig()
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user?.id) {
    const error = new Error('Authentication required')
    error.statusCode = 401
    throw error
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, household_id, plaid_access_enabled')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile?.household_id) {
    const error = new Error('Profile not found')
    error.statusCode = 401
    throw error
  }

  if (requirePremium && profile.plaid_access_enabled !== true) {
    const error = new Error(PREMIUM_REQUIRED_MESSAGE)
    error.statusCode = 403
    throw error
  }

  return {
    userId: userData.user.id,
    householdId: profile.household_id,
    supabase: serviceClient,
  }
}

function routeFromEvent(event) {
  const path = event.path || ''
  const marker = '/.netlify/functions/plaid'
  if (path.includes(marker)) {
    return path.slice(path.indexOf(marker) + marker.length).replace(/^\/+/, '')
  }
  const apiMarker = '/api/plaid'
  if (path.includes(apiMarker)) {
    return path.slice(path.indexOf(apiMarker) + apiMarker.length).replace(/^\/+/, '')
  }
  return ''
}

function parseBody(event) {
  if (!event.body) return {}
  try {
    return JSON.parse(event.body)
  } catch {
    const error = new Error('Invalid JSON body')
    error.statusCode = 400
    throw error
  }
}

async function activeCounts(supabase, householdId) {
  const { count: itemCount, error: itemError } = await supabase
    .from('plaid_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
  if (itemError) throw itemError

  const { data: activeItems, error: activeItemsError } = await supabase
    .from('plaid_items')
    .select('id')
    .eq('household_id', householdId)
  if (activeItemsError) throw activeItemsError

  const itemIds = (activeItems || []).map((item) => item.id)
  if (itemIds.length === 0) return { items: itemCount || 0, accounts: 0 }

  const { count: accountCount, error: accountError } = await supabase
    .from('plaid_account_mappings')
    .select('id', { count: 'exact', head: true })
    .in('plaid_item_id', itemIds)
    .eq('enabled', true)
  if (accountError) throw accountError

  return { items: itemCount || 0, accounts: accountCount || 0 }
}

async function hasConnectionCapacity(supabase, householdId, additionalAccounts = 0, additionalConnections = 0) {
  const counts = await activeCounts(supabase, householdId)
  return (
    counts.accounts + additionalAccounts <= MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD &&
    counts.items + additionalConnections <= MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD
  )
}

function mapPlaidCategory(category) {
  if (!category) return 'Miscellaneous'
  const detailed = String(category.detailed || '').toUpperCase().replace(/[^A-Z_]/g, '_')
  const primary = String(category.primary || '').toUpperCase().replace(/[^A-Z_]/g, '_')
  return PLAID_CATEGORY_MAP[detailed] || PLAID_CATEGORY_MAP[primary] || 'Miscellaneous'
}

function transactionToRow(transaction, householdId) {
  return {
    id: transaction.id,
    household_id: householdId,
    trans_date: transaction.transDate,
    post_date: transaction.postDate,
    description: transaction.description,
    clean_description: transaction.cleanDescription,
    amount: transaction.amount,
    category: transaction.category,
    card_id: transaction.cardId || null,
    cardholder_name: transaction.cardholderName || '',
    person_id: null,
    is_payment: transaction.isPayment,
    is_credit: transaction.isCredit,
    is_balance_payment: transaction.isBalancePayment,
    statement_id: transaction.statementId,
    reimbursement_status: transaction.reimbursementStatus,
    reimbursement_amount: null,
    reimbursement_to: null,
    reimbursement_paid: transaction.reimbursementPaid ? 1 : 0,
    expected_return_status: null,
    expected_return_amount: null,
    expected_return_note: null,
    is_recurring: false,
    recurring_auto_detected: false,
    recurring_dismissed: false,
    spend_type: 'personal',
    notes: null,
    is_manual_entry: false,
    is_deleted: false,
    source: 'plaid',
    plaid_transaction_id: transaction.plaidTransactionId,
    refund_for_id: transaction.refundForId,
    has_refund: transaction.hasRefund,
    refund_review_pending: transaction.refundReviewPending,
  }
}

async function removePlaidItem(supabase, item) {
  try {
    const accessToken = decryptToken(item.access_token_encrypted)
    await plaidPost('/item/remove', { access_token: accessToken })
  } catch (error) {
    console.warn('[plaid] Plaid item/remove failed during cleanup:', error.message)
  }

  const { error } = await supabase.from('plaid_items').delete().eq('id', item.id)
  if (error) throw error
}

async function findItemsWithAccounts(supabase, householdId) {
  const { data: items, error } = await supabase
    .from('plaid_items')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const itemIds = (items || []).map((item) => item.id)
  if (itemIds.length === 0) return []

  const { data: mappings, error: mappingsError } = await supabase
    .from('plaid_account_mappings')
    .select('*')
    .eq('household_id', householdId)
    .in('plaid_item_id', itemIds)
    .eq('enabled', true)
  if (mappingsError) throw mappingsError

  const mappingsByItem = new Map()
  for (const mapping of mappings || []) {
    const existing = mappingsByItem.get(mapping.plaid_item_id) || []
    existing.push(mapping)
    mappingsByItem.set(mapping.plaid_item_id, existing)
  }

  return (items || []).map((item) => ({
    ...item,
    plaid_account_mappings: mappingsByItem.get(item.id) || [],
  }))
}

async function publicItem(item) {
  let plaidAccountsById = new Map()
  try {
    const accessToken = decryptToken(item.access_token_encrypted)
    const plaidAccounts = (await plaidPost('/accounts/get', { access_token: accessToken })).accounts || []
    plaidAccountsById = new Map(plaidAccounts.map((account) => [account.account_id, account]))
  } catch (error) {
    console.warn(`[plaid] Unable to refresh account details for item ${item.id}:`, error.message)
  }

  return {
    id: item.id,
    itemId: item.id,
    institutionName: item.institution_name,
    institutionId: item.institution_id,
    status: 'active',
    lastSyncedAt: null,
    createdAt: item.created_at,
    accounts: (item.plaid_account_mappings || []).map((mapping) => {
      const account = plaidAccountsById.get(mapping.account_id)
      return {
        plaidAccountId: mapping.account_id,
        cardId: mapping.card_id,
        name: account?.name ?? null,
        officialName: account?.official_name ?? null,
        type: account?.type ?? null,
        subtype: account?.subtype ?? null,
        mask: account?.mask ?? null,
      }
    }),
  }
}

async function syncItem(supabase, item) {
  const accessToken = decryptToken(item.access_token_encrypted)
  const { data: mappings, error: accountsError } = await supabase
    .from('plaid_account_mappings')
    .select('*')
    .eq('plaid_item_id', item.id)
    .eq('household_id', item.household_id)
    .eq('enabled', true)
  if (accountsError) throw accountsError

  const accountMap = new Map((mappings || []).map((mapping) => [mapping.account_id, mapping]))
  const added = []
  const removedPlaidIds = []
  let cursor = item.cursor || undefined
  let hasMore = true
  let nextCursor = null

  while (hasMore) {
    const data = await plaidPost('/transactions/sync', {
      access_token: accessToken,
      cursor,
      options: { include_personal_finance_category: true },
    })

    for (const txn of data.added || []) {
      const { data: existingTransaction, error: existingError } = await supabase
        .from('transactions')
        .select('id')
        .eq('household_id', item.household_id)
        .eq('plaid_transaction_id', txn.transaction_id)
        .maybeSingle()
      if (existingError) throw existingError
      if (existingTransaction) continue

      const category = mapPlaidCategory(txn.personal_finance_category)
      if (category === 'exclude') continue

      const mapping = accountMap.get(txn.account_id)
      added.push({
        id: crypto.randomUUID(),
        transDate: txn.date,
        postDate: txn.authorized_date || txn.date,
        description: txn.original_description || txn.name,
        cleanDescription: txn.merchant_name || txn.name,
        amount: Number(txn.amount),
        category,
        cardId: mapping?.card_id ?? null,
        cardholderName: '',
        isPayment: false,
        isCredit: Number(txn.amount) < 0,
        isBalancePayment: false,
        statementId: `plaid-${item.id}`,
        reimbursementStatus: 'none',
        reimbursementPaid: false,
        source: 'plaid',
        plaidTransactionId: txn.transaction_id,
        refundForId: null,
        hasRefund: false,
        refundReviewPending: false,
      })
    }

    for (const txn of data.modified || []) {
      removedPlaidIds.push(txn.transaction_id)
    }

    for (const txn of data.removed || []) {
      removedPlaidIds.push(txn.transaction_id)
    }

    cursor = data.next_cursor
    nextCursor = data.next_cursor
    hasMore = data.has_more === true
  }

  if (added.length > 0) {
    const rows = added.map((transaction) => transactionToRow(transaction, item.household_id))
    const { error: insertError } = await supabase.from('transactions').insert(rows)
    if (insertError) {
      console.error('[plaid] Failed to insert synced transactions:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      })
      const error = new Error(insertError.message || 'Failed to insert synced transactions')
      error.details = insertError
      throw error
    }
  }

  if (nextCursor) {
    const { error } = await supabase
      .from('plaid_items')
      .update({ cursor: nextCursor })
      .eq('id', item.id)
    if (error) throw error
  }

  return { added, removedPlaidIds }
}

async function handleRoute(event) {
  const route = routeFromEvent(event)
  const method = event.httpMethod

  if (route === 'health' || route === '') return json(200, { ok: true })

  if (route === 'create-link-token' && method === 'POST') {
    const auth = await getAuthContext(event)
    if (!(await hasConnectionCapacity(auth.supabase, auth.householdId))) {
      return json(403, { error: `Plaid account limit reached. Maximum ${MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD} active accounts per household.` })
    }

    const data = await plaidPost('/link/token/create', {
      user: { client_user_id: auth.userId },
      client_name: 'TribeSpend',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    })
    return json(200, { link_token: data.link_token })
  }

  if (route === 'exchange-token' && method === 'POST') {
    const auth = await getAuthContext(event)
    const body = parseBody(event)
    if (!body.public_token) return json(400, { error: 'public_token required' })

    const exchange = await plaidPost('/item/public_token/exchange', { public_token: body.public_token })
    const accessToken = exchange.access_token
    const plaidAccounts = (await plaidPost('/accounts/get', { access_token: accessToken })).accounts || []

    if (!(await hasConnectionCapacity(auth.supabase, auth.householdId, plaidAccounts.length, 1))) {
      await plaidPost('/item/remove', { access_token: accessToken }).catch((error) => {
        console.warn('[plaid] item/remove after limit failed:', error.message)
      })
      return json(403, { error: `Plaid account limit reached. Maximum ${MAX_PLAID_ACCOUNTS_PER_HOUSEHOLD} active accounts per household.` })
    }

    const itemId = crypto.randomUUID()
    const { error: itemError } = await auth.supabase.from('plaid_items').insert({
      id: itemId,
      household_id: auth.householdId,
      access_token_encrypted: encryptToken(accessToken),
      institution_id: body.institution?.institution_id ?? null,
      institution_name: body.institution?.name ?? null,
    })
    if (itemError) throw itemError

    const accountRows = plaidAccounts.map((account) => ({
      id: crypto.randomUUID(),
      plaid_item_id: itemId,
      household_id: auth.householdId,
      account_id: account.account_id,
      card_id: null,
      enabled: true,
    }))

    if (accountRows.length > 0) {
      const { error: accountsError } = await auth.supabase.from('plaid_account_mappings').insert(accountRows)
      if (accountsError) throw accountsError
    }

    return json(200, {
      success: true,
      itemId,
      accounts: plaidAccounts.map((account) => ({
        plaidAccountId: account.account_id,
        cardId: null,
        name: account.name,
        officialName: account.official_name ?? null,
        type: account.type,
        subtype: account.subtype ?? null,
        mask: account.mask ?? null,
      })),
    })
  }

  if (route === 'accounts/map' && method === 'POST') {
    const auth = await getAuthContext(event)
    const body = parseBody(event)
    if (!Array.isArray(body.mappings)) return json(400, { error: 'mappings array required' })
    const itemIds = (await findItemsWithAccounts(auth.supabase, auth.householdId)).map((item) => item.id)
    if (itemIds.length === 0) return json(200, { success: true })

    for (const mapping of body.mappings) {
      const { error } = await auth.supabase
        .from('plaid_account_mappings')
        .update({ card_id: mapping.cardId })
        .eq('account_id', mapping.plaidAccountId)
        .eq('household_id', auth.householdId)
        .in('plaid_item_id', itemIds)
      if (error) throw error
    }

    return json(200, { success: true })
  }

  if (route === 'items' && method === 'GET') {
    const auth = await getAuthContext(event)
    const items = await findItemsWithAccounts(auth.supabase, auth.householdId)
    return json(200, await Promise.all(items.map(publicItem)))
  }

  if (route === 'sync' && method === 'POST') {
    const auth = await getAuthContext(event)
    const body = parseBody(event)
    const allAdded = []
    const allRemoved = []
    const errors = []

    let items = await findItemsWithAccounts(auth.supabase, auth.householdId)
    if (body.itemId) {
      items = items.filter((item) => item.id === body.itemId)
      if (items.length === 0) return json(404, { error: 'Item not found' })
    }

    for (const item of items) {
      try {
        const result = await syncItem(auth.supabase, item)
        allAdded.push(...result.added)
        allRemoved.push(...result.removedPlaidIds)
      } catch (error) {
        errors.push({ itemId: item.id, error: error.message || String(error) })
        console.error(`[plaid] sync error for item ${item.id}:`, error)
      }
    }

    return json(200, {
      transactions: allAdded,
      removedPlaidIds: allRemoved,
      count: allAdded.length,
      errors,
    })
  }

  if (route === 'account-connections' && method === 'DELETE') {
    const auth = await getAuthContext(event, false)
    const items = await findItemsWithAccounts(auth.supabase, auth.householdId)
    let removed = 0
    for (const item of items) {
      await removePlaidItem(auth.supabase, item)
      removed += 1
    }
    return json(200, { success: true, removed })
  }

  const itemDeleteMatch = route.match(/^items\/([^/]+)$/)
  if (itemDeleteMatch && method === 'DELETE') {
    const auth = await getAuthContext(event)
    const { data: item, error } = await auth.supabase
      .from('plaid_items')
      .select('*')
      .eq('id', itemDeleteMatch[1])
      .eq('household_id', auth.householdId)
      .maybeSingle()
    if (error) throw error
    if (!item) return json(404, { error: 'Item not found' })

    await removePlaidItem(auth.supabase, item)
    return json(200, { success: true })
  }

  return json(404, { error: 'Plaid route not found' })
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders, body: '' }
  }

  try {
    return await handleRoute(event)
  } catch (error) {
    const statusCode = error.statusCode || 500
    const message = statusCode === 500 ? 'Plaid request failed' : error.message
    console.error('[plaid] function error:', {
      statusCode,
      message: error.message,
      details: error.details,
    })
    return json(statusCode, {
      error: message,
      details: error.details?.error_message || undefined,
    })
  }
}
