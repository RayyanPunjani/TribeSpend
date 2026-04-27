import { useState } from 'react'
import { AlertTriangle, XCircle, ChevronUp, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBudgetStatus } from '@/hooks/useBudgetStatus'
import { usePersonStore } from '@/stores/personStore'
import { formatCurrency } from '@/utils/formatters'

const COLLAPSE_KEY = 'dashboard_budget_alerts_expanded'

interface Props {
  selectedPersonIds: string[]
}

export default function BudgetAlerts({ selectedPersonIds }: Props) {
  const statuses = useBudgetStatus()
  const { persons } = usePersonStore()

  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) !== 'false' } catch { return true }
  })

  const toggle = () =>
    setExpanded((v) => {
      const next = !v
      try { localStorage.setItem(COLLAPSE_KEY, String(next)) } catch {}
      return next
    })

  // Only show budgets that have crossed at least one threshold.
  // Respect the dashboard person filter: household budgets always show,
  // person-specific budgets are filtered to selectedPersonIds when a filter is active.
  const triggered = statuses
    .filter((s) => {
      if (s.crossedThresholds.length === 0) return false
      if (selectedPersonIds.length === 0) return true
      return !s.budget.personId || selectedPersonIds.includes(s.budget.personId)
    })
    .sort((a, b) => {
      if (a.status === 'over' && b.status !== 'over') return -1
      if (b.status === 'over' && a.status !== 'over') return 1
      return b.percentUsed - a.percentUsed
    })

  if (triggered.length === 0) return null

  const hasOver = triggered.some((s) => s.status === 'over')
  const overCount = triggered.filter((s) => s.status === 'over').length

  const personLabel = (personId?: string) =>
    personId ? (persons.find((p) => p.id === personId)?.name ?? 'Unknown') : 'Household'

  // Theme tokens derived from worst status
  const theme = hasOver
    ? {
        container: 'bg-red-50 border-red-200',
        hover: 'hover:bg-red-100/50',
        divider: 'border-red-200',
        icon: 'text-red-600',
        heading: 'text-red-800',
        chevron: 'text-red-500',
        link: 'text-red-600 hover:text-red-800',
      }
    : {
        container: 'bg-amber-50 border-amber-200',
        hover: 'hover:bg-amber-100/50',
        divider: 'border-amber-200',
        icon: 'text-amber-600',
        heading: 'text-amber-800',
        chevron: 'text-amber-500',
        link: 'text-amber-600 hover:text-amber-800',
      }

  return (
    <div className={`border rounded-xl overflow-hidden ${theme.container}`}>
      {/* ── Collapsible header ── */}
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between px-4 py-3 ${theme.hover} transition-colors`}
      >
        <div className="flex items-center gap-2">
          {hasOver
            ? <XCircle size={15} className={`${theme.icon} shrink-0`} />
            : <AlertTriangle size={15} className={`${theme.icon} shrink-0`} />}
          <p className={`text-sm font-semibold ${theme.heading}`}>
            {triggered.length} budget alert{triggered.length !== 1 ? 's' : ''}{' — '}
            {overCount > 0
              ? `${overCount} over budget${triggered.length > overCount ? `, ${triggered.length - overCount} near limit` : ''}`
              : `${triggered.length} near limit`}
          </p>
        </div>
        {expanded
          ? <ChevronUp size={15} className={`${theme.chevron} shrink-0`} />
          : <ChevronDown size={15} className={`${theme.chevron} shrink-0`} />}
      </button>

      {/* ── Alert rows ── */}
      {expanded && (
        <div className={`border-t ${theme.divider} px-4 py-3 flex flex-col gap-2`}>
          {triggered.map(({ budget, spent, percentUsed, status, crossedThresholds }) => {
            const isOver = status === 'over'
            return (
              <div
                key={budget.id}
                className={`rounded-lg px-3 py-2.5 ${isOver ? 'bg-red-100/60' : 'bg-amber-100/60'}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="pt-0.5 shrink-0">
                    {isOver
                      ? <XCircle size={14} className="text-red-500" />
                      : <AlertTriangle size={14} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Label + dollar amounts */}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {budget.label}
                      </span>
                      <span className="text-xs text-slate-600 shrink-0 font-medium whitespace-nowrap">
                        {formatCurrency(spent)}{' '}
                        <span className="font-normal text-slate-400">/ {formatCurrency(budget.amount)}</span>
                      </span>
                    </div>

                    {/* Who · category · thresholds crossed */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 truncate">
                        {personLabel(budget.personId)}
                        {' · '}
                        {budget.category ?? 'All Spending'}
                      </span>
                      <span className={`text-xs font-medium shrink-0 ${isOver ? 'text-red-700' : 'text-amber-700'}`}>
                        Passed {crossedThresholds.join('%, ')}%
                      </span>
                    </div>

                    {/* Compact progress bar */}
                    <div className="mt-1.5 h-1.5 bg-white/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* View all link */}
          <div className="text-right pt-1">
            <Link
              to="/app/budgets"
              className={`text-xs font-medium transition-colors ${theme.link}`}
            >
              View all budgets →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
