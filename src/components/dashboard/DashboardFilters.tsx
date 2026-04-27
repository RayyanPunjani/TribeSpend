import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CreditCard, Person } from '@/types'
import { type DatePreset, PRESET_LABELS } from '@/utils/dateRanges'

export interface DashboardFilterState {
  datePreset: DatePreset
  customStart: string
  customEnd: string
  selectedPersonIds: string[]   // empty = all
  selectedCardIds: string[]     // empty = all
  includeReimb: boolean
  includeExpectedReturns: boolean
  includePayments: boolean
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  datePreset: 'thisMonth',
  customStart: '',
  customEnd: '',
  selectedPersonIds: [],
  selectedCardIds: [],
  includeReimb: true,
  includeExpectedReturns: true,
  includePayments: false,
}

interface Props {
  filters: DashboardFilterState
  onChange: (patch: Partial<DashboardFilterState>) => void
  persons: Person[]
  cards: CreditCard[]
}

export default function DashboardFilters({ filters, onChange, persons, cards }: Props) {
  const [expanded, setExpanded] = useState(false)

  const creditCards = cards.filter((c) => !c.isPaymentMethod)

  const isPersonSelected = (id: string) =>
    filters.selectedPersonIds.length === 0 || filters.selectedPersonIds.includes(id)

  const isCardSelected = (id: string) =>
    filters.selectedCardIds.length === 0 || filters.selectedCardIds.includes(id)

  const togglePerson = (id: string) => {
    const allIds = persons.map((p) => p.id)
    let next: string[]
    if (filters.selectedPersonIds.length === 0) {
      next = allIds.filter((x) => x !== id)
    } else if (filters.selectedPersonIds.includes(id)) {
      next = filters.selectedPersonIds.filter((x) => x !== id)
    } else {
      next = [...filters.selectedPersonIds, id]
      if (next.length === allIds.length) next = []
    }
    onChange({ selectedPersonIds: next, selectedCardIds: [] })
  }

  const toggleCard = (id: string) => {
    const allIds = visibleCards.map((c) => c.id)
    let next: string[]
    if (filters.selectedCardIds.length === 0) {
      next = allIds.filter((x) => x !== id)
    } else if (filters.selectedCardIds.includes(id)) {
      next = filters.selectedCardIds.filter((x) => x !== id)
    } else {
      next = [...filters.selectedCardIds, id]
      if (next.length === allIds.length) next = []
    }
    onChange({ selectedCardIds: next })
  }

  const visibleCards =
    filters.selectedPersonIds.length === 0
      ? creditCards
      : creditCards.filter((c) => filters.selectedPersonIds.includes(c.owner))

  const hasPersonFilter = filters.selectedPersonIds.length > 0
  const hasCardFilter = filters.selectedCardIds.length > 0
  const hasOptionChanges =
    !filters.includeReimb || !filters.includeExpectedReturns || filters.includePayments

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Date preset row — always visible */}
      <div className="px-4 pt-3 pb-2.5 flex flex-wrap gap-1.5">
        {PRESET_LABELS.map(([key, label]) => (
          <button
            key={key}
            onClick={() =>
              onChange({ datePreset: key, ...(key !== 'custom' ? {} : {}) })
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              filters.datePreset === key
                ? 'bg-accent-600 text-white border-accent-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {filters.datePreset === 'custom' && (
        <div className="px-4 pb-2.5 flex items-center gap-2">
          <input
            type="date"
            value={filters.customStart}
            onChange={(e) => onChange({ customStart: e.target.value })}
            className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
          <span className="text-slate-400 text-xs">—</span>
          <input
            type="date"
            value={filters.customEnd}
            onChange={(e) => onChange({ customEnd: e.target.value })}
            className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
      )}

      {/* Expand toggle for people / cards / options */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-slate-500">
            {hasPersonFilter ? (
              <span className="font-medium text-accent-600">
                {filters.selectedPersonIds.length} person
                {filters.selectedPersonIds.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span>All people</span>
            )}
            {hasCardFilter && (
              <span className="font-medium text-accent-600">
                · {filters.selectedCardIds.length} card
                {filters.selectedCardIds.length !== 1 ? 's' : ''}
              </span>
            )}
            {!filters.includeReimb && (
              <span className="text-slate-400">· net spend</span>
            )}
            {!filters.includeExpectedReturns && (
              <span className="text-slate-400">· excl. returns</span>
            )}
            {filters.includePayments && (
              <span className="text-slate-400">· +payments</span>
            )}
          </span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-4 border-t border-slate-100 pt-3">
            {/* People */}
            {persons.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500">People</p>
                  {hasPersonFilter && (
                    <button
                      onClick={() => onChange({ selectedPersonIds: [], selectedCardIds: [] })}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Select all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {persons.map((p) => {
                    const active = isPersonSelected(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePerson(p.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          active
                            ? 'text-white border-transparent'
                            : 'text-slate-400 border-slate-200 bg-white opacity-50 hover:opacity-75'
                        }`}
                        style={active ? { backgroundColor: p.color, borderColor: p.color } : {}}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Cards */}
            {visibleCards.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500">Cards</p>
                  {hasCardFilter && (
                    <button
                      onClick={() => onChange({ selectedCardIds: [] })}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Select all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleCards.map((c) => {
                    const active = isCardSelected(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCard(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          active
                            ? 'text-white border-transparent'
                            : 'text-slate-400 border-slate-200 bg-white opacity-50 hover:opacity-75'
                        }`}
                        style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
                      >
                        {c.name}
                        {c.lastFour ? ` ···${c.lastFour}` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="flex flex-wrap gap-4 pt-1 border-t border-slate-100">
              {(
                [
                  { label: 'Show Full Amounts', key: 'includeReimb' },
                  { label: 'Include Expected Returns', key: 'includeExpectedReturns' },
                  { label: 'Include Payments / Credits', key: 'includePayments' },
                ] as const
              ).map(({ label, key }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={(e) => onChange({ [key]: e.target.checked })}
                    className="rounded border-slate-300 text-accent-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
