import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Link } from 'react-router-dom'
import {
  Link2, RefreshCw, Trash2, CheckCircle, AlertCircle,
  Loader2, Building2, CreditCard, ChevronDown, ChevronUp, UserPlus, Sparkles, Pencil, Check, X,
} from 'lucide-react'
import {
  createLinkToken,
  exchangeToken,
  mapAccounts,
  getItems,
  syncTransactions,
  disconnectItem,
  checkServerHealth,
  type PlaidItem,
  type PlaidAccount,
} from '@/api/plaid'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { runRecurringDetector } from '@/services/recurringDetector'
import {
  PRESETS_BY_BRAND,
  BRANDS_BY_GROUP,
  guessPresetBrand,
  buildRulesFromPreset,
} from '@/data/presetCards'
import { CATEGORY_COLORS } from '@/utils/categories'
import { formatCurrency } from '@/utils/formatters'
import ColorPicker from '@/components/shared/ColorPicker'

// ── Account setup modal ───────────────────────────────────────────────────────

interface AccountSetupProps {
  itemId: string
  institutionName: string | null
  accounts: PlaidAccount[]
  onDone: () => void
}

const CARD_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
]

type AccountAssignment = {
  personId: string
  color: string
  skip: boolean
  brand: string      // preset brand selection (empty = no preset)
  cardName: string   // preset card name selection (empty = no preset)
}

