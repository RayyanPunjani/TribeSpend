import { useMemo, useState } from 'react'
import { AlertCircle, Upload, Plus, List, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTransactionStore, applyFilters } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import FilterBar from '@/components/transactions/FilterBar'
import TransactionRow from '@/components/transactions/TransactionRow'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import EmptyState from '@/components/shared/EmptyState'
import { formatCurrency } from '@/utils/formatters'
import type { Transaction } from '@/types'
import type { CreditCard, Person } from '@/types'

type SortKey = 'date' | 'postDate' | 'description' | 'category' | 'card' | 'person' | 'amount'
type SortDir = 'asc' | 'desc'

interface SortState {
  key: SortKey
  dir: SortDir
}

// Default direction when first clicking a column
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  date:        'desc',
  postDate:    'desc',
  description: 'asc',
  category:    'asc',
  card:        'asc',
  person:      'asc',
  amount:      'desc',
}

interface QuickSort { label: string; key: SortKey; dir: SortDir }
const QUICK_SORTS: QuickSort[] = [
  { label: 'Newest First',    key: 'date',        dir: 'desc' },
  { label: 'Oldest First',    key: 'date',        dir: 'asc'  },
  { label: 'Highest Amount',  key: 'amount',      dir: 'desc' },
  { label: 'Lowest Amount',   key: 'amount',      dir: 'asc'  },
  { label: 'By Merchant',     key: 'description', dir: 'asc'  },
  { label: 'By Category',     key: 'category',    dir: 'asc'  },
]

function sortTransactions(
  txns: Transaction[],
  sort: SortState,
  cardMap: Map<string, CreditCard>,
  personMap: Map<string, Person>,
): Transaction[] {
  const { key, dir } = sort
  const mul = dir === 'asc' ? 1 : -1

  return [...txns].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'date':
        cmp = a.transDate.localeCompare(b.transDate)
        break
      case 'postDate':
        cmp = a.postDate.localeCompare(b.postDate)
        break
      case 'description':
        cmp = (a.cleanDescription || a.description)
          .toLowerCase()
          .localeCompare((b.cleanDescription || b.description).toLowerCase())
        break
      case 'category':
        cmp = a.category.toLowerCase().localeCompare(b.category.toLowerCase())
        break
      case 'card': {
        const aName = cardMap.get(a.cardId)?.name ?? ''
        const bName = cardMap.get(b.cardId)?.name ?? ''
        cmp = aName.toLowerCase().localeCompare(bName.toLowerCase())
        break
      }
      case 'person': {
        const aCard = cardMap.get(a.cardId)
        const bCard = cardMap.get(b.cardId)
        const aName = aCard ? (personMap.get(aCard.owner)?.name ?? '') : ''
        const bName = bCard ? (personMap.get(bCard.owner)?.name ?? '') : ''
        cmp = aName.toLowerCase().localeCompare(bName.toLowerCase())
        break
      }
      case 'amount':
        cmp = a.amount - b.amount
        break
    }
    // Tie-break: newest date first
    if (cmp === 0) cmp = b.transDate.localeCompare(a.transDate)
    return cmp * mul
  })
}

export default function TransactionsPage() {
  const { transactions, filters, setFilters } = useTransactionStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const { cards } = useCardStore()
  const { persons } = usePersonStore()

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const personMap = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])

  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters])
  const sorted = useMemo(
    () => sortTransactions(filtered, sort, cardMap, personMap),
    [filtered, sort, cardMap, personMap],
  )

  const needsReviewCount = useMemo(
    () => transactions.filter((t) => t.category === 'Needs Review' && !t.isPayment).length,
    [transactions],
  )

  const { totalSpend, totalReimbursable } = useMemo(() => {
    let totalSpend = 0
    let totalReimbursable = 0
    for (const t of filtered) {
      if (!t.isPayment && !t.isCredit) {
        totalSpend += t.amount
        if (t.reimbursementStatus !== 'none' && !t.reimbursementPaid) {
          totalReimbursable +=
            t.reimbursementStatus === 'settled' ? t.amount : t.reimbursementAmount ?? 0
        }
      }
    }
    return { totalSpend, totalReimbursable }
  }, [filtered])

  const handleHeaderClick = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_DIR[key] },
    )
  }

  const isActive = (key: SortKey) => sort.key === key

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={List}
        title="No transactions yet"
        description="Upload your first credit card statement to see transactions here."
        action={
          <Link
            to="/app/upload"
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700"
          >
            <Upload size={15} />
            Upload Statement
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{filtered.length} transactions</span>
            <span className="font-semibold text-slate-800">{formatCurrency(totalSpend)}</span>
            {totalReimbursable > 0 && (
              <span className="text-orange-600">
                Owed: {formatCurrency(totalReimbursable)}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Needs Review banner */}
      {needsReviewCount > 0 && !filters.needsReviewOnly && (
        <button
          onClick={() => setFilters({ needsReviewOnly: true })}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors text-left"
        >
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700">
            <strong>{needsReviewCount} transaction{needsReviewCount > 1 ? 's' : ''}</strong> need
            a category — click here to review them
          </span>
        </button>
      )}

      <FilterBar />

      {/* Quick-sort presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 font-medium mr-1">Sort:</span>
        {QUICK_SORTS.map((qs) => {
          const active = sort.key === qs.key && sort.dir === qs.dir
          return (
            <button
              key={qs.label}
              onClick={() => setSort({ key: qs.key, dir: qs.dir })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? 'bg-accent-600 text-white border-accent-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {qs.dir === 'asc'
                ? <ArrowUp size={10} />
                : <ArrowDown size={10} />
              }
              {qs.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          No transactions match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <SortHeader label="Date"        colKey="date"        sort={sort} onClick={handleHeaderClick} />
                  <SortHeader label="Description" colKey="description" sort={sort} onClick={handleHeaderClick} />
                  <SortHeader label="Category"    colKey="category"    sort={sort} onClick={handleHeaderClick} />
                  <SortHeader label="Card"        colKey="card"        sort={sort} onClick={handleHeaderClick} />
                  <SortHeader label="Person"      colKey="person"      sort={sort} onClick={handleHeaderClick} />
                  <SortHeader label="Amount"      colKey="amount"      sort={sort} onClick={handleHeaderClick} align="right" />
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const card = cardMap.get(t.cardId)
                  const person = card ? personMap.get(card.owner) : undefined
                  return (
                    <TransactionRow
                      key={t.id}
                      transaction={t}
                      card={card}
                      person={person}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}

// ── Sort header cell ──────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string
  colKey: SortKey
  sort: SortState
  onClick: (key: SortKey) => void
  align?: 'left' | 'right'
}

function SortHeader({ label, colKey, sort, onClick, align = 'left' }: SortHeaderProps) {
  const active = sort.key === colKey
  const Icon = active
    ? sort.dir === 'asc' ? ArrowUp : ArrowDown
    : ArrowUpDown

  return (
    <th
      className={`px-4 py-3 text-xs font-semibold cursor-pointer select-none whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${active ? 'text-accent-600' : 'text-slate-500 hover:text-slate-700'}`}
      onClick={() => onClick(colKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <Icon
          size={11}
          className={active ? 'text-accent-500' : 'text-slate-300'}
        />
      </span>
    </th>
  )
}
