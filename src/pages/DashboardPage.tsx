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
import { Building2, CreditCard, DollarSign, List, TrendingUp, Upload } from 'lucide-react'
import { getItems, type PlaidItem } from '@/api/plaid'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { CATEGORY_COLORS } from '@/utils/categories'
import { formatCurrency } from '@/utils/formatters'
import { EXCLUDED_FROM_SPEND } from '@/lib/constants'
import EmptyState from '@/components/shared/EmptyState'
import type { Transaction } from '@/types'

const ACCOUNT_LOAD_TIMEOUT_MS = 2500

function getEffectiveAmount(
  t: Pick<Transaction, 'amount' | 'reimbursementStatus' | 'reimbursementAmount' | 'reimbursementPaid'>,
): number {
  if (t.reimbursementPaid) {
    const reimbursed = t.reimbursementStatus === 'full' ? t.amount : (t.reimbursementAmount ?? 0)
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
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)

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

  const connectedAccountCount = plaidItems.reduce((sum, item) => sum + item.accounts.length, 0)

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
                        fill={entry.name === 'Other' ? '#94a3b8' : (CATEGORY_COLORS[entry.name] ?? '#64748b')}
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
                      style={{ backgroundColor: entry.name === 'Other' ? '#94a3b8' : (CATEGORY_COLORS[entry.name] ?? '#64748b') }}
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
                to="/app/settings"
                className="inline-flex mt-3 text-xs font-medium text-accent-700 hover:text-accent-800"
              >
                Manage accounts
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="text-right">
        <Link to="/app/insights" className="text-sm font-medium text-accent-700 hover:text-accent-800">
          Open detailed Insights
        </Link>
      </div>
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
