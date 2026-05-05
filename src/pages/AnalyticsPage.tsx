import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from 'recharts'
import { TrendingUp, CreditCard, Users, DollarSign, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { formatCurrency } from '@/utils/formatters'
import { EXCLUDED_FROM_SPEND } from '@/lib/constants'
import EmptyState from '@/components/shared/EmptyState'
import DashboardFilters, {
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from '@/components/dashboard/DashboardFilters'
import CategoryDetailPanel from '@/components/dashboard/CategoryDetailPanel'
import { getPresetRange, type DateRange } from '@/utils/dateRanges'
import type { Transaction } from '@/types'

type MonthlyMode = 'total' | 'byCategory' | 'byPerson'

function getEffectiveAmount(
  t: Pick<Transaction, 'amount' | 'reimbursementStatus' | 'reimbursementAmount' | 'reimbursementPaid'>,
  includeReimb: boolean,
): number {
  // Already paid back — money returned, always reduce
  if (t.reimbursementPaid) {
    const reimbAmt = t.reimbursementStatus === 'settled' ? t.amount : (t.reimbursementAmount ?? 0)
    return Math.max(0, t.amount - reimbAmt)
  }
  // Toggle off = show adjusted/net spend
  if (!includeReimb) {
    if (t.reimbursementStatus === 'settled') return 0
    if (t.reimbursementStatus === 'partial') return Math.max(0, t.amount - (t.reimbursementAmount ?? 0))
  }
  return t.amount
}

export default function AnalyticsPage() {
  const { transactions, setFilters: setTxnFilters } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const categoryColors = useCategoryStore((s) => s.categoryColors)
  const navigate = useNavigate()

  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_DASHBOARD_FILTERS)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>('total')

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const personMap = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])

  // Resolved date range
  const dateRange: DateRange = useMemo(() => {
    if (filters.datePreset === 'custom') {
      return { start: filters.customStart, end: filters.customEnd }
    }
    if (filters.datePreset === 'allTime') {
      return { start: '', end: '' }
    }
    return getPresetRange(filters.datePreset)
  }, [filters.datePreset, filters.customStart, filters.customEnd])

  // Helper: does a transaction pass person/card/toggle filters (but not date)?
  const passesBaseFilters = useMemo(() => {
    const { selectedPersonIds, selectedCardIds, includeExpectedReturns, includePayments } = filters
    return (t: (typeof transactions)[number]) => {
      if (t.deleted) return false
      if (t.isBalancePayment) return false
      if (t.isPayment && !includePayments) return false
      if (t.isCredit && !includePayments) return false
      if (!includeExpectedReturns && t.expectingReturn) return false

      // Person filter
      if (selectedPersonIds.length > 0) {
        const card = cardMap.get(t.cardId)
        if (!card || !selectedPersonIds.includes(card.owner)) return false
      }
      // Card filter
      if (selectedCardIds.length > 0 && !selectedCardIds.includes(t.cardId)) return false

      return true
    }
  }, [filters, cardMap])

  // baseCharges: person/card/toggle filters, NO date filter (for trends & prev-period)
  const baseCharges = useMemo(
    () => transactions.filter(passesBaseFilters),
    [transactions, passesBaseFilters],
  )

  // displayCharges: all filters including date
  const displayCharges = useMemo(() => {
    const { start, end } = dateRange
    return baseCharges.filter((t) => {
      if (start && t.transDate < start) return false
      if (end && t.transDate > end) return false
      return true
    })
  }, [baseCharges, dateRange])

  // Charges only (no payments/credits/excluded categories) for spending stats
  const displaySpendCharges = useMemo(
    () => displayCharges.filter((t) => !t.isPayment && !t.isCredit && !EXCLUDED_FROM_SPEND.includes(t.category)),
    [displayCharges],
  )

  const totalSpend = useMemo(
    () => displaySpendCharges.reduce((s, t) => s + getEffectiveAmount(t, filters.includeReimb), 0),
    [displaySpendCharges, filters.includeReimb],
  )

  const avgTransaction = useMemo(
    () => (displaySpendCharges.length > 0 ? totalSpend / displaySpendCharges.length : 0),
    [totalSpend, displaySpendCharges],
  )

  const pendingReturnsTotal = useMemo(
    () =>
      displaySpendCharges
        .filter((t) => t.expectingReturn && t.returnStatus === 'pending')
        .reduce((s, t) => s + (t.expectedReturnAmount ?? t.amount), 0),
    [displaySpendCharges],
  )

  const netSpend = totalSpend - pendingReturnsTotal

  // Reimbursement stats
  const reimbOwed = useMemo(
    () =>
      displaySpendCharges
        .filter((t) => t.reimbursementStatus !== 'none' && !t.reimbursementPaid)
        .reduce((s, t) => s + (t.reimbursementStatus === 'settled' ? t.amount : (t.reimbursementAmount ?? 0)), 0),
    [displaySpendCharges],
  )

  const reimbReceived = useMemo(
    () =>
      displaySpendCharges
        .filter((t) => t.reimbursementPaid)
        .reduce((s, t) => s + (t.reimbursementStatus === 'settled' ? t.amount : (t.reimbursementAmount ?? 0)), 0),
    [displaySpendCharges],
  )

  // Spend by category
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of displaySpendCharges) {
      const amt = getEffectiveAmount(t, filters.includeReimb)
      if (amt <= 0) continue
      map.set(t.category, (map.get(t.category) ?? 0) + amt)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [displaySpendCharges, filters.includeReimb])

  // Monthly data (simple total)
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of displaySpendCharges) {
      const amt = getEffectiveAmount(t, filters.includeReimb)
      const key = t.transDate.slice(0, 7) // yyyy-MM
      map.set(key, (map.get(key) ?? 0) + amt)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => ({
        month: format(parseISO(key + '-01'), 'MMM yy'),
        amount: parseFloat(value.toFixed(2)),
      }))
  }, [displaySpendCharges, filters.includeReimb])

  // Monthly by category (stacked)
  const { monthlyCategoryData, topCategoryKeys } = useMemo(() => {
    // Determine top 7 categories by total in this period
    const catTotals = new Map<string, number>()
    for (const t of displaySpendCharges) {
      const amt = getEffectiveAmount(t, filters.includeReimb)
      catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + amt)
    }
    const topCats = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([cat]) => cat)

    // Build monthly rows
    const monthSet = new Set(displaySpendCharges.map((t) => t.transDate.slice(0, 7)))
    const months = Array.from(monthSet).sort().slice(-12)

    const data = months.map((key) => {
      const row: Record<string, string | number> = {
        month: format(parseISO(key + '-01'), 'MMM yy'),
      }
      let other = 0
      for (const t of displaySpendCharges) {
        if (!t.transDate.startsWith(key)) continue
        const amt = getEffectiveAmount(t, filters.includeReimb)
        if (topCats.includes(t.category)) {
          row[t.category] = parseFloat(
            (((row[t.category] as number) ?? 0) + amt).toFixed(2),
          )
        } else {
          other += amt
        }
      }
      if (other > 0.005) row['Other'] = parseFloat(other.toFixed(2))
      return row
    })

    const hasOther = data.some((r) => 'Other' in r)
    return {
      monthlyCategoryData: data,
      topCategoryKeys: hasOther ? [...topCats, 'Other'] : topCats,
    }
  }, [displaySpendCharges, filters.includeReimb])

  // Monthly by person (stacked)
  const { monthlyPersonData, personKeys } = useMemo(() => {
    const monthSet = new Set(displaySpendCharges.map((t) => t.transDate.slice(0, 7)))
    const months = Array.from(monthSet).sort().slice(-12)

    const data = months.map((key) => {
      const row: Record<string, string | number> = {
        month: format(parseISO(key + '-01'), 'MMM yy'),
      }
      for (const t of displaySpendCharges) {
        if (!t.transDate.startsWith(key)) continue
        const card = cardMap.get(t.cardId)
        const person = card ? personMap.get(card.owner) : undefined
        const name = person?.name ?? t.cardholderName ?? 'Unknown'
        const amt = getEffectiveAmount(t, filters.includeReimb)
        row[name] = parseFloat((((row[name] as number) ?? 0) + amt).toFixed(2))
      }
      return row
    })

    // Collect all person keys that appear in data
    const keys = new Set<string>()
    for (const row of data) {
      for (const k of Object.keys(row)) {
        if (k !== 'month') keys.add(k)
      }
    }
    // Sort by total desc
    const sortedKeys = Array.from(keys).sort((a, b) => {
      const aTotal = data.reduce((s, r) => s + ((r[a] as number) ?? 0), 0)
      const bTotal = data.reduce((s, r) => s + ((r[b] as number) ?? 0), 0)
      return bTotal - aTotal
    })

    return { monthlyPersonData: data, personKeys: sortedKeys }
  }, [displaySpendCharges, cardMap, personMap, filters.includeReimb])

  // Spend by person (pie)
  const personData = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of displaySpendCharges) {
      const card = cardMap.get(t.cardId)
      const person = card ? personMap.get(card.owner) : undefined
      const name = person?.name ?? t.cardholderName ?? 'Unknown'
      const amt = getEffectiveAmount(t, filters.includeReimb)
      map.set(name, (map.get(name) ?? 0) + amt)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [displaySpendCharges, cardMap, personMap, filters.includeReimb])

  // Spend by card
  const cardData = useMemo(() => {
    const map = new Map<string, { name: string; color: string; amount: number }>()
    for (const t of displaySpendCharges) {
      const card = cardMap.get(t.cardId)
      if (!card) continue
      const amt = getEffectiveAmount(t, filters.includeReimb)
      const ex = map.get(card.id)
      if (ex) ex.amount += amt
      else map.set(card.id, { name: card.name, color: card.color, amount: amt })
    }
    return Array.from(map.values())
      .map((c) => ({ ...c, amount: parseFloat(c.amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
  }, [displaySpendCharges, cardMap, filters.includeReimb])

  // Person comparison data
  const personComparisonData = useMemo(() => {
    if (persons.length < 2) return null
    const byPersonCat = new Map<string, Map<string, number>>()
    for (const t of displaySpendCharges) {
      const card = cardMap.get(t.cardId)
      const person = card ? personMap.get(card.owner) : undefined
      const name = person?.name ?? t.cardholderName ?? 'Unknown'
      const amt = getEffectiveAmount(t, filters.includeReimb)
      if (amt <= 0) continue
      if (!byPersonCat.has(name)) byPersonCat.set(name, new Map())
      const catMap = byPersonCat.get(name)!
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + amt)
    }
    const catTotals = new Map<string, number>()
    for (const catMap of byPersonCat.values())
      for (const [cat, amt] of catMap)
        catTotals.set(cat, (catTotals.get(cat) ?? 0) + amt)
    const topCats = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c)
    const personNames = Array.from(byPersonCat.keys())
    const data = topCats.map((cat) => {
      const row: Record<string, number | string> = { category: cat.length > 12 ? cat.slice(0, 12) + '\u2026' : cat }
      for (const name of personNames)
        row[name] = parseFloat((byPersonCat.get(name)?.get(cat) ?? 0).toFixed(2))
      return row
    })
    return { data, personNames }
  }, [displaySpendCharges, cardMap, personMap, persons, filters.includeReimb])

  // Shared vs personal data
  const sharedPersonalData = useMemo(() => {
    const sharedByPerson = new Map<string, number>()
    const personalByPerson = new Map<string, number>()
    let totalShared = 0
    for (const t of displaySpendCharges) {
      const card = cardMap.get(t.cardId)
      const person = card ? personMap.get(card.owner) : undefined
      const name = person?.name ?? t.cardholderName ?? 'Unknown'
      const amt = getEffectiveAmount(t, filters.includeReimb)
      if (t.spendType === 'shared') {
        totalShared += amt
        sharedByPerson.set(name, (sharedByPerson.get(name) ?? 0) + amt)
      } else if (t.spendType === 'personal') {
        personalByPerson.set(name, (personalByPerson.get(name) ?? 0) + amt)
      }
    }
    const eachShare = persons.length > 0 ? totalShared / persons.length : 0
    const balances = persons.map((p) => {
      const paid = sharedByPerson.get(p.name) ?? 0
      const net = paid - eachShare
      return { name: p.name, color: p.color, paid, personal: personalByPerson.get(p.name) ?? 0, net }
    })
    return { totalShared, eachShare, balances }
  }, [displaySpendCharges, cardMap, personMap, persons, filters.includeReimb])

  const hasSpendTypes = displaySpendCharges.some((t) => t.spendType)

  const handleViewInTransactions = (category: string) => {
    setTxnFilters({ categories: [category] })
    navigate('/app/transactions')
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No data yet"
        description="Upload transactions or connect your bank to get started."
        action={
          <Link
            to="/app/upload"
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700"
          >
            <Upload size={15} /> Upload Statement
          </Link>
        }
      />
    )
  }

  const monthlyChartData =
    monthlyMode === 'byCategory'
      ? monthlyCategoryData
      : monthlyMode === 'byPerson'
        ? monthlyPersonData
        : monthlyData

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Explore spending trends, categories, people, cards, and filters.</p>
      </div>

      {/* Filters */}
      <DashboardFilters
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        persons={persons}
        cards={cards}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Spend"
          value={formatCurrency(totalSpend)}
          icon={<DollarSign size={18} className="text-accent-600" />}
          color="bg-accent-50"
        />
        <StatCard
          label="Transactions"
          value={String(displaySpendCharges.length)}
          icon={<TrendingUp size={18} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Avg. Transaction"
          value={formatCurrency(avgTransaction)}
          icon={<CreditCard size={18} className="text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          label="Cards Active"
          value={String(cardData.length)}
          icon={<Users size={18} className="text-green-600" />}
          color="bg-green-50"
        />
      </div>

      {/* Refund exclusion note */}
      <p className="text-xs text-slate-400 -mt-2">Refunds & credits are excluded from totals.</p>

      {/* Pending returns row */}
      {pendingReturnsTotal > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <DollarSign size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-purple-600">Pending Returns</p>
              <p className="text-lg font-bold text-purple-800">{formatCurrency(pendingReturnsTotal)}</p>
              <p className="text-xs text-purple-400">Expected refunds not yet received</p>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              <DollarSign size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-teal-600">Net Spend</p>
              <p className="text-lg font-bold text-teal-800">{formatCurrency(netSpend)}</p>
              <p className="text-xs text-teal-400">Total spend minus pending returns</p>
            </div>
          </div>
        </div>
      )}

      {/* Reimbursement info cards */}
      {(reimbOwed > 0 || reimbReceived > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <DollarSign size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-600">Reimbursements Owed</p>
              <p className="text-lg font-bold text-orange-800">{formatCurrency(reimbOwed)}</p>
              <p className="text-xs text-orange-400">Awaiting payment from others</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <DollarSign size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600">Reimbursements Received</p>
              <p className="text-lg font-bold text-green-800">{formatCurrency(reimbReceived)}</p>
              <p className="text-xs text-green-400">Already paid back to you</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts row 1: Category + Monthly */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Spend by Category — clickable bars */}
        <ChartCard title="Spending by Category">
          {categoryData.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Upload transactions or connect your bank to get started.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ left: 16, right: 24, top: 4, bottom: 4 }}
                onClick={(e: any) => {
                  if (e?.activePayload?.[0]) {
                    const name = e.activePayload[0].payload?.name as string
                    setSelectedCategory((prev) => (prev === name ? null : name))
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <XAxis type="number" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Bar dataKey="value" name="Total Spend" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={categoryColors[entry.name] ?? '#94a3b8'}
                      opacity={selectedCategory && selectedCategory !== entry.name ? 0.4 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Monthly Spending — with mode toggle */}
        <ChartCard
          title="Monthly Spending"
          right={
            <div className="flex items-center gap-1">
              {(['total', 'byCategory', 'byPerson'] as MonthlyMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMonthlyMode(mode)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    monthlyMode === mode
                      ? 'bg-accent-600 text-white'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {mode === 'total' ? 'Total' : mode === 'byCategory' ? 'By Cat.' : 'By Person'}
                </button>
              ))}
            </div>
          }
        >
          {monthlyChartData.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Upload transactions or connect your bank to get started.
            </p>
          ) : monthlyMode === 'total' ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Bar dataKey="amount" name="Total Spend" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : monthlyMode === 'byCategory' ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyCategoryData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                {topCategoryKeys.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="cat"
                    fill={cat === 'Other' ? '#94a3b8' : (categoryColors[cat] ?? '#94a3b8')}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyPersonData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                {personKeys.map((name) => {
                  const person = persons.find((p) => p.name === name)
                  return (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="person"
                      fill={person?.color ?? '#64748b'}
                    />
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Category Detail Panel */}
      {selectedCategory && (
        <CategoryDetailPanel
          category={selectedCategory}
          displayCharges={displaySpendCharges}
          baseCharges={baseCharges.filter((t) => !t.isPayment && !t.isCredit)}
          datePreset={filters.datePreset}
          dateRange={dateRange}
          onClose={() => setSelectedCategory(null)}
          onViewInTransactions={() => handleViewInTransactions(selectedCategory)}
        />
      )}

      {/* Charts row 2: By Person + By Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {personData.length > 1 && (
          <ChartCard title="Spend by Person">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={personData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name ?? ''} ${(((percent as number | undefined) ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {personData.map((entry, i) => {
                    const person = persons.find((p) => p.name === entry.name)
                    return <Cell key={i} fill={person?.color ?? '#64748b'} />
                  })}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <ChartCard title="Spend by Card">
          {cardData.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Upload transactions or connect your bank to get started.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cardData} layout="vertical" margin={{ left: 16, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {cardData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Person Comparison */}
      {personComparisonData && (
        <ChartCard title="Spending Comparison">
          {personComparisonData.data.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-slate-400">
              Upload transactions or connect your bank to get started.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={personComparisonData.data}
                layout="vertical"
                margin={{ left: 16, right: 24, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                {personComparisonData.personNames.map((name) => {
                  const person = persons.find((p) => p.name === name)
                  return (
                    <Bar
                      key={name}
                      dataKey={name}
                      fill={person?.color ?? '#64748b'}
                      radius={[0, 3, 3, 0]}
                    />
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {/* Shared vs Personal */}
      {hasSpendTypes && (
        <ChartCard title="Shared vs Personal">
          <div className="flex flex-col gap-2 mb-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-slate-500">Total shared: </span>
              <span className="font-semibold text-slate-800">{formatCurrency(sharedPersonalData.totalShared)}</span>
            </div>
            <div>
              <span className="text-slate-500">Each share: </span>
              <span className="font-semibold text-slate-800">{formatCurrency(sharedPersonalData.eachShare)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
          <div className="min-w-[560px] divide-y divide-slate-100">
            <div className="grid grid-cols-4 gap-2 py-2 text-xs font-semibold text-slate-500">
              <span>Person</span>
              <span className="text-right">Shared Paid</span>
              <span className="text-right">Personal</span>
              <span className="text-right">Net Balance</span>
            </div>
            {sharedPersonalData.balances.map((b) => (
              <div key={b.name} className="grid grid-cols-4 gap-2 py-2.5 items-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="text-sm font-medium text-slate-800">{b.name}</span>
                </div>
                <span className="text-sm text-right text-slate-700">{formatCurrency(b.paid)}</span>
                <span className="text-sm text-right text-slate-700">{formatCurrency(b.personal)}</span>
                <span className={`text-sm font-semibold text-right ${b.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {b.net >= 0 ? '+' : ''}{formatCurrency(b.net)}
                </span>
              </div>
            ))}
          </div>
          </div>
        </ChartCard>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  children,
  right,
}: {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="min-w-0 bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}
