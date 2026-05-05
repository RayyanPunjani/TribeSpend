import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTransactionStore, defaultFilters } from '@/stores/transactionStore'
import { usePersonStore } from '@/stores/personStore'
import { useCardStore } from '@/stores/cardStore'
import { useCategoryStore } from '@/stores/categoryStore'

export default function FilterBar() {
  const { filters, setFilters, resetFilters } = useTransactionStore()
  const { transactions } = useTransactionStore()
  const { persons } = usePersonStore()
  const { cards } = useCardStore()
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const filterCategories = Array.from(new Set([
    ...categoryNames,
    ...transactions.map((transaction) => transaction.category),
  ])).filter(Boolean)

  const hasActiveFilters =
    filters.cardIds.length > 0 ||
    filters.categories.length > 0 ||
    filters.dateStart ||
    filters.dateEnd ||
    filters.amountMin ||
    filters.amountMax ||
    !filters.showPayments ||
    filters.recurringOnly ||
    filters.needsReviewOnly ||
    filters.showDeleted ||
    filters.showBalancePayments

  const toggleCard = (cardId: string) => {
    const ids = filters.cardIds.includes(cardId)
      ? filters.cardIds.filter((c) => c !== cardId)
      : [...filters.cardIds, cardId]
    setFilters({ cardIds: ids })
  }

  const toggleCategory = (cat: string) => {
    const cats = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat]
    setFilters({ categories: cats })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      {/* Search + toggle advanced */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search transactions, merchants, notes…"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            showAdvanced || hasActiveFilters
              ? 'border-accent-500 bg-accent-50 text-accent-700'
              : 'border-slate-300 text-slate-600 hover:border-slate-400'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {hasActiveFilters && (
            <span className="bg-accent-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              !
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Reset
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="flex flex-col gap-4 pt-2 border-t border-slate-100 animate-fade-in">
          {/* Toggles */}
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showPayments}
                onChange={(e) => setFilters({ showPayments: e.target.checked })}
                className="rounded border-slate-300 text-accent-600"
              />
              Show credits &amp; refunds
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showBalancePayments}
                onChange={(e) => setFilters({ showBalancePayments: e.target.checked })}
                className="rounded border-slate-300 text-accent-600"
              />
              Show balance payments
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.recurringOnly}
                onChange={(e) => setFilters({ recurringOnly: e.target.checked })}
                className="rounded border-slate-300 text-accent-600"
              />
              Recurring only
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.needsReviewOnly}
                onChange={(e) => setFilters({ needsReviewOnly: e.target.checked })}
                className="rounded border-slate-300 text-accent-600"
              />
              Category review only
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showDeleted}
                onChange={(e) => setFilters({ showDeleted: e.target.checked })}
                className="rounded border-slate-300 text-accent-600"
              />
              Show hidden transactions
            </label>
          </div>

          {filters.showDeleted && (
            <p className="text-xs text-slate-500">
              Hidden transactions stay saved but do not count toward totals.
            </p>
          )}

          {/* Cards grouped by person */}
          {persons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Cards
              </p>
              <div className="flex flex-wrap gap-2">
                {persons.map((person) => {
                  const personCards = cards.filter((c) => c.owner === person.id)
                  return personCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => toggleCard(card.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        filters.cardIds.includes(card.id)
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: card.color }}
                      />
                      {card.name}
                    </button>
                  ))
                })}
              </div>
            </div>
          )}

          {/* Categories */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {filterCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    filters.categories.includes(cat)
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Amount range */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Date Range</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="date"
                  value={filters.dateStart}
                  onChange={(e) => setFilters({ dateStart: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <span className="text-slate-400 text-xs">–</span>
                <input
                  type="date"
                  value={filters.dateEnd}
                  onChange={(e) => setFilters({ dateEnd: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Amount Range ($)</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="number"
                  value={filters.amountMin}
                  onChange={(e) => setFilters({ amountMin: e.target.value })}
                  placeholder="Min"
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <span className="text-slate-400 text-xs">–</span>
                <input
                  type="number"
                  value={filters.amountMax}
                  onChange={(e) => setFilters({ amountMax: e.target.value })}
                  placeholder="Max"
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