function AccountSetupModal({ itemId, institutionName, accounts, onDone }: AccountSetupProps) {
  const { add: addCard } = useCardStore()
  const { persons, addCardToPerson, add: addPerson } = usePersonStore()
  const { add: addRule } = useCardRewardStore()
  const { add: addCredit } = useCardCreditStore()
  const { householdId } = useAuth()
  const hid = householdId!

  // Smart pre-fill: guess brand from institution name
  const defaultBrand = guessPresetBrand(institutionName)

  const [assignments, setAssignments] = useState<Record<string, AccountAssignment>>(() =>
    Object.fromEntries(
      accounts.map((a, i) => [
        a.plaidAccountId,
        {
          personId: persons[0]?.id ?? '',
          color: CARD_COLORS[i % CARD_COLORS.length],
          skip: a.type !== 'credit' && a.type !== 'depository',
          brand: defaultBrand,
          cardName: '',
        },
      ]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showAddPerson, setShowAddPerson] = useState(persons.length === 0)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonColor, setNewPersonColor] = useState('#3b82f6')

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return
    const p = await addPerson(hid, newPersonName.trim(), newPersonColor)
    setAssignments((prev) => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!next[id].personId) next[id] = { ...next[id], personId: p.id }
      }
      return next
    })
    setNewPersonName('')
    setNewPersonColor('#3b82f6')
    setShowAddPerson(false)
  }

  const patchAssignment = (plaidAccountId: string, patch: Partial<AccountAssignment>) =>
    setAssignments((prev) => ({
      ...prev,
      [plaidAccountId]: { ...prev[plaidAccountId], ...patch },
    }))

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      const mappings: Array<{ plaidAccountId: string; cardId: string }> = []

      for (const acct of accounts) {
        const cfg = assignments[acct.plaidAccountId]
        if (cfg.skip || !cfg.personId) continue

        const template = cfg.brand && cfg.cardName
          ? (PRESETS_BY_BRAND[cfg.brand] ?? []).find((p) => p.cardName === cfg.cardName) ?? null
          : null

        const newCard = await addCard(hid, {
          name: template?.cardName ?? acct.officialName ?? acct.name ?? institutionName ?? 'Linked Account',
          issuer: template?.issuer ?? institutionName ?? 'Plaid',
          cardType: template?.cardType ?? acct.subtype ?? acct.type ?? 'Credit Card',
          lastFour: acct.mask || '',
          owner: cfg.personId,
          color: cfg.color,
          annualFee: template?.annualFee || undefined,
          isAuthorizedUser: false,
        })
        if (cfg.personId) {
          await addCardToPerson(cfg.personId, newCard.id)
        }
        if (template) {
          const { rules, credits } = buildRulesFromPreset(template, newCard.id)
          try {
            await Promise.all(rules.map((r) => addRule(hid, r)))
            await Promise.all(credits.map((c) => addCredit(hid, c)))
          } catch (err) {
            console.error('[PlaidManager] Failed to save card reward setup:', err)
            throw new Error('We could not save the reward rules for this card. Please try again.')
          }
        }
        mappings.push({ plaidAccountId: acct.plaidAccountId, cardId: newCard.id })
      }

      await mapAccounts(mappings)
      onDone()
    } catch (err) {
      console.error('[PlaidManager] Save & Start Syncing failed:', err)
      setSaveError(err instanceof Error ? err.message : 'Unable to save linked account setup. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectCls = 'text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Sticky header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">Configure Linked Accounts</h3>
          <p className="text-sm text-slate-500 mt-1">
            Assign each account to a person, optionally match to a card preset to auto-load reward rules.
          </p>
          {/* Inline Add Person */}
          {showAddPerson ? (
            <div className="mt-3 flex flex-col gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50">
              <p className="text-xs font-medium text-slate-600">New Person</p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                  placeholder="Name (e.g., Alex)"
                  autoFocus
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <ColorPicker value={newPersonColor} onChange={setNewPersonColor} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddPerson} className="flex-1 text-xs bg-accent-600 text-white rounded-lg py-1.5 hover:bg-accent-700">
                  Add Person
                </button>
                {persons.length > 0 && (
                  <button onClick={() => setShowAddPerson(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPerson(true)}
              className="mt-2 flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700"
            >
              <UserPlus size={12} /> Add Person
            </button>
          )}
        </div>

        {/* Scrollable account list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4" style={{ scrollbarGutter: 'stable' }}>
          {accounts.map((acct) => {
            const cfg = assignments[acct.plaidAccountId]
            const cardsForBrand = cfg.brand ? (PRESETS_BY_BRAND[cfg.brand] ?? []) : []
            const template = cfg.brand && cfg.cardName
              ? cardsForBrand.find((p) => p.cardName === cfg.cardName) ?? null
              : null

            return (
              <div key={acct.plaidAccountId} className="rounded-xl border border-slate-200 p-4">
                {/* Account header + skip toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {acct.officialName || acct.name}
                      {acct.mask ? ` ···${acct.mask}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">{acct.subtype || acct.type}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!cfg.skip}
                      onChange={(e) => patchAssignment(acct.plaidAccountId, { skip: !e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Import
                  </label>
                </div>

                {!cfg.skip && (
                  <div className="flex flex-col gap-2">
                    {/* Person + color row */}
                    <div className="flex items-center gap-2">
                      <select
                        value={cfg.personId}
                        onChange={(e) => patchAssignment(acct.plaidAccountId, { personId: e.target.value })}
                        className={`flex-1 ${selectCls}`}
                      >
                        <option value="">Select person…</option>
                        {persons.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {CARD_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => patchAssignment(acct.plaidAccountId, { color: c })}
                            className={`w-5 h-5 rounded-full transition-transform ${
                              cfg.color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Preset picker row */}
                    <div className="flex gap-2">
                      {/* Step 1: Brand */}
                      <select
                        value={cfg.brand}
                        onChange={(e) => patchAssignment(acct.plaidAccountId, { brand: e.target.value, cardName: '' })}
                        className={`flex-1 ${selectCls}`}
                      >
                        <option value="">Brand (optional)…</option>
                        {BRANDS_BY_GROUP.banks.length > 0 && (
                          <optgroup label="Banks">
                            {BRANDS_BY_GROUP.banks.map((b) => <option key={b} value={b}>{b}</option>)}
                          </optgroup>
                        )}
                        {BRANDS_BY_GROUP.airlines.length > 0 && (
                          <optgroup label="Airlines">
                            {BRANDS_BY_GROUP.airlines.map((b) => <option key={b} value={b}>{b}</option>)}
                          </optgroup>
                        )}
                        {BRANDS_BY_GROUP.hotels.length > 0 && (
                          <optgroup label="Hotels">
                            {BRANDS_BY_GROUP.hotels.map((b) => <option key={b} value={b}>{b}</option>)}
                          </optgroup>
                        )}
                        {BRANDS_BY_GROUP.fintech.length > 0 && (
                          <optgroup label="Fintech">
                            {BRANDS_BY_GROUP.fintech.map((b) => <option key={b} value={b}>{b}</option>)}
                          </optgroup>
                        )}
                      </select>

                      {/* Step 2: Card (only if brand selected) */}
                      <select
                        value={cfg.cardName}
                        onChange={(e) => patchAssignment(acct.plaidAccountId, { cardName: e.target.value })}
                        disabled={!cfg.brand}
                        className={`flex-1 ${selectCls} disabled:opacity-40`}
                      >
                        <option value="">Select card…</option>
                        {cardsForBrand.map((t) => (
                          <option key={t.cardName} value={t.cardName}>
                            {t.cardName}{t.annualFee > 0 ? ` ($${t.annualFee}/yr)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Preset reward hint */}
                    {template && (
                      <p className="text-[11px] text-accent-600 bg-accent-50 rounded-lg px-2.5 py-1.5">
                        {template.rewards.length} reward rule{template.rewards.length !== 1 ? 's' : ''}
                        {template.credits?.length
                          ? ` + ${template.credits.length} credit${template.credits.length !== 1 ? 's' : ''}`
                          : ''}
                        {' '}will be applied automatically.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)]">
          {saveError && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onDone}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={saving || persons.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Save & Start Syncing
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main PlaidManager component ───────────────────────────────────────────────

export default function PlaidManager() {
  const { load: loadTransactions, transactions, updateMany } = useTransactionStore()
  const { householdId, profile, session } = useAuth()
  const { cards } = useCardStore()
  const hasPlaidAccess = profile?.plaid_access_enabled === true

  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [items, setItems] = useState<PlaidItem[]>([])
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [setupData, setSetupData] = useState<{
    itemId: string
    institutionName: string | null
    accounts: PlaidAccount[]
  } | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [syncingItems, setSyncingItems] = useState<Set<string>>(new Set())
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({})
  const [loadingLink, setLoadingLink] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [mappingDraftCardId, setMappingDraftCardId] = useState('')
  const [savingMappingId, setSavingMappingId] = useState<string | null>(null)

  // Check server health on mount
  useEffect(() => {
    if (!hasPlaidAccess) return
    checkServerHealth().then(setServerOnline)
  }, [hasPlaidAccess])

  // Load linked items
  const loadItems = useCallback(async () => {
    if (!hasPlaidAccess) return
    if (!serverOnline) return
    try {
      const data = await getItems()
      setItems(data)
    } catch (err) {
      console.error('[PlaidManager] loadItems:', err)
    }
  }, [hasPlaidAccess, serverOnline])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Get a link token ready when user might click "Link Account"
  const fetchLinkToken = async () => {
    setLoadingLink(true)
    setError(null)
    try {
      const { link_token } = await createLinkToken()
      setLinkToken(link_token)
    } catch (err: any) {
      setError(err.message)
      setLoadingLink(false)
    }
  }

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (publicToken, metadata) => {
      setLoadingLink(false)
      setError(null)
      try {
        const result = await exchangeToken(publicToken, metadata.institution)
        setSetupData({
          itemId: result.itemId,
          institutionName: metadata.institution?.name ?? null,
          accounts: result.accounts,
        })
      } catch (err: any) {
        setError(err.message)
      }
    },
    onExit: (err) => {
      setLoadingLink(false)
      if (err) console.error('[PlaidLink] exit error:', err)
    },
  })

  // Open Plaid Link once token is ready
  useEffect(() => {
    if (linkToken && plaidReady) {
      openPlaidLink()
    }
  }, [linkToken, plaidReady, openPlaidLink])

  const handleLinkAccount = async () => {
    await fetchLinkToken()
  }

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Please sign in again before upgrading.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Checkout is not configured. Missing Supabase settings.')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      })

      const checkoutData = await response.json().catch(() => ({})) as { url?: string; error?: string }
      if (!response.ok) throw new Error(checkoutData.error || `Checkout failed (${response.status})`)
      if (!checkoutData.url) throw new Error('Checkout session did not return a Stripe URL.')

      window.location.href = checkoutData.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.')
      setCheckoutLoading(false)
    }
  }

  const handleSetupDone = async () => {
    setSetupData(null)
    setLinkToken(null)
    await loadItems()
  }

  const handleSync = async (itemId?: string, fullResync = false) => {
    const key = itemId ?? '__all__'
    setSyncingItems((prev) => new Set(prev).add(key))
    const shouldFullResync = fullResync || transactions.filter((t) => !t.deleted).length === 0
    setSyncStatus((prev) => ({ ...prev, [key]: shouldFullResync ? 'full resyncing' : 'syncing' }))
    setError(null)

    try {
      const result = await syncTransactions(itemId, { fullResync: shouldFullResync })
      const syncedCount = result.transactions.length

      if (householdId) {
        await loadTransactions(householdId)
      }

      if (syncedCount > 0) {
        // Auto-detect recurring charges on the updated transaction set (non-blocking)
        const { transactions: allTxns } = useTransactionStore.getState()
        runRecurringDetector(allTxns, updateMany).catch(() => {/* non-blocking */})
      }

      setSyncStatus((prev) => ({
        ...prev,
        [key]: syncedCount > 0 ? `+${syncedCount} transactions` : 'Up to date',
      }))
      await loadItems()
    } catch (err: any) {
      setError(err.message)
      setSyncStatus((prev) => ({ ...prev, [key]: 'error' }))
    } finally {
      setSyncingItems((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      setTimeout(() => setSyncStatus((prev) => { const n = { ...prev }; delete n[key]; return n }), 5000)
    }
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this account? Historical transactions will remain.')) return
    try {
      await disconnectItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const startMappingEdit = (account: PlaidAccount) => {
    setEditingAccountId(account.plaidAccountId)
    setMappingDraftCardId(account.cardId ?? '')
    setError(null)
    setSuccessMessage(null)
  }

  const cancelMappingEdit = () => {
    setEditingAccountId(null)
    setMappingDraftCardId('')
  }

  const handleSaveMapping = async (plaidAccountId: string) => {
    const nextCardId = mappingDraftCardId || null
    setSavingMappingId(plaidAccountId)
    setError(null)
    setSuccessMessage(null)

    try {
      await mapAccounts([{ plaidAccountId, cardId: nextCardId }])
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          accounts: item.accounts.map((account) =>
            account.plaidAccountId === plaidAccountId
              ? { ...account, cardId: nextCardId }
              : account,
          ),
        })),
      )
      setSuccessMessage(nextCardId ? 'Account mapping updated.' : 'Account set to unmapped.')
      cancelMappingEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update account mapping.')
    } finally {
      setSavingMappingId(null)
    }
  }

  if (!hasPlaidAccess) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-accent-100 flex items-center justify-center shrink-0">
              <Sparkles size={17} className="text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Automatic bank syncing is a Premium feature
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Unlock automatic bank syncing with Premium — $4.99/month
              </p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-60"
          >
            {checkoutLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {checkoutLoading ? 'Opening Checkout...' : 'Upgrade to Premium'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}
      </div>
    )
  }

  // ── Server offline state ──────────────────────────────────────────────────

  if (serverOnline === null) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
        <Loader2 size={14} className="animate-spin" /> Checking server…
      </div>
    )
  }

  if (serverOnline === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Backend server not running</p>
          <p className="text-xs text-amber-600 mt-1">
            Start it with: <code className="bg-amber-100 px-1 rounded">npm run dev:server</code>
            {' '}in a separate terminal, then refresh this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Link button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">
            {items.length === 0
              ? 'No accounts linked yet.'
              : `${items.length} institution${items.length !== 1 ? 's' : ''} connected`}
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">
            By connecting your bank account, you authorize TribeSpend to access your financial data through Plaid for transaction tracking and spending insights. TribeSpend does not receive or store your bank login credentials.{' '}
            <Link to="/privacy" className="font-medium text-accent-600 hover:text-accent-700">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={() => handleSync()}
              disabled={syncingItems.has('__all__')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {syncingItems.has('__all__') ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {syncStatus['__all__'] || 'Sync All'}
            </button>
          )}
          <button
            onClick={handleLinkAccount}
            disabled={loadingLink}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-60"
          >
            {loadingLink ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Link2 size={14} />
            )}
            Link Bank Account
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          <CheckCircle size={14} className="shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Connected institutions list */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const expanded = expandedItems.has(item.id)
            const syncing = syncingItems.has(item.id)
            const status = syncStatus[item.id]

            return (
              <div key={item.id} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Institution header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {item.institutionName ?? 'Bank Account'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''}
                      {item.lastSyncedAt && (
                        <span> · Last synced {new Date(item.lastSyncedAt).toLocaleString()}</span>
                      )}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-green-500" title="Active" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-red-500" title="Error" />
                    )}
                  </div>

                  {/* Sync button */}
                  <button
                    onClick={() => handleSync(item.id)}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-accent-600 hover:bg-accent-50 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {status || 'Sync'}
                  </button>

                  {/* Disconnect */}
                  <button
                    onClick={() => handleDisconnect(item.id)}
                    className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg"
                    title="Disconnect"
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* Expand */}
                  <button
                    onClick={() =>
                      setExpandedItems((prev) => {
                        const next = new Set(prev)
                        if (next.has(item.id)) next.delete(item.id)
                        else next.add(item.id)
                        return next
                      })
                    }
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Account list */}
                {expanded && (
                  <div className="divide-y divide-slate-100">
                    {item.accounts.map((acct) => {
                      const card = acct.cardId
                        ? cards.find((c) => c.id === acct.cardId)
                        : null
                      const isEditing = editingAccountId === acct.plaidAccountId
                      const isSavingMapping = savingMappingId === acct.plaidAccountId
                      return (
                        <div key={acct.plaidAccountId} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                          {card ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: card.color }}
                            />
                          ) : (
                            <CreditCard size={14} className="text-slate-300 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700">
                              {acct.officialName || acct.name}
                              {acct.mask ? ` ···${acct.mask}` : ''}
                            </p>
                            <p className="text-xs text-slate-400 capitalize">
                              {acct.subtype || acct.type}
                              {' · '}
                              {card ? (
                                <span className="font-medium text-slate-500">{card.name}</span>
                              ) : (
                                <span className="font-medium text-amber-600">Unmapped</span>
                              )}
                            </p>
                          </div>
                          {isEditing ? (
                            <div className="flex w-full items-center gap-2 sm:w-auto">
                              <select
                                value={mappingDraftCardId}
                                onChange={(e) => setMappingDraftCardId(e.target.value)}
                                disabled={isSavingMapping}
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-accent-500 sm:w-56"
                              >
                                <option value="">No card / Unmapped</option>
                                {cards.map((availableCard) => (
                                  <option key={availableCard.id} value={availableCard.id}>
                                    {availableCard.name}
                                    {availableCard.lastFour ? ` ···${availableCard.lastFour}` : ''}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSaveMapping(acct.plaidAccountId)}
                                disabled={isSavingMapping}
                                className="rounded-lg p-1.5 text-accent-600 hover:bg-accent-50 disabled:opacity-50"
                                title="Save mapping"
                              >
                                {isSavingMapping ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                onClick={cancelMappingEdit}
                                disabled={isSavingMapping}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startMappingEdit(acct)}
                              className="self-start rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:self-auto"
                              title="Edit mapped card"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sandbox hint */}
      {import.meta.env.DEV && (
        <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <strong className="text-slate-500">Sandbox testing:</strong> Use institution "First Platypus Bank",
          username <code>user_good</code>, password <code>pass_good</code>.
          For dynamic transaction data: <code>user_transactions_dynamic</code>.
        </div>
      )}

      {/* Account setup modal */}
      {setupData && (
        <AccountSetupModal
          itemId={setupData.itemId}
          institutionName={setupData.institutionName}
          accounts={setupData.accounts}
          onDone={handleSetupDone}
        />
      )}
    </div>
  )
}
