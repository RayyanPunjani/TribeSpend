import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { X, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { subMonths, format } from 'date-fns'
import { Link } from 'react-router-dom'
import type { Transaction } from '@/types'
import { CATEGORY_COLORS } from '@/utils/categories'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { getPreviousPeriodRange, type DatePreset, type DateRange } from '@/utils/dateRanges'

interface Props {
  category: string
  /** Transactions already filtered by all dashboard filters (date + person + card + toggles) */
  displayCharges: Transaction[]
  /** Transactions filtered by person/card/toggles but NOT by date — used for 12-month trend */
  baseCharges: Transaction[]
  datePreset: DatePreset
  dateRange: DateRange
  onClose: () => void
  onViewInTransactions: () => void
}

export default function CategoryDetailPanel({
  category,
  displayCharges,
  baseCharges,
  datePreset,
  dateRange,
  onClose,
  onViewInTransactions,
}: Props) {
  const color = CATEGORY_COLORS[category] ?? '#94a3b8'

  // Transactions in this category for the current period
  const catCharges = useMemo(
    () => displayCharges.filter((t) => t.category === category && !t.isCredit),
    [displayCharges, category],
  )

  const currentTotal = useMemo(
    () => catCharges.reduce((s, t) => s + t.amount, 0),
    [catCharges],
  )

  // Previous period comparison
  const prevRange = useMemo(() => getPreviousPeriodRange(datePreset), [datePreset])

  const prevTotal = useMemo(() => {
    if (!prevRange || !prevRange.start) return null
    return baseCharges
      .filter(
        (t) =>
          t.category === category &&
          !t.isCredit &&
          t.transDate >= prevRange.start &&
          t.transDate <= prevRange.end,
      )
      .reduce((s, t) => s + t.amount, 0)
  }, [baseCharges, category, prevRange])

  const pctChange = useMemo(() => {
    if (prevTotal === null || prevTotal === 0) return null
    return ((currentTotal - prevTotal) / prevTotal) * 100
  }, [currentTotal, prevTotal])

  // 12-month trend (always shows last 12 calendar months)
  const trendData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i)
      const key = format(d, 'yyyy-MM')
      const amount = baseCharges
        .filter((t) => t.category === category && !t.isCredit && t.transDate.startsWith(key))
        .reduce((s, t) => s + t.amount, 0)
      return { month: format(d, 'MMM yy'), amount: parseFloat(amount.toFixed(2)) }
    })
  }, [baseCharges, category])

  // Top merchants
  const topMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number; category: string }>()
    for (const t of catCharges) {
      const key = t.cleanDescription || t.description
      const ex = map.get(key)
      if (ex) {
        ex.total += t.amount
        ex.count++
      } else {
        map.set(key, { total: t.amount, count: 1, category: t.category })
      }
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [catCharges])

  // Recent transactions, newest first, up to 8
  const recentTransactions = useMemo(
    () =>
      [...catCharges]
        .sort((a, b) => b.transDate.localeCompare(a.transDate))
        .slice(0, 8),
    [catCharges],
  )

  const PctIcon =
    pctChange === null ? Minus : pctChange > 0 ? ArrowUpRight : ArrowDownRight
  const pctColor =
    pctChange === null
      ? 'text-slate-400'
      : pctChange > 0
        ? 'text-red-500'
        : 'text-green-600'

  return (
    <div className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: color + '44' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ backgroundColor: color + '14' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-slate-800">{category}</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onViewInTransactions}
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color }}
          >
            View in Transactions →
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* Period stats */}
        <div className="flex items-end gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">
              {dateRange.start
                ? `${formatDate(dateRange.start, 'MMM d')} – ${dateRange.end ? formatDate(dateRange.end, 'MMM d, yyyy') : 'today'}`
                : 'All time'}
            </p>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(currentTotal)}</p>
            <p className="text-xs text-slate-400">{catCharges.length} transaction{catCharges.length !== 1 ? 's' : ''}</p>
          </div>
          {prevTotal !== null && prevTotal > 0 && (
            <div className="flex items-center gap-3 pb-1">
              <div className="text-slate-300 text-xs">vs prev. period</div>
              <div className="text-sm font-medium text-slate-500">{formatCurrency(prevTotal)}</div>
              {pctChange !== null && (
                <div className={`flex items-center gap-0.5 text-sm font-semibold ${pctColor}`}>
                  <PctIcon size={14} />
                  {Math.abs(pctChange).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trend + Merchants grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 12-month trend */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">12-Month Trend</p>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={trendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={1} />
                <YAxis
                  tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                  tick={{ fontSize: 9 }}
                  width={32}
                />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: color }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top merchants */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Top Merchants</p>
            {topMerchants.length === 0 ? (
              <p className="text-xs text-slate-400">No data</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topMerchants.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.count} transaction{m.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 shrink-0">
                      {formatCurrency(m.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transaction list */}
        {recentTransactions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">
              Transactions in Period
              {catCharges.length > 8 && (
                <span className="font-normal text-slate-400"> (showing newest 8 of {catCharges.length})</span>
              )}
            </p>
            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Merchant</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-400">{t.transDate}</td>
                      <td className="px-3 py-1.5 text-slate-700 max-w-xs truncate">
                        {t.cleanDescription || t.description}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
