import { useMemo, useState } from 'react'
import { CheckCircle, PackageOpen, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { useSampleTransactionStore, type SampleReturnDetails, type SampleTransaction } from '@/stores/sampleTransactionStore'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Transaction } from '@/types'
import type { CreditCard } from '@/types'
import { normalizeMerchantName, merchantSearchText } from '@/lib/merchantNormalize'
import { getRefundMatchCandidates, type RankedRefundCandidate } from '@/services/refundMatcher'

type Tab = 'expected' | 'review' | 'completed'

interface RefundFilters {
  sameMerchant: boolean
  exactAmount: boolean
  last90Days: boolean
}

const DEFAULT_REFUND_FILTERS: RefundFilters = {
  sameMerchant: false,
  exactAmount: true,
  last90Days: true,
}

function getTransactionMerchant(t: Transaction): string {
  return normalizeMerchantName(t.cleanDescription || t.description)
}

function getCardPersonLabel(t: Transaction, cardMap: Map<string, CreditCard>): string {
  const card = cardMap.get(t.cardId)
  const parts = [
    card ? `${card.name}${card.lastFour ? ` …${card.lastFour}` : ''}` : '',
    t.cardholderName,
  ].filter(Boolean)

  return [...new Set(parts)].join(' / ')
}

function getConfidenceLabel(candidate: RankedRefundCandidate): string {
  if (candidate.confidence === 'high') return 'High match'
  if (candidate.confidence === 'medium') return 'Possible match'
  return 'Low match'
}

