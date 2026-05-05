import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, PencilLine, CreditCard } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction } from '@/types'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuth } from '@/contexts/AuthContext'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { findMatchingRule } from '@/services/categoryMatcher'
import { useCategoryStore } from '@/stores/categoryStore'

interface Props {
  onClose: () => void
}

export default function AddTransactionModal({ onClose }: Props) {
  const { addMany } = useTransactionStore()
  const { householdId } = useAuth()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const { rules } = useCategoryRuleStore()
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const categories = [...categoryNames, 'Payment']

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    transDate: today,
    postDate: '',
    description: '',
    amount: '',
    category: 'Other',
    personId: '',
    cardId: '',
    notes: '',
    isRecurring: false,
    isReimbursable: false,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Auto-detect category from saved rules when description changes
  useEffect(() => {
    if (!form.description.trim()) return
    const rule = findMatchingRule(form.description, rules)
    if (rule) {
      setForm((f) => ({
        ...f,
        category: rule.category,
        personId: rule.personId ?? f.personId,
        cardId: rule.cardId ?? f.cardId,
      }))
    }
  }, [form.description, rules])

  const paymentMethodCards = cards.filter((c) => c.isPaymentMethod)
  const creditCards = cards.filter((c) => !c.isPaymentMethod)

  // Cards for the selected person, plus all payment method cards
  const personCreditCards = form.personId
    ? creditCards.filter((c) => persons.find((p) => p.id === form.personId)?.cards.includes(c.id))
    : creditCards
  const availableCards = [...personCreditCards, ...paymentMethodCards]
  const hasCards = cards.length > 0

  const canSave =
    form.description.trim() !== '' &&
    form.amount !== '' &&
    parseFloat(form.amount) !== 0 &&
    !isNaN(parseFloat(form.amount)) &&
    cards.some((card) => card.id === form.cardId)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError('')

    const amountRaw = parseFloat(form.amount)
    const isCredit = amountRaw < 0
    const selectedCard = cards.find((c) => c.id === form.cardId)
    if (!selectedCard) {
      setSaveError('Select a card or payment method before saving.')
      setSaving(false)
      return
    }
    const selectedPersonId = form.personId || selectedCard?.owner || ''
    const selectedPerson = persons.find((p) => p.id === selectedPersonId)

    const transaction: Transaction = {
      id: uuidv4(),
      transDate: form.transDate,
      postDate: form.postDate || form.transDate,
      description: form.description.trim(),
      cleanDescription: form.description.trim(),
      amount: Math.abs(amountRaw),
      category: form.category,
      cardId: form.cardId,
      personId: selectedPersonId || undefined,
      cardholderName: selectedPerson?.name || '',
      isPayment: isCredit,
      isCredit: isCredit,
      isBalancePayment: false,
      statementId: 'manual',
      reimbursementStatus: form.isReimbursable ? 'settled' : 'none',
      reimbursementPaid: false,
      isRecurring: form.isRecurring || undefined,
      notes: form.notes.trim() || undefined,
      isManualEntry: true,
      refundForId: null,
      hasRefund: false,
      refundReviewPending: false,
    }

    try {
      await addMany(householdId!, [transaction])
      onClose()
    } catch (error) {
      console.error('[AddTransactionModal] Failed to add transaction:', error)
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => {
    setSaveError('')
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PencilLine size={18} className="text-accent-600" />
            <h2 className="text-base font-semibold text-slate-800">Add Transaction</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 pb-6 flex flex-col gap-4">
          {!hasCards && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <CreditCard size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">Add a card to start tracking transactions</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Transactions need a card or payment method so spending, rewards, and ownership stay accurate.
                  </p>
                  <Link
                    to="/app/wallet?tab=paymentMethods"
                    onClick={onClose}
                    className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Add Card
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Date + Post Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input
                type="date"
                value={form.transDate}
                onChange={(e) => set('transDate', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Post Date</label>
              <input
                type="date"
                value={form.postDate}
                onChange={(e) => set('postDate', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="e.g., Trader Joe's, Netflix"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Amount *{' '}
              <span className="text-slate-400 font-normal">(negative for a refund/credit)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                step="0.01"
                placeholder="0.00"
                className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Person */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Person</label>
            <select
              value={form.personId}
              onChange={(e) => { set('personId', e.target.value); set('cardId', '') }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              <option value="">Select person</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Card / Account */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Card / Account *</label>
            <select
              value={form.cardId}
              onChange={(e) => set('cardId', e.target.value)}
              disabled={!hasCards}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">{hasCards ? 'Select card / payment method' : 'Add a card first'}</option>
              {personCreditCards.length > 0 && (
                <optgroup label="Credit Cards">
                  {personCreditCards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (···{c.lastFour})</option>
                  ))}
                </optgroup>
              )}
              {paymentMethodCards.length > 0 && (
                <optgroup label="Other Payment Methods">
                  {paymentMethodCards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {hasCards && !form.cardId && (
              <p className="mt-1 text-xs text-amber-600">Select a card or payment method before saving.</p>
            )}
            {hasCards && availableCards.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No cards are available for the selected person. Choose another person or add a card.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional note"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2.5 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) => set('isRecurring', e.target.checked)}
                className="rounded border-slate-300 text-accent-600"
              />
              Recurring charge
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isReimbursable}
                onChange={(e) => set('isReimbursable', e.target.checked)}
                className="rounded border-slate-300 text-accent-600"
              />
              Reimbursable (someone owes me for this)
            </label>
          </div>
          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-4 py-4 border-t border-slate-100 sm:flex-row sm:px-6">
          <button
            onClick={onClose}
            className="min-h-11 px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="min-h-11 flex-1 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
