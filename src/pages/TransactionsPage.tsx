import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Upload,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  DollarSign,
  EyeOff,
  PackageOpen,
  RefreshCw,
  StickyNote,
  Undo2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTransactionStore, applyFilters } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useSampleTransactionStore, type SampleFlag } from '@/stores/sampleTransactionStore'
import FilterBar from '@/components/transactions/FilterBar'
import TransactionRow from '@/components/transactions/TransactionRow'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
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
  const [sampleEditingNote, setSampleEditingNote] = useState<string | null>(null)
  const sampleTransactions = useSampleTransactionStore((state) => state.transactions)
  const sampleFlags = useSampleTransactionStore((state) => state.flags)
  const sampleNotes = useSampleTransactionStore((state) => state.notes)
  const toggleSampleFlag = useSampleTransactionStore((state) => state.toggleFlag)
  const setSampleNote = useSampleTransactionStore((state) => state.setNote)
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
    () => transactions.filter((t) => t.category === 'Needs Review' && !t.isPayment && !t.deleted).length,
    [transactions],
  )

  const { totalSpend, totalReimbursable } = useMemo(() => {
    let totalSpend = 0
    let totalReimbursable = 0
    for (const t of filtered) {
      if (t.deleted) continue
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
      <div className="flex flex-col gap-4 max-w-full">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
            <p className="text-sm text-slate-500 mt-1">Example transactions you can explore before importing your own data.</p>
          </div>
          <Link
            to="/app/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700"
          >
            <Upload size={15} />
            Upload CSV
          </Link>
        </div>

        <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3">
          <p className="text-sm font-semibold text-accent-900">Example data</p>
          <p className="mt-1 text-sm text-accent-700">
            Example transactions are for practice and will disappear once you upload or sync your first real transactions.
            Try the row actions below. These interactions are UI-only and are not saved.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Card</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Person</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sampleTransactions.map((sample) => {
                  const flags = sampleFlags[sample.id] ?? {}
                  const note = sampleNotes[sample.id] ?? ''
                  const toggleFlag = (flag: SampleFlag) => {
                    toggleSampleFlag(sample.id, flag)
                    if (flag === 'notes') {
                      setSampleEditingNote((current) => current === sample.id ? null : sample.id)
                    }
                  }

                  return (
                    <tr
                      key={sample.id}
                      className={`border-b border-slate-100 bg-accent-50/60 transition-all ${flags.hidden ? 'opacity-45 grayscale' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-slate-800">{sample.date}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Purchased</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          {flags.return && <PackageOpen size={13} className="mt-0.5 shrink-0 text-purple-500" />}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-800 truncate">{sample.merchant}</p>
                              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                example
                              </span>
                              {flags.recurring && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  Recurring
                                </span>
                              )}
                              {flags.reimbursement && (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                  Reimbursable
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{sample.description}</p>
                            {note && (
                              <p className="mt-1 text-xs text-accent-700">
                                Note: {note}
                              </p>
                            )}
                            {sampleEditingNote === sample.id && (
                              <div className="mt-2 flex max-w-sm gap-2">
                                <input
                                  value={note}
                                  onChange={(e) => setSampleNote(sample.id, e.target.value)}
                                  placeholder="Add a sample note..."
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
                                />
                                <button
                                  onClick={() => setSampleEditingNote(null)}
                                  className="rounded-lg bg-accent-600 px-2 py-1 text-xs font-medium text-white"
                                >
                                  Done
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          {sample.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{sample.card}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{sample.person}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                        {formatCurrency(sample.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <SampleAction active={flags.reimbursement === true} label="Reimbursement" onClick={() => toggleFlag('reimbursement')}>
                            <DollarSign size={14} />
                          </SampleAction>
                          <SampleAction active={flags.return === true} label="Return / refund" onClick={() => toggleFlag('return')}>
                            <PackageOpen size={14} />
                          </SampleAction>
                          <SampleAction active={flags.recurring === true} label="Recurring" onClick={() => toggleFlag('recurring')}>
                            <RefreshCw size={14} />
                          </SampleAction>
                          <SampleAction active={sampleEditingNote === sample.id || !!note} label="Notes" onClick={() => toggleFlag('notes')}>
                            <StickyNote size={14} />
                          </SampleAction>
                          <SampleAction active={flags.hidden === true} label={flags.hidden ? 'Unhide' : 'Hide'} onClick={() => toggleFlag('hidden')}>
                            {flags.hidden ? <Undo2 size={14} /> : <EyeOff size={14} />}
                          </SampleAction>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

function SampleAction({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`rounded-lg p-1.5 transition-colors ${
        active
          ? 'bg-accent-100 text-accent-700'
          : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
      }`}
      aria-label={label}
    >
      {children}
    </button>
  )
}