export default function ReturnsPage() {
  const { transactions, update } = useTransactionStore()
  const { cards } = useCardStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [refundSelections, setRefundSelections] = useState<Record<string, string>>({})
  const [refundSearches, setRefundSearches] = useState<Record<string, string>>({})
  const [refundFilters, setRefundFilters] = useState<Record<string, RefundFilters>>({})
  const sampleTransactions = useSampleTransactionStore((state) => state.transactions)
  const sampleFlags = useSampleTransactionStore((state) => state.flags)
  const sampleReturnDetails = useSampleTransactionStore((state) => state.returns)
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])

  const requestedTab = searchParams.get('tab')
  const tab: Tab = requestedTab === 'review' || requestedTab === 'completed'
    ? requestedTab
    : 'expected'

  const switchTab = (next: Tab) => {
    setSearchParams(next === 'expected' ? {} : { tab: next })
  }

  const expectedReturns = useMemo(
    () => transactions.filter((t) => t.expectingReturn && t.returnStatus !== 'completed' && !t.deleted),
    [transactions],
  )

  const pendingRefundReviews = useMemo(
    () => transactions.filter((t) => t.isCredit && t.refundReviewPending && !t.isBalancePayment && !t.deleted),
    [transactions],
  )

  const matchedRefunds = useMemo(
    () => transactions.filter((t) => t.refundForId && !t.refundReviewPending && !t.deleted),
    [transactions],
  )

  const completedExpectedReturns = useMemo(
    () => transactions.filter((t) => {
      if (!t.expectingReturn || t.returnStatus !== 'completed' || t.deleted) return false
      return !transactions.some((refund) => refund.refundForId === t.id && !refund.deleted)
    }),
    [transactions],
  )

  const matchRefund = async (refund: Transaction, selectedId: string) => {
    if (!selectedId) return
    const original = transactions.find((t) => t.id === selectedId)
    await Promise.all([
      update(refund.id, {
        refundForId: selectedId,
        refundReviewPending: false,
      }),
      update(selectedId, {
        hasRefund: true,
        ...(original?.expectingReturn
          ? { returnStatus: 'completed' as const, returnMatchedTransactionId: refund.id }
          : {}),
      }),
    ])
  }

  const keepAsRefund = async (refundId: string) => {
    await update(refundId, { refundReviewPending: false })
  }

  const toggleRefundFilter = (refundId: string, key: keyof RefundFilters) => {
    setRefundFilters((prev) => {
      const current = prev[refundId] ?? DEFAULT_REFUND_FILTERS
      return {
        ...prev,
        [refundId]: { ...current, [key]: !current[key] },
      }
    })
  }

  if (transactions.length === 0) {
    return (
      <SampleReturnsPage
        tab={tab}
        onSwitchTab={switchTab}
        returns={sampleTransactions.filter((transaction) => sampleFlags[transaction.id]?.return && !sampleFlags[transaction.id]?.hidden)}
        details={sampleReturnDetails}
        fallback={sampleTransactions[2]}
      />
    )
  }

  return (
    <div data-tour="returns-section" className="flex flex-col gap-5 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Returns</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {expectedReturns.length > 0 && (
            <span>
              <span className="text-slate-500">Expected: </span>
              <span className="font-semibold text-purple-600">{expectedReturns.length}</span>
            </span>
          )}
          {pendingRefundReviews.length > 0 && (
            <span>
              <span className="text-slate-500">Review: </span>
              <span className="font-semibold text-amber-600">{pendingRefundReviews.length}</span>
            </span>
          )}
          {matchedRefunds.length + completedExpectedReturns.length > 0 && (
            <span>
              <span className="text-slate-500">Completed: </span>
              <span className="font-semibold text-green-600">
                {matchedRefunds.length + completedExpectedReturns.length}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0">
        <button
          onClick={() => switchTab('expected')}
          className={`flex min-w-[160px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-1 ${
            tab === 'expected' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PackageOpen size={14} />
          Expected Returns
          {expectedReturns.length > 0 && (
            <span className="bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {expectedReturns.length}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab('review')}
          className={`flex min-w-[150px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-1 ${
            tab === 'review' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <RotateCcw size={14} />
          Refund Review
          {pendingRefundReviews.length > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {pendingRefundReviews.length}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab('completed')}
          className={`flex min-w-[170px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-1 ${
            tab === 'completed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle size={14} />
          Completed Returns
          {matchedRefunds.length + completedExpectedReturns.length > 0 && (
            <span className="bg-green-500 text-white text-xs rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
              {matchedRefunds.length + completedExpectedReturns.length}
            </span>
          )}
        </button>
      </div>
      </div>

      {tab === 'expected' && (
        <>
          {expectedReturns.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <PackageOpen size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No expected returns yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Use the <PackageOpen size={11} className="inline" /> button on any transaction to mark it as expecting a return or refund.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Merchant</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Charged</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Expected</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Note</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expectedReturns.map((t) => {
                    const expectedAmt = t.expectedReturnAmount ?? t.amount
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(t.transDate, 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{t.cleanDescription}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[220px]">{t.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-purple-600">
                            {formatCurrency(expectedAmt)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">
                          {t.expectedReturnNote ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => update(t.id, { returnStatus: 'completed' })}
                            className="flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-colors whitespace-nowrap bg-purple-100 text-purple-700 hover:bg-purple-200"
                          >
                            Pending
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'review' && (
        <>
          {pendingRefundReviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <RotateCcw size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No refund matches need review.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Merchant</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Refund</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Match Purchase</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRefundReviews.map((refund) => {
                    const filters = refundFilters[refund.id] ?? DEFAULT_REFUND_FILTERS
                    const refundMerchant = getTransactionMerchant(refund)
                    const candidates = getRefundMatchCandidates(refund, transactions, {
                      lookbackDays: filters.last90Days ? 90 : 3650,
                    }).filter((candidate) => {
                      if (filters.sameMerchant && !candidate.merchantMatch) return false
                      if (filters.exactAmount && !candidate.amountExact) return false
                      return true
                    })
                    const query = refundSearches[refund.id]?.toLowerCase() ?? ''
                    const filteredCandidates = query
                      ? candidates.filter((candidate) => {
                          const t = candidate.transaction
                          const haystack = merchantSearchText(
                            candidate.canonicalMerchant,
                            t.cleanDescription,
                            t.description,
                            getCardPersonLabel(t, cardMap),
                            formatCurrency(t.amount),
                            formatDate(t.transDate, 'MMM d, yyyy'),
                          )
                          return haystack.includes(query)
                        })
                      : candidates
                    const selectedId = refundSelections[refund.id] ?? refund.refundForId ?? ''

                    return (
                      <tr key={refund.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(refund.transDate, 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{refundMerchant}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[220px]" title={refund.description}>
                            {refund.cleanDescription !== refundMerchant
                              ? `${refund.cleanDescription} · ${refund.description}`
                              : refund.description}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                          {formatCurrency(Math.abs(refund.amount))}
                        </td>
                        <td className="px-4 py-3 min-w-[280px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap gap-1">
                              {([
                                ['sameMerchant', 'Same merchant'],
                                ['exactAmount', 'Exact amount'],
                                ['last90Days', 'Last 90 days'],
                              ] as Array<[keyof RefundFilters, string]>).map(([key, label]) => {
                                const active = filters[key]
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleRefundFilter(refund.id, key)}
                                    className={`px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${
                                      active
                                        ? 'bg-accent-50 border-accent-200 text-accent-700'
                                        : 'border-slate-200 text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                            <input
                              type="search"
                              value={refundSearches[refund.id] ?? ''}
                              onChange={(e) =>
                                setRefundSearches((prev) => ({ ...prev, [refund.id]: e.target.value }))
                              }
                              placeholder="Search recent purchases"
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500"
                            />
                            <select
                              value={selectedId}
                              onChange={(e) =>
                                setRefundSelections((prev) => ({ ...prev, [refund.id]: e.target.value }))
                              }
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-accent-500"
                            >
                              <option value="">Select a purchase</option>
                              {filteredCandidates.slice(0, 40).map((candidate) => {
                                const t = candidate.transaction
                                const cardPerson = getCardPersonLabel(t, cardMap)
                                return (
                                  <option key={t.id} value={t.id}>
                                    {formatDate(t.transDate, 'MMM d')} · {candidate.canonicalMerchant} · {formatCurrency(t.amount)}
                                    {cardPerson ? ` · ${cardPerson}` : ''} · {getConfidenceLabel(candidate)}
                                  </option>
                                )
                              })}
                            </select>
                            <p className="text-[11px] text-slate-400">
                              {filteredCandidates.length} ranked candidate{filteredCandidates.length === 1 ? '' : 's'}
                              {filteredCandidates.length === 0 ? ' · Try turning off a filter' : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => matchRefund(refund, selectedId)}
                              disabled={!selectedId}
                              className="px-3 py-1.5 bg-accent-600 text-white rounded-lg text-xs font-medium hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Match
                            </button>
                            <button
                              onClick={() => keepAsRefund(refund.id)}
                              className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium whitespace-nowrap"
                            >
                              Keep as Refund
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'completed' && (
        <>
          {matchedRefunds.length === 0 && completedExpectedReturns.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckCircle size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No completed returns yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Refund Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Refund Merchant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Original Purchase</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Refund</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matchedRefunds.map((refund) => {
                    const original = transactions.find((t) => t.id === refund.refundForId)
                    return (
                      <tr key={refund.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(refund.transDate, 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{refund.cleanDescription}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[220px]">{refund.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-800">{original?.cleanDescription ?? 'Unknown purchase'}</p>
                          <p className="text-xs text-slate-400">
                            {original ? `${formatDate(original.transDate, 'MMM d, yyyy')} · ${formatCurrency(original.amount)}` : 'Original transaction not found'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                          {formatCurrency(Math.abs(refund.amount))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-green-100 text-green-700">
                            <CheckCircle size={11} /> Matched
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {completedExpectedReturns.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(t.transDate, 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{t.cleanDescription}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[220px]">{t.description}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">Marked received manually</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                        {formatCurrency(t.expectedReturnAmount ?? t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-green-100 text-green-700">
                          <CheckCircle size={11} /> Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SampleReturnsPage({
  tab,
  onSwitchTab,
  returns,
  details,
  fallback,
}: {
  tab: Tab
  onSwitchTab: (tab: Tab) => void
  returns: SampleTransaction[]
  details: Record<string, SampleReturnDetails>
  fallback: SampleTransaction
}) {
  const expectedRows = returns.filter((transaction) => (details[transaction.id]?.status ?? 'expected') === 'expected')
  const reviewRows = returns.filter((transaction) => details[transaction.id]?.status === 'review')
  const completedRows = returns.filter((transaction) => details[transaction.id]?.status === 'completed')
  const expectedPreview = expectedRows.length > 0 ? expectedRows : [fallback]
  const reviewPreview = reviewRows.length > 0 ? reviewRows : [fallback]
  const completedPreview = completedRows.length > 0 ? completedRows : [fallback]

  return (
    <div data-tour="returns-section" className="flex flex-col gap-5 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Returns</h1>
          <p className="mt-1 text-sm text-slate-500">Example data</p>
        </div>
        <Link
          to="/app/transactions"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Practice on Transactions
        </Link>
      </div>

      <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700">
        Mark a sample transaction with the return icon on Transactions to see it appear here. Example data disappears once real transactions exist.
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <SampleTabButton active={tab === 'expected'} icon={PackageOpen} label="Expected Returns" onClick={() => onSwitchTab('expected')} />
        <SampleTabButton active={tab === 'review'} icon={RotateCcw} label="Refund Review" onClick={() => onSwitchTab('review')} />
        <SampleTabButton active={tab === 'completed'} icon={CheckCircle} label="Completed Returns" onClick={() => onSwitchTab('completed')} />
      </div>

      {tab === 'expected' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Merchant</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Charged</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Expected</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expectedPreview.map((transaction) => {
                const returnDetails = details[transaction.id]
                return (
                <tr key={transaction.id} className="bg-accent-50/30">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{transaction.date}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{transaction.merchant}</p>
                    <p className="text-xs text-slate-400">{returnDetails?.note || transaction.description}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">{formatCurrency(transaction.amount)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-purple-600">{formatCurrency(returnDetails?.amount ?? transaction.amount)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Pending</span>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'review' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Merchant</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Refund</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Match Purchase</th>
              </tr>
            </thead>
            <tbody>
              {reviewPreview.map((transaction) => {
                const returnDetails = details[transaction.id]
                return (
                  <tr key={transaction.id} className="bg-accent-50/30">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{transaction.date}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{transaction.merchant} credit</p>
                      <p className="text-xs text-slate-400">{returnDetails?.note || 'Sample refund waiting for review'}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{formatCurrency(returnDetails?.amount ?? transaction.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Needs match</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'completed' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Refund Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Refund Merchant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Original Purchase</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Refund</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {completedPreview.map((transaction) => {
                const returnDetails = details[transaction.id]
                return (
                  <tr key={transaction.id} className="bg-accent-50/30">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{transaction.date}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{transaction.merchant} refund</p>
                      <p className="text-xs text-slate-400">{returnDetails?.note || 'Sample matched refund'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{transaction.merchant}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{formatCurrency(returnDetails?.amount ?? transaction.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle size={11} /> Completed
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SampleTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof PackageOpen
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
