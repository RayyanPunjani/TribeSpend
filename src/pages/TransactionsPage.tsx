import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTransactionStore, applyFilters } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import {
  isSampleTransactionId,
  useSampleTransactionStore,
  type SampleReimbursementDetails,
  type SampleReturnDetails,
  type SampleReturnStatus,
} from '@/stores/sampleTransactionStore'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const [sampleEditingNote, setSampleEditingNote] = useState<string | null>(null)
  const [samplePopover, setSamplePopover] = useState<{ id: string; type: 'reimbursement' | 'return' } | null>(null)
  const sampleTransactions = useSampleTransactionStore((state) => state.transactions)
  const sampleFlags = useSampleTransactionStore((state) => state.flags)
  const sampleNotes = useSampleTransactionStore((state) => state.notes)
  const sampleReimbursements = useSampleTransactionStore((state) => state.reimbursements)
  const sampleReturns = useSampleTransactionStore((state) => state.returns)
  const toggleSampleRecurring = useSampleTransactionStore((state) => state.toggleRecurring)
  const toggleSampleHidden = useSampleTransactionStore((state) => state.toggleHidden)
  const setSampleNote = useSampleTransactionStore((state) => state.setNote)
  const setSampleReimbursement = useSampleTransactionStore((state) => state.setReimbursement)
  const clearSampleReimbursement = useSampleTransactionStore((state) => state.clearReimbursement)
  const setSampleReturn = useSampleTransactionStore((state) => state.setReturn)
  const clearSampleReturn = useSampleTransactionStore((state) => state.clearReturn)
  const { cards } = useCardStore()
  const { persons } = usePersonStore()

  useEffect(() => {
    if (searchParams.get('action') !== 'add') return
    setShowAddModal(true)
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

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
            <p className="text-sm text-slate-500 mt-1">No transactions yet. Add one manually or import a CSV to get started.</p>
          </div>
          <HeaderActions onAdd={() => setShowAddModal(true)} addLabel="Add your first transaction" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-lg font-semibold text-slate-800">No transactions yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Upload a statement for free, or add a transaction manually to try your first real entry.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Or upgrade to automatically sync your transactions by connecting your bank.
          </p>
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
                  const reimbursement = sampleReimbursements[sample.id]
                  const returnDetails = sampleReturns[sample.id]
                  const isSample = isSampleTransactionId(sample.id)

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
                                  {reimbursement?.paid ? 'Paid back' : `Owed by ${reimbursement?.person ?? 'someone'}`}
                                </span>
                              )}
                              {returnDetails && (
                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                  {returnDetails.status === 'completed'
                                    ? 'Return received'
                                    : returnDetails.status === 'review'
                                    ? 'Needs match'
                                    : 'Return expected'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{sample.description}</p>
                            {reimbursement?.note && (
                              <p className="mt-1 text-xs text-orange-700">
                                Reimbursement note: {reimbursement.note}
                              </p>
                            )}
                            {returnDetails?.note && (
                              <p className="mt-1 text-xs text-purple-700">
                                Return note: {returnDetails.note}
                              </p>
                            )}
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
                          <SampleAction
                            active={flags.reimbursement === true}
                            label="Reimbursement"
                            onClick={() => {
                              if (isSample) setSamplePopover({ id: sample.id, type: 'reimbursement' })
                            }}
                          >
                            <DollarSign size={14} />
                          </SampleAction>
                          <SampleAction
                            active={flags.return === true}
                            label="Return / refund"
                            onClick={() => {
                              if (isSample) setSamplePopover({ id: sample.id, type: 'return' })
                            }}
                          >
                            <PackageOpen size={14} />
                          </SampleAction>
                          <SampleAction
                            active={flags.recurring === true}
                            label={flags.recurring ? 'Not recurring' : 'Recurring'}
                            onClick={() => {
                              if (isSample) toggleSampleRecurring(sample.id)
                            }}
                          >
                            <RefreshCw size={14} />
                          </SampleAction>
                          <SampleAction
                            active={sampleEditingNote === sample.id || !!note}
                            label="Notes"
                            onClick={() => {
                              if (isSample) setSampleEditingNote((current) => current === sample.id ? null : sample.id)
                            }}
                          >
                            <StickyNote size={14} />
                          </SampleAction>
                          <SampleAction
                            active={flags.hidden === true}
                            label={flags.hidden ? 'Unhide' : 'Hide'}
                            onClick={() => {
                              if (isSample) toggleSampleHidden(sample.id)
                            }}
                          >
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
        {samplePopover?.type === 'reimbursement' && (
          <SampleReimbursementModal
            transaction={sampleTransactions.find((sample) => sample.id === samplePopover.id)}
            details={sampleReimbursements[samplePopover.id]}
            onClose={() => setSamplePopover(null)}
            onSave={(details) => {
              if (isSampleTransactionId(samplePopover.id)) setSampleReimbursement(samplePopover.id, details)
              setSamplePopover(null)
            }}
            onClear={() => {
              if (isSampleTransactionId(samplePopover.id)) clearSampleReimbursement(samplePopover.id)
              setSamplePopover(null)
            }}
          />
        )}
        {samplePopover?.type === 'return' && (
          <SampleReturnModal
            transaction={sampleTransactions.find((sample) => sample.id === samplePopover.id)}
            details={sampleReturns[samplePopover.id]}
            onClose={() => setSamplePopover(null)}
            onSave={(details) => {
              if (isSampleTransactionId(samplePopover.id)) setSampleReturn(samplePopover.id, details)
              setSamplePopover(null)
            }}
            onClear={() => {
              if (isSampleTransactionId(samplePopover.id)) clearSampleReturn(samplePopover.id)
              setSamplePopover(null)
            }}
          />
        )}
        {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}
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
          <HeaderActions onAdd={() => setShowAddModal(true)} />
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

function SampleReimbursementModal({
  transaction,
  details,
  onClose,
  onSave,
  onClear,
}: {
  transaction?: { amount: number; merchant: string }
  details?: SampleReimbursementDetails
  onClose: () => void
  onSave: (details: SampleReimbursementDetails) => void
  onClear: () => void
}) {
  const [person, setPerson] = useState(details?.person ?? 'Nada')
  const [amount, setAmount] = useState(String(details?.amount ?? ((transaction?.amount ?? 0) / 2)))
  const [note, setNote] = useState(details?.note ?? '')
  const [paid, setPaid] = useState(details?.paid ?? false)

  if (!transaction) return null

  return (
    <SampleModalShell title="Sample reimbursement" onClose={onClose}>
      <p className="text-xs text-slate-500">
        This practices the real reimbursement flow for {transaction.merchant}. Nothing is saved to Supabase.
      </p>
      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Who owes you?</span>
        <select
          value={person}
          onChange={(event) => setPerson(event.target.value)}
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
        >
          <option value="Nada">Nada</option>
          <option value="Rayyan">Rayyan</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Reimbursable amount ($)</span>
        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          step="0.01"
          min="0"
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </label>
      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g., split dinner"
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={paid}
          onChange={(event) => setPaid(event.target.checked)}
          className="rounded border-slate-300 text-accent-600 focus:ring-accent-500"
        />
        <span className="text-xs text-slate-600">Already paid back</span>
      </label>
      <div className="flex items-center gap-2 pt-1">
        {details && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-red-500 hover:text-red-600">
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => onSave({
            person,
            amount: parseFloat(amount) || transaction.amount / 2,
            note,
            paid,
          })}
          className="flex-1 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700"
        >
          Save sample
        </button>
      </div>
    </SampleModalShell>
  )
}

function SampleReturnModal({
  transaction,
  details,
  onClose,
  onSave,
  onClear,
}: {
  transaction?: { amount: number; merchant: string }
  details?: SampleReturnDetails
  onClose: () => void
  onSave: (details: SampleReturnDetails) => void
  onClear: () => void
}) {
  const [amount, setAmount] = useState(String(details?.amount ?? transaction?.amount ?? 0))
  const [note, setNote] = useState(details?.note ?? '')
  const [status, setStatus] = useState<SampleReturnStatus>(details?.status ?? 'expected')

  if (!transaction) return null

  return (
    <SampleModalShell title="Sample return / refund" onClose={onClose}>
      <p className="text-xs text-slate-500">
        This practices the real return flow for {transaction.merchant}. Nothing is saved to Supabase.
      </p>
      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Expected refund amount ($)</span>
        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          step="0.01"
          min="0"
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </label>
      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Note / reason (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g., Returned after drop-off"
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </label>
      <div>
        <span className="block text-xs text-slate-500 mb-1">Sample state</span>
        <div className="grid grid-cols-3 gap-1">
          {([
            ['expected', 'Expected'],
            ['review', 'Review'],
            ['completed', 'Received'],
          ] as Array<[SampleReturnStatus, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                status === value
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {details && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-red-500 hover:text-red-600">
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => onSave({
            amount: parseFloat(amount) || transaction.amount,
            note,
            status,
          })}
          className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"
        >
          Save sample
        </button>
      </div>
    </SampleModalShell>
  )
}

function SampleModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {children}
        </div>
      </div>
    </div>
  )
}

function HeaderActions({
  onAdd,
  addLabel = '+ Add Transaction',
}: {
  onAdd: () => void
  addLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700"
      >
        <Plus size={15} />
        {addLabel}
      </button>
      <Link
        to="/app/upload"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Upload size={15} />
        Upload CSV
      </Link>
      <Link
        to="/app/wallet?tab=linkedAccounts"
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
      >
        Connect Bank
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Premium
        </span>
      </Link>
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
