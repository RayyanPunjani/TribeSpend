import { useState, useMemo, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp, Save, Zap, Sparkles } from 'lucide-react'
import type { Transaction } from '@/types'
import { CATEGORY_ICONS } from '@/utils/categories'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { useCardStore } from '@/stores/cardStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useAuth } from '@/contexts/AuthContext'
import { suggestCategory } from '@/services/keywordCategorizer'
import { suggestMerchantPattern, matchesRule } from '@/services/categoryMatcher'
import { isReviewCategory } from '@/utils/categoryFallback'

interface Props {
  transactions: Transaction[]
  duplicateCount?: number
  onConfirm: (transactions: Transaction[]) => void | Promise<void>
  onBack: () => void
}

interface MerchantGroup {
  merchant: string         // cleanDescription (display name)
  rawExample: string       // first raw description (for rule pattern)
  ids: string[]            // transaction IDs in this group
  total: number
  suggested: string | null // keyword suggestion
}

interface Toast {
  id: string
  message: string
}

export default function ParseReview({ transactions, duplicateCount = 0, onConfirm, onBack }: Props) {
  const { cards } = useCardStore()
  const { rules, add: addRule } = useCategoryRuleStore()
  const { transactions: existingTxns, updateMany } = useTransactionStore()
  const { categoryNames, categoryColors } = useCategoryStore()
  const { householdId } = useAuth()

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const assignableCategories = useMemo(
    () => categoryNames
      .filter((c) => c !== 'Needs Review' && c !== 'Refunds & Credits')
      .slice()
      .sort((a, b) => a.localeCompare(b)),
    [categoryNames],
  )
  const sortedCategoryNames = useMemo(
    () => categoryNames
      .filter((c) => c !== 'Needs Review')
      .slice()
      .sort((a, b) => a.localeCompare(b)),
    [categoryNames],
  )

  // Map of id → category for the auto-categorized section (user can override)
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map())

  // Map of merchant cleanDescription → chosen category for "Needs Review" groups
  const [merchantAssignments, setMerchantAssignments] = useState<Map<string, string>>(new Map())

  const [autoCatExpanded, setAutoCatExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Split into auto-categorized vs needs-review
  const { autoCatTxns, needsReviewTxns } = useMemo(() => {
    const autoCat: Transaction[] = []
    const needsReview: Transaction[] = []
    for (const t of transactions) {
      if (isReviewCategory(t.category)) needsReview.push(t)
      else autoCat.push(t)
    }
    return { autoCatTxns: autoCat, needsReviewTxns: needsReview }
  }, [transactions])

  // Build merchant groups from needs-review transactions
  const merchantGroups = useMemo((): MerchantGroup[] => {
    const map = new Map<string, MerchantGroup>()
    for (const t of needsReviewTxns) {
      const key = t.cleanDescription
      if (!map.has(key)) {
        map.set(key, {
          merchant: key,
          rawExample: t.description,
          ids: [],
          total: 0,
          suggested: suggestCategory(t.description),
        })
      }
      const g = map.get(key)!
      g.ids.push(t.id)
      g.total += t.amount
    }
    // Sort: unassigned first, then by total desc
    return Array.from(map.values()).sort((a, b) => {
      const aAssigned = !!merchantAssignments.get(a.merchant)
      const bAssigned = !!merchantAssignments.get(b.merchant)
      if (aAssigned !== bAssigned) return aAssigned ? 1 : -1
      return b.total - a.total
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReviewTxns]) // merchantAssignments intentionally excluded to avoid re-sorting on every pick

  const suggestionsAvailable = useMemo(
    () => merchantGroups.filter((g) => g.suggested && !merchantAssignments.has(g.merchant)).length,
    [merchantGroups, merchantAssignments],
  )

  const resolvedCount = useMemo(
    () =>
      needsReviewTxns.filter((t) => merchantAssignments.has(t.cleanDescription)).length,
    [needsReviewTxns, merchantAssignments],
  )

  const totalCategorized = autoCatTxns.length + resolvedCount

  const assign = useCallback((merchant: string, category: string) => {
    setMerchantAssignments((prev) => {
      const next = new Map(prev)
      if (category) next.set(merchant, category)
      else next.delete(merchant)
      return next
    })
  }, [])

  const acceptAllSuggestions = () => {
    setMerchantAssignments((prev) => {
      const next = new Map(prev)
      for (const g of merchantGroups) {
        if (g.suggested && !next.has(g.merchant)) {
          next.set(g.merchant, g.suggested)
        }
      }
      return next
    })
  }

  const addToast = (message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Build final transaction list
      const final = transactions.map((t) => {
        // Apply overrides to auto-categorized
        const override = overrides.get(t.id)
        if (override) return { ...t, category: override }
        // Apply merchant assignments to needs-review
        if (isReviewCategory(t.category)) {
          const cat = merchantAssignments.get(t.cleanDescription)
          if (cat) return { ...t, category: cat, ruleMatched: true }
        }
        return t
      })

      // Create rules for each newly assigned merchant group
      const newRules: Array<{ merchant: string; category: string; rawExample: string }> = []
      for (const [merchant, category] of merchantAssignments) {
        const group = merchantGroups.find((g) => g.merchant === merchant)
        if (!group) continue
        // Skip if an existing rule already covers this merchant
        const alreadyCovered = rules.some((r) => matchesRule(group.rawExample, r))
        if (!alreadyCovered) {
          newRules.push({ merchant, category, rawExample: group.rawExample })
        }
      }

      const createdRules = await Promise.all(
        newRules.map((nr) =>
          addRule(
            householdId!,
            {
              merchantPattern: suggestMerchantPattern(nr.merchant),
              rawDescriptionExample: nr.rawExample,
              cleanDescription: nr.merchant,
              category: nr.category,
              source: 'user_correction',
            },
          ),
        ),
      )

      // Apply rules retroactively to existing uncategorized transactions
      let retroCount = 0
      for (const rule of createdRules) {
        const matching = existingTxns.filter(
          (t) =>
            !t.deleted &&
            isReviewCategory(t.category) &&
            matchesRule(t.description, rule),
        )
        if (matching.length > 0) {
          await updateMany(
            matching.map((t) => t.id),
            { category: rule.category, ruleMatched: true },
          )
          retroCount += matching.length
        }
      }

      // Show toast(s)
      if (createdRules.length === 1) {
        const r = createdRules[0]
        const extra = retroCount > 0 ? ` · applied to ${retroCount} existing` : ''
        addToast(`Rule saved: ${r.cleanDescription} → ${r.category}${extra}`)
      } else if (createdRules.length > 1) {
        const extra = retroCount > 0 ? ` · ${retroCount} existing transactions updated` : ''
        addToast(`${createdRules.length} rules saved${extra}`)
      }

      // Small delay so toasts are visible before transitioning
      await new Promise((r) => setTimeout(r, createdRules.length > 0 ? 800 : 0))

      await onConfirm(final)
    } catch (err) {
      console.error('[ParseReview] Failed to save imported transactions:', err)
      addToast('Import save failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const unassignedCount = merchantGroups.length - merchantAssignments.size
  const needsReviewCount = Math.max(0, needsReviewTxns.length - resolvedCount)
  const totalRows = transactions.length + duplicateCount

  return (
    <div className="flex flex-col gap-5 relative">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2"
          >
            <CheckCircle size={14} className="text-green-400 shrink-0" />
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Review Transactions</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            CSV columns matched successfully. <span className="font-semibold text-slate-700">{transactions.length}</span> transaction{transactions.length !== 1 ? 's' : ''} ready to import.
            {unassignedCount > 0 && (
              <span className="text-amber-600 ml-1">
                · {unassignedCount} merchant{unassignedCount !== 1 ? 's' : ''} need review
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
          >
            Back
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-60"
          >
            <Save size={15} />
            Save {transactions.length} Transactions
          </button>
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 ${
        needsReviewCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
      }`}>
        <p className={`text-sm font-semibold ${needsReviewCount > 0 ? 'text-amber-900' : 'text-green-800'}`}>
          {totalRows} CSV row{totalRows !== 1 ? 's' : ''} reviewed
        </p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-white/75 px-3 py-2">
            <p className="text-xs text-slate-500">Auto-categorized</p>
            <p className="font-semibold text-slate-800">{totalCategorized}</p>
          </div>
          <div className="rounded-lg bg-white/75 px-3 py-2">
            <p className="text-xs text-slate-500">Needs Review (Other)</p>
            <p className={`font-semibold ${needsReviewCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
              {needsReviewCount}
            </p>
          </div>
          <div className="rounded-lg bg-white/75 px-3 py-2">
            <p className="text-xs text-slate-500">Duplicates skipped</p>
            <p className="font-semibold text-slate-800">{duplicateCount}</p>
          </div>
        </div>
        <p className={`mt-3 text-sm ${needsReviewCount > 0 ? 'text-amber-800' : 'text-green-700'}`}>
          {needsReviewCount > 0
            ? 'Some transactions still need category review after import. You can import now and categorize these later.'
            : 'Categories look ready. You can still review or override anything before importing.'}
        </p>
      </div>

      {/* ── Needs Review section ──────────────────────────────────────────── */}
      {merchantGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                Needs Review — {merchantGroups.length} merchant{merchantGroups.length !== 1 ? 's' : ''}
                {needsReviewTxns.length !== merchantGroups.length && (
                  <span className="font-normal text-amber-600 ml-1">
                    ({needsReviewTxns.length} transactions)
                  </span>
                )}
              </span>
            </div>
            {suggestionsAvailable > 0 && (
              <button
                onClick={acceptAllSuggestions}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
              >
                <Zap size={12} />
                Accept {suggestionsAvailable} Suggestion{suggestionsAvailable !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Merchant group rows */}
          <div className="divide-y divide-slate-100">
            {merchantGroups.map((group) => {
              const assigned = merchantAssignments.get(group.merchant)
              const assignedColor = assigned ? (categoryColors[assigned] ?? '#94a3b8') : null
              const suggestedColor = group.suggested
                ? (categoryColors[group.suggested] ?? '#94a3b8')
                : null

              return (
                <div
                  key={group.merchant}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    assigned ? 'bg-green-50/30' : ''
                  }`}
                >
                  {/* Status dot */}
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      assigned ? 'bg-green-500' : 'bg-amber-400'
                    }`}
                  />

                  {/* Merchant info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{group.merchant}</p>
                    <p className="text-xs text-slate-400">
                      {group.ids.length} transaction{group.ids.length !== 1 ? 's' : ''} ·{' '}
                      {formatCurrency(group.total)}
                    </p>
                  </div>

                  {/* Category assignment UI */}
                  <div className="flex items-center gap-2 shrink-0">
                    {assigned ? (
                      // Already assigned
                      <>
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{
                            backgroundColor: assignedColor + '22',
                            color: assignedColor ?? undefined,
                          }}
                        >
                          <span>{CATEGORY_ICONS[assigned] ?? ''}</span>
                          {assigned}
                        </span>
                        <select
                          value={assigned}
                          onChange={(e) => assign(group.merchant, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-slate-500"
                        >
                          {assignableCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </>
                    ) : group.suggested ? (
                      // Keyword suggestion available
                      <>
                        <button
                          onClick={() => assign(group.merchant, group.suggested!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed transition-colors hover:opacity-90"
                          style={{
                            borderColor: suggestedColor + '88',
                            backgroundColor: suggestedColor + '15',
                            color: suggestedColor ?? undefined,
                          }}
                          title="Click to accept this suggestion"
                        >
                          <Sparkles size={10} />
                          {group.suggested}
                        </button>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) assign(group.merchant, e.target.value)
                          }}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-slate-400"
                        >
                          <option value="">Override…</option>
                          {assignableCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      // No suggestion — plain dropdown
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) assign(group.merchant, e.target.value)
                        }}
                        className="text-xs border border-amber-300 bg-amber-50 text-amber-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-[160px]"
                      >
                        <option value="">Select category…</option>
                        {assignableCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Auto-Categorized section ──────────────────────────────────────── */}
      {autoCatTxns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setAutoCatExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={15} className="text-green-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-700">
                Auto-Categorized — {autoCatTxns.length} transaction{autoCatTxns.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-slate-400 font-normal">
                (expand to review or override)
              </span>
            </div>
            {autoCatExpanded ? (
              <ChevronUp size={14} className="text-slate-400 shrink-0" />
            ) : (
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            )}
          </button>

          {autoCatExpanded && (
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2 font-medium text-slate-500 w-20">Date</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-500">Merchant</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-500 w-44">Category</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-500 w-16">Card</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500 w-24">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {autoCatTxns.map((t) => {
                    const card = cardMap.get(t.cardId)
                    const currentCat = overrides.get(t.id) ?? t.category
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                          {formatDate(t.transDate, 'MMM d')}
                        </td>
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-700 truncate max-w-xs">
                            {t.cleanDescription}
                          </p>
                          <p className="text-slate-400 truncate max-w-xs" title={t.description}>
                            {t.description}
                          </p>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={currentCat}
                            onChange={(e) => {
                              const next = e.target.value
                              setOverrides((prev) => {
                                const m = new Map(prev)
                                if (next === t.category) m.delete(t.id)
                                else m.set(t.id, next)
                                return m
                              })
                            }}
                            className="w-full text-xs rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-accent-500"
                          >
                            {sortedCategoryNames.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-slate-400">
                          {card ? `···${card.lastFour}` : '—'}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold ${
                          t.isPayment || t.isCredit ? 'text-green-600' : 'text-slate-800'
                        }`}>
                          {t.isPayment || t.isCredit ? '-' : ''}
                          {formatCurrency(Math.abs(t.amount))}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {t.ruleMatched && (
                            <span title="Matched a saved rule" className="text-green-500">
                              <CheckCircle size={12} />
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty state — all categorized */}
      {merchantGroups.length === 0 && autoCatTxns.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No transactions to review.
        </div>
      )}
    </div>
  )
}
