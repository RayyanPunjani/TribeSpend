import { useState } from 'react'
import { X, BookMarked } from 'lucide-react'
import { useCategoryStore } from '@/stores/categoryStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeMerchantKey, normalizeMerchantName } from '@/lib/merchantNormalize'
import type { Transaction } from '@/types'

interface Props {
  transaction: Transaction
  newCategory?: string
  newCardId?: string
  newPersonId?: string
  newCardholderName?: string
  onClose: () => void
  onSaved?: () => void
}

export default function CategoryRuleModal({
  transaction,
  newCategory,
  newCardId,
  newPersonId,
  newCardholderName,
  onClose,
  onSaved,
}: Props) {
  const [pattern, setPattern] = useState(
    normalizeMerchantKey(transaction.cleanDescription || transaction.description),
  )
  const [cleanName, setCleanName] = useState(normalizeMerchantName(transaction.cleanDescription || transaction.description))
  const [category, setCategory] = useState(newCategory ?? transaction.category)
  const [applying, setApplying] = useState(false)

  const { add: addRule } = useCategoryRuleStore()
  const { transactions, updateMany, update } = useTransactionStore()
  const { householdId } = useAuth()
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const categoryOptions = category && !categoryNames.includes(category)
    ? [category, ...categoryNames]
    : categoryNames
  const cardChanged = newCardId !== undefined && newCardId !== transaction.cardId
  const personChanged = newPersonId !== undefined && newPersonId !== (transaction.personId ?? '')
  const categoryChanged = newCategory !== undefined && newCategory !== transaction.category
  const patch = {
    ...(categoryChanged ? { category } : {}),
    ...(cardChanged ? { cardId: newCardId } : {}),
    ...(personChanged ? { personId: newPersonId, cardholderName: newCardholderName ?? '' } : {}),
    cleanDescription: cleanName,
    ruleMatched: true,
  }

  const matchingIds = transactions
    .filter((t) => normalizeMerchantKey(t.cleanDescription || t.description) === normalizeMerchantKey(transaction.cleanDescription || transaction.description))
    .map((t) => t.id)

  const handleSaveRule = async () => {
    setApplying(true)
    try {
      const ruleCardId = newCardId ?? transaction.cardId
      const rulePersonId = newPersonId ?? transaction.personId
      await addRule(householdId!, {
        merchantPattern: pattern.toLowerCase().trim(),
        rawDescriptionExample: transaction.description,
        cleanDescription: cleanName,
        category,
        ...(ruleCardId ? { cardId: ruleCardId } : {}),
        ...(rulePersonId ? { personId: rulePersonId } : {}),
        source: 'user_correction',
      })

      if (matchingIds.length > 0) {
        await updateMany(matchingIds, patch)
      }

      onSaved?.()
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const handleJustThisOnce = async () => {
    await update(transaction.id, patch)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-2 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookMarked size={18} className="text-accent-600" />
            <h3 className="font-semibold text-slate-800">Apply to Similar?</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Apply to similar transactions and remember for next time?
          </p>

          {/* Merchant pattern */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Merchant match
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="e.g., dallas masjid"
            />
            <p className="text-xs text-slate-400 mt-1">
              Matches normalized merchant names, not one-off transaction codes.
            </p>
          </div>

          {/* Clean name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Clean merchant name
            </label>
            <input
              type="text"
              value={cleanName}
              onChange={(e) => setCleanName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handleJustThisOnce}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            Just This Once
          </button>
          <button
            onClick={handleSaveRule}
            disabled={applying || !pattern.trim()}
            className="flex-1 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-50"
          >
            {applying ? 'Saving...' : `Apply & Remember${matchingIds.length > 1 ? ` (${matchingIds.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
