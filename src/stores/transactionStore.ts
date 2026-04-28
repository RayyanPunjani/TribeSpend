import { create } from 'zustand'
import type { Transaction, TransactionFilters } from '@/types'
import { supabase } from '@/lib/supabase'

interface TransactionState {
  transactions: Transaction[]
  loaded: boolean
  filters: TransactionFilters
  load: (householdId: string) => Promise<void>
  addMany: (householdId: string, txns: Transaction[]) => Promise<void>
  update: (id: string, patch: Partial<Transaction>) => Promise<void>
  updateMany: (ids: string[], patch: Partial<Transaction>) => Promise<void>
  remove: (id: string) => Promise<void>
  removeByStatement: (statementId: string) => Promise<void>
  setFilters: (filters: Partial<TransactionFilters>) => void
  resetFilters: () => void
  getFiltered: () => Transaction[]
}

export const defaultFilters: TransactionFilters = {
  personIds: [],
  cardIds: [],
  categories: [],
  dateStart: '',
  dateEnd: '',
  amountMin: '',
  amountMax: '',
  search: '',
  showPayments: false,
  showReimbursements: true,
  recurringOnly: false,
  needsReviewOnly: false,
  showDeleted: false,
  showBalancePayments: false,
}

// ── Row mappers (snake_case DB ↔ camelCase app) ───────────────

function fromRow(r: Record<string, unknown>): Transaction {
  return {
    id: r.id as string,
    transDate: r.trans_date as string,
    postDate: (r.post_date as string) || (r.trans_date as string),
    description: r.description as string,
    cleanDescription: (r.clean_description as string) || (r.description as string),
    amount: Number(r.amount),
    category: r.category as string,
    cardId: (r.card_id as string) || '',
    cardholderName: (r.cardholder_name as string) || '',
    isPayment: r.is_payment as boolean,
    isCredit: r.is_credit as boolean,
    isBalancePayment: (r.is_balance_payment as boolean) || false,
    statementId: (r.statement_id as string) || '',
    reimbursementStatus: (r.reimbursement_status as Transaction['reimbursementStatus']) || 'none',
    reimbursementAmount: r.reimbursement_amount as number | undefined,
    reimbursementPerson: r.reimbursement_to as string | undefined,
    reimbursementPaid: !!r.reimbursement_paid,
    isRecurring: (r.is_recurring as boolean) || false,
    recurringAutoDetected: (r.recurring_auto_detected as boolean) || false,
    recurringDismissed: (r.recurring_dismissed as boolean) || false,
    notes: r.notes as string | undefined,
    deleted: (r.is_deleted as boolean) || false,
    isManualEntry: (r.is_manual_entry as boolean) || false,
    source: r.source as Transaction['source'],
    plaidTransactionId: r.plaid_transaction_id as string | undefined,
    spendType: r.spend_type as Transaction['spendType'],
    expectingReturn: r.expected_return_status === 'expected',
    expectedReturnAmount: r.expected_return_amount as number | undefined,
    expectedReturnNote: r.expected_return_note as string | undefined,
    refundForId: (r.refund_for_id as string | null) ?? null,
    hasRefund: (r.has_refund as boolean) || false,
    refundReviewPending: (r.refund_review_pending as boolean) || false,
  }
}

