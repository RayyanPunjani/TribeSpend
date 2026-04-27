import { useState } from 'react'
import { X, BookMarked } from 'lucide-react'
import { CATEGORIES } from '@/utils/categories'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuth } from '@/contexts/AuthContext'
import { suggestMerchantPattern } from '@/services/categoryMatcher'
import type { Transaction } from '@/types'

interface Props {
  transaction: Transaction
  newCategory: string
  onClose: () => void
  onSaved?: () => void
}

export default function CategoryRuleModal({ transaction, newCategory, onClose, onSaved }: Props) {
  const [pattern, setPattern] = useState(
    suggestMerchantPattern(transaction.cleanDescription),
  )
  const [cleanName, setCleanName] = useState(transaction.cleanDescription)
  const [category, setCategory] = useState(newCategory)
  const [applying, setApplying] = useState(false)

  const { add: addRule } = useCategoryRuleStore()
  const { transactions, updateMany, update } = useTransactionStore()
  const { householdId } = useAuth()

  const handleSaveRule = async () => {
    setApplying(true)
    try {
      await addRule(householdId!, {
        merchantPattern: pattern.toLowerCase().trim(),
        rawDescriptionExample: transaction.description,
        cleanDescription: cleanName,
        category,
        source: 'user_correction',
      })

      // Retroactively apply to all matching transactions
      const patternLower = pattern.toLowerCase().trim()
      const matchingIds = transactions
        .filter((t) =>
          t.description.toLowerCase().includes(patternLower) ||
          t.cleanDescription.toLowerCase().includes(patternLower),
        )
        .map((t) => t.id)

      if (matchingIds.length > 0) {
        await updateMany(matchingIds, {
          category,
          cleanDescription: cleanName,
          ruleMatched: true,
        })
      }

      onSaved?.()
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const handleJustThisOnce = async () => {
    await update(transaction.id, { category, cleanDescription: cleanName })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookMarked size={18} className="text-accent-600" />
            <h3 className="font-semibold text-slate-800">Save Category Rule?</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Auto-categorize future transactions from this merchant using a saved rule.
          </p>

          {/* Merchant pattern */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Match pattern (case-insensitive)
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="e.g., dallas masjid"
            />
            <p className="text-xs text-slate-400 mt-1">
              Will match descriptions containing this text
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
              {CATEGORIES.map((c) => (
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
            {applying ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
