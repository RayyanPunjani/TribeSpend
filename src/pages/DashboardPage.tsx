import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Building2, ChevronDown, ChevronUp, CreditCard, DollarSign, List, TrendingUp, Upload, X } from 'lucide-react'
import { getItems, type PlaidItem } from '@/api/plaid'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { formatCurrency } from '@/utils/formatters'
import { EXCLUDED_FROM_SPEND } from '@/lib/constants'
import EmptyState from '@/components/shared/EmptyState'
import BudgetAlerts from '@/components/dashboard/BudgetAlerts'
import type { CardCredit, Transaction } from '@/types'

const ACCOUNT_LOAD_TIMEOUT_MS = 2500

const EXPIRY_THRESHOLD: Record<CardCredit['frequency'], number> = {
  monthly: 7,
  quarterly: 14,
  'semi-annual': 21,
  annual: 30,
}

function getPeriodInfo(frequency: CardCredit['frequency'], now: Date) {
  const y = now.getFullYear()
  const m = now.getMonth()
  let start: Date, end: Date, key: string, label: string

  if (frequency === 'monthly') {
    start = new Date(y, m, 1)
    end = new Date(y, m + 1, 0)
    key = `${y}-${String(m + 1).padStart(2, '0')}`
    label = format(start, 'MMM yyyy')
  } else if (frequency === 'quarterly') {
    const q = Math.floor(m / 3)
    start = new Date(y, q * 3, 1)
    end = new Date(y, q * 3 + 3, 0)
    key = `${y}-Q${q + 1}`
    label = `Q${q + 1} ${y}`
  } else if (frequency === 'semi-annual') {
    const half = m < 6 ? 0 : 1
    start = new Date(y, half * 6, 1)
    end = new Date(y, half * 6 + 6, 0)
    key = `${y}-H${half + 1}`
    label = `H${half + 1} ${y}`
  } else {
    start = new Date(y, 0, 1)
    end = new Date(y + 1, 0, 0)
    key = `${y}`
    label = `${y}`
  }

  const msPerDay = 86_400_000
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / msPerDay)
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')
  return { startStr, endStr, key, label, daysLeft }
}

function getEffectiveAmount(
  t: Pick<Transaction, 'amount' | 'reimbursementStatus' | 'reimbursementAmount' | 'reimbursementPaid'>,
): number {
  if (t.reimbursementPaid) {
    const reimbursed = t.reimbursementStatus === 'settled' ? t.amount : (t.reimbursementAmount ?? 0)
    return Math.max(0, t.amount - reimbursed)
  }
  return t.amount
}

function isSpendTransaction(t: Transaction): boolean {
  return !t.deleted
    && !t.isPayment
    && !t.isCredit
    && !t.isBalancePayment
    && !EXCLUDED_FROM_SPEND.includes(t.category)
}

function shortMoney(value: number): string {
  if (value >= 1000) return `$${Math.round(value / 1000)}k`
  return `$${Math.round(value)}`
}