function toRow(t: Partial<Transaction>, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId) row.household_id = householdId
  if (t.id !== undefined) row.id = t.id
  if (t.transDate !== undefined) row.trans_date = t.transDate
  if (t.postDate !== undefined) row.post_date = t.postDate
  if (t.description !== undefined) row.description = t.description
  if (t.cleanDescription !== undefined) row.clean_description = t.cleanDescription
  if (t.amount !== undefined) row.amount = t.amount
  if (t.category !== undefined) row.category = t.category
  if (t.cardId !== undefined) row.card_id = t.cardId
  if (t.cardholderName !== undefined) row.cardholder_name = t.cardholderName
  if (t.isPayment !== undefined) row.is_payment = t.isPayment
  if (t.isCredit !== undefined) row.is_credit = t.isCredit
  if (t.isBalancePayment !== undefined) row.is_balance_payment = t.isBalancePayment
  if (t.statementId !== undefined) row.statement_id = t.statementId
  if (t.reimbursementStatus !== undefined) row.reimbursement_status = t.reimbursementStatus
  if (t.reimbursementAmount !== undefined) row.reimbursement_amount = t.reimbursementAmount
  if (t.reimbursementPerson !== undefined) row.reimbursement_to = t.reimbursementPerson
  if (t.reimbursementPaid !== undefined) row.reimbursement_paid = t.reimbursementPaid ? 1 : 0
  if (t.isRecurring !== undefined) row.is_recurring = t.isRecurring
  if (t.recurringAutoDetected !== undefined) row.recurring_auto_detected = t.recurringAutoDetected
  if (t.recurringDismissed !== undefined) row.recurring_dismissed = t.recurringDismissed
  if (t.notes !== undefined) row.notes = t.notes
  if (t.deleted !== undefined) row.is_deleted = t.deleted
  if (t.isManualEntry !== undefined) row.is_manual_entry = t.isManualEntry
  if (t.source !== undefined) row.source = t.source
  if (t.plaidTransactionId !== undefined) row.plaid_transaction_id = t.plaidTransactionId
  if (t.spendType !== undefined) row.spend_type = t.spendType
  if (t.expectedReturnNote !== undefined) row.expected_return_note = t.expectedReturnNote
  if (t.expectedReturnAmount !== undefined) row.expected_return_amount = t.expectedReturnAmount
  if (t.expectingReturn !== undefined) row.expected_return_status = t.expectingReturn ? 'expected' : null
  if (t.refundForId !== undefined) row.refund_for_id = t.refundForId
  if (t.hasRefund !== undefined) row.has_refund = t.hasRefund
  if (t.refundReviewPending !== undefined) row.refund_review_pending = t.refundReviewPending
  return row
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loaded: false,
  filters: { ...defaultFilters },

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('household_id', householdId)
      .order('trans_date', { ascending: false })
    if (error) {
      console.error('Failed to load transactions:', error)
      set({ loaded: true })
      return
    }
    set({ transactions: (data || []).map(fromRow), loaded: true })
  },

  addMany: async (householdId, txns) => {
    const rows = txns.map((t) => toRow(t, householdId))
    const { error } = await supabase.from('transactions').insert(rows)
    if (error) { console.error('Failed to add transactions:', error); throw error }
    await get().load(householdId)
  },

  update: async (id, patch) => {
    const { error } = await supabase.from('transactions').update(toRow(patch)).eq('id', id)
    if (error) { console.error('Failed to update transaction:', error); return }
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  },

  updateMany: async (ids, patch) => {
    const { error } = await supabase.from('transactions').update(toRow(patch)).in('id', ids)
    if (error) { console.error('Failed to update transactions:', error); return }
    set((s) => ({
      transactions: s.transactions.map((t) => ids.includes(t.id) ? { ...t, ...patch } : t),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { console.error('Failed to remove transaction:', error); return }
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
  },

  removeByStatement: async (statementId) => {
    const { error } = await supabase.from('transactions').delete().eq('statement_id', statementId)
    if (error) { console.error('Failed to remove by statement:', error); return }
    set((s) => ({ transactions: s.transactions.filter((t) => t.statementId !== statementId) }))
  },

  setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  getFiltered: () => applyFilters(get().transactions, get().filters),
}))

export function applyFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  return transactions.filter((t) => {
    if (!filters.showDeleted && t.deleted) return false
    if (!filters.showBalancePayments && t.isBalancePayment) return false
    if (!filters.showPayments && (t.isPayment || t.isCredit) && !t.isBalancePayment) return false
    if (filters.cardIds.length > 0 && !filters.cardIds.includes(t.cardId)) return false
    if (filters.categories.length > 0 && !filters.categories.includes(t.category)) return false
    if (filters.needsReviewOnly && t.category !== 'Needs Review') return false
    if (filters.recurringOnly && !t.isRecurring) return false
    if (filters.dateStart && t.transDate < filters.dateStart) return false
    if (filters.dateEnd && t.transDate > filters.dateEnd) return false
    if (filters.amountMin !== '' && t.amount < parseFloat(filters.amountMin)) return false
    if (filters.amountMax !== '' && t.amount > parseFloat(filters.amountMax)) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !t.description.toLowerCase().includes(q) &&
        !t.cleanDescription.toLowerCase().includes(q) &&
        !(t.notes || '').toLowerCase().includes(q) &&
        !t.category.toLowerCase().includes(q)
      ) return false
    }
    return true
  })
}