async function loadPlaidItemsWithTimeout(): Promise<PlaidItem[]> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<PlaidItem[]>((resolve) => {
    timeoutId = setTimeout(() => resolve([]), ACCOUNT_LOAD_TIMEOUT_MS)
  })

  try {
    return await Promise.race([getItems(), timeout])
  } catch {
    return []
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export default function DashboardPage() {
  const { transactions } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const { credits } = useCardCreditStore()
  const categoryColors = useCategoryStore((s) => s.categoryColors)
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [dismissedCredits, setDismissedCredits] = useState<Set<string>>(new Set())
  const [creditsExpanded, setCreditsExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadPlaidItemsWithTimeout()
      .then((items) => {
        if (!cancelled) setPlaidItems(items)
      })
      .finally(() => {
        if (!cancelled) setAccountsLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const personMap = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons])

  const spendTransactions = useMemo(
    () => transactions.filter(isSpendTransaction),
    [transactions],
  )

  const latestSpendDate = useMemo(() => {
    const latest = spendTransactions.reduce<string | null>((max, transaction) => {
      if (!max || transaction.transDate > max) return transaction.transDate
      return max
    }, null)
    return latest ? parseISO(latest) : new Date()
  }, [spendTransactions])

  const monthKeys = useMemo(() => {
    const start = addMonths(new Date(latestSpendDate.getFullYear(), latestSpendDate.getMonth(), 1), -5)
    return Array.from({ length: 6 }, (_, index) => {
      const month = addMonths(start, index)
      return {
        key: format(month, 'yyyy-MM'),
        label: format(month, 'MMM'),
      }
    })
  }, [latestSpendDate])

  const overviewTransactions = useMemo(() => {
    const allowedMonths = new Set(monthKeys.map((month) => month.key))
    return spendTransactions.filter((transaction) => allowedMonths.has(transaction.transDate.slice(0, 7)))
  }, [spendTransactions, monthKeys])

  const totalSpend = useMemo(
    () => overviewTransactions.reduce((sum, transaction) => sum + getEffectiveAmount(transaction), 0),
    [overviewTransactions],
  )

  const activeCards = useMemo(
    () => new Set(overviewTransactions.map((transaction) => transaction.cardId)).size,
    [overviewTransactions],
  )

  const monthlyData = useMemo(() => {
    const totals = new Map(monthKeys.map((month) => [month.key, 0]))
    for (const transaction of overviewTransactions) {
      const month = transaction.transDate.slice(0, 7)
      totals.set(month, (totals.get(month) ?? 0) + getEffectiveAmount(transaction))
    }

    return monthKeys.map((month) => ({
      month: month.label,
      amount: Number((totals.get(month.key) ?? 0).toFixed(2)),
    }))
  }, [monthKeys, overviewTransactions])

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of overviewTransactions) {
      const amount = getEffectiveAmount(transaction)
      if (amount <= 0) continue
      totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + amount)
    }

    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5)
    const other = sorted.slice(5).reduce((sum, [, value]) => sum + value, 0)
    const rows = top.map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    if (other > 0.005) rows.push({ name: 'Other', value: Number(other.toFixed(2)) })
    return rows
  }, [overviewTransactions])

  const recentTransactions = useMemo(
    () => [...spendTransactions]
      .sort((a, b) => b.transDate.localeCompare(a.transDate))
      .slice(0, 6),
    [spendTransactions],
  )

  const topMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number; category: string }>()
    for (const transaction of overviewTransactions) {
      const amount = getEffectiveAmount(transaction)
      if (amount <= 0) continue
      const key = transaction.cleanDescription || transaction.description
      const existing = map.get(key)
      if (existing) {
        existing.total += amount
        existing.count += 1
      } else {
        map.set(key, { total: amount, count: 1, category: transaction.category })
      }
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, total: Number(data.total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [overviewTransactions])

  const connectedAccountCount = plaidItems.reduce((sum, item) => sum + item.accounts.length, 0)

  const expiringCredits = useMemo(() => {
    const now = new Date()
    return credits.flatMap((credit) => {
      const card = cardMap.get(credit.cardId)
      if (!card) return []
      const period = getPeriodInfo(credit.frequency, now)
      if (period.daysLeft > EXPIRY_THRESHOLD[credit.frequency] || period.daysLeft < 0) return []
      const dismissKey = `${credit.id}_${period.key}`
      if (dismissedCredits.has(dismissKey)) return []
      return [{ credit, card, period, dismissKey }]
    })
  }, [credits, cardMap, dismissedCredits])

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No data yet"
        description="Upload your first statement to see your spending overview."
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

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">A quick view of recent spending, categories, transactions, and accounts.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Last 6 Months"
          value={formatCurrency(totalSpend)}
          icon={<DollarSign size={18} className="text-accent-600" />}
          color="bg-accent-50"
        />
        <StatCard
          label="Transactions"
          value={String(overviewTransactions.length)}
          icon={<List size={18} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Avg. Transaction"
          value={formatCurrency(overviewTransactions.length ? totalSpend / overviewTransactions.length : 0)}
          icon={<TrendingUp size={18} className="text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          label="Active Cards"
          value={String(activeCards)}
          icon={<CreditCard size={18} className="text-green-600" />}
          color="bg-green-50"
        />
      </div>

      <BudgetAlerts selectedPersonIds={[]} />

      {expiringCredits.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCreditsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-800">
                {expiringCredits.length} credit{expiringCredits.length !== 1 ? 's' : ''} expiring soon —{' '}
                {formatCurrency(expiringCredits.reduce((s, e) => s + e.credit.amount, 0))} unused
              </p>
            </div>
            {creditsExpanded
              ? <ChevronUp size={15} className="text-amber-500 shrink-0" />
              : <ChevronDown size={15} className="text-amber-500 shrink-0" />}
          </button>
          {creditsExpanded && (
            <div className="border-t border-amber-200 px-4 py-3 flex flex-col gap-2">
              {expiringCredits.map(({ credit, card, period, dismissKey }) => (
                <div key={dismissKey} className="flex items-center gap-3 bg-amber-100/70 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 truncate">
                      {credit.name} <span className="font-normal text-amber-700">· {card.name}</span>
                    </p>
                    <p className="text-xs text-amber-600">
                      ${credit.amount} {period.label} · {period.daysLeft} day{period.daysLeft !== 1 ? 's' : ''} left
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDismissedCredits((prev) => new Set([...prev, dismissKey])) }}
                    className="text-amber-400 hover:text-amber-600 shrink-0 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Spending Over Time" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyData} margin={{ left: 8, right: 12, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value: number) => shortMoney(value)} tick={{ fontSize: 11 }} width={44} />
              <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#spendGradient)"
                dot={{ r: 3, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Spending by Category" subtitle="Top categories">
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">No spending data for this period.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {categoryData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.name === 'Other' ? '#94a3b8' : (categoryColors[entry.name] ?? '#64748b')}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {categoryData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.name === 'Other' ? '#94a3b8' : (categoryColors[entry.name] ?? '#64748b') }}
                    />
                    <span className="flex-1 min-w-0 truncate text-slate-700">{entry.name}</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Recent Transactions</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest spending activity</p>
            </div>
            <Link to="/app/transactions" className="text-xs font-medium text-accent-700 hover:text-accent-800">
              View all
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No recent spending transactions.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((transaction) => {
                const card = cardMap.get(transaction.cardId)
                const person = card ? personMap.get(card.owner) : undefined
                return (
                  <div key={transaction.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <CreditCard size={15} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {transaction.cleanDescription || transaction.description}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {format(parseISO(transaction.transDate), 'MMM d')} · {transaction.category}
                        {card ? ` · ${card.name}` : ''}
                        {person ? ` · ${person.name}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 shrink-0">
                      {formatCurrency(getEffectiveAmount(transaction))}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Connected Accounts</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {accountsLoaded ? `${connectedAccountCount} synced account${connectedAccountCount === 1 ? '' : 's'}` : 'Checking connections...'}
              </p>
            </div>
          </div>

          {plaidItems.length > 0 ? (
            <div className="space-y-2">
              {plaidItems.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {item.institutionName || 'Connected institution'}
                    </p>
                    <span className="text-[11px] font-medium text-teal-700 bg-teal-50 rounded-full px-2 py-0.5">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {item.accounts.length} account{item.accounts.length === 1 ? '' : 's'}
                    {item.lastSyncedAt ? ` · synced ${format(parseISO(item.lastSyncedAt), 'MMM d')}` : ''}
                  </p>
                </div>
              ))}
              {plaidItems.length > 4 && (
                <p className="text-xs text-slate-400 px-1">+{plaidItems.length - 4} more institutions</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center">
              <p className="text-sm font-medium text-slate-700">No connected bank accounts</p>
              <p className="text-xs text-slate-400 mt-1">Premium bank sync connections will appear here.</p>
              <Link
                to="/app/wallet"
                className="inline-flex mt-3 text-xs font-medium text-accent-700 hover:text-accent-800"
              >
                Manage accounts
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="text-right">
        <Link to="/app/analytics" className="text-sm font-medium text-accent-700 hover:text-accent-800">
          Open detailed Analytics
        </Link>
      </div>

      <ChartCard title="Top Merchants" subtitle="Last 6 months">
        {topMerchants.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No merchant data for this period.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topMerchants.map((merchant, index) => (
              <div key={merchant.name} className="flex items-center gap-3 py-2.5">
                <span className="text-xs font-bold text-slate-400 w-5 text-right shrink-0">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{merchant.name}</p>
                  <p className="text-xs text-slate-400">
                    {merchant.count} transaction{merchant.count > 1 ? 's' : ''}
                    <span
                      className="ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (categoryColors[merchant.category] ?? '#94a3b8') + '22',
                        color: categoryColors[merchant.category] ?? '#64748b',
                      }}
                    >
                      {merchant.category}
                    </span>
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-700 shrink-0">
                  {formatCurrency(merchant.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string
  value: string
  icon: ReactNode
  color: string
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
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 min-w-0">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}
