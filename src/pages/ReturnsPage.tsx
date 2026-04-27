import { useMemo, useState } from 'react'
import { CheckCircle, PackageOpen, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTransactionStore } from '@/stores/transactionStore'
import { formatCurrency, formatDate } from '@/utils/formatters'
import EmptyState from '@/components/shared/EmptyState'
import type { Transaction } from '@/types'

type Tab = 'expected' | 'review' | 'completed'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function dateMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const ms = Date.UTC(year, month - 1, day)
  return Number.isFinite(ms) ? ms : 0
}

function getRecentPurchaseCandidates(refund: Transaction, transactions: Transaction[]): Transaction[] {
  const refundDate = dateMs(refund.transDate)
  return transactions
    .filter((t) => {
      if (t.id === refund.id || t.deleted) return false
      if (t.isPayment || t.isCredit || t.isBalancePayment) return false
      if (t.amount <= 0) return false
      const txDate = dateMs(t.transDate)
      if (!refundDate || !txDate || txDate > refundDate) return false
      return refundDate - txDate <= 90 * MS_PER_DAY
    })
    .sort((a, b) => dateMs(b.transDate) - dateMs(a.transDate))
}

export default function ReturnsPage() {
  const { transactions, update } = useTransactionStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [refundSelections, setRefundSelections] = useState<Record<string, string>>({})
  const [refundSearches, setRefundSearches] = useState<Record<string, string>>({})

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
    () => transactions.filter((t) => t.refundReviewPending && !t.deleted),
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

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="No transactions yet"
        description="Upload a statement and mark transactions for returns."
        action={
          <Link to="/app/transactions" className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700">
            View Transactions
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Returns</h1>
        <div className="flex items-center gap-4 text-sm">
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

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => switchTab('expected')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
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
              <table className="w-full text-sm">
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
              <table className="w-full text-sm">
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
                    const candidates = getRecentPurchaseCandidates(refund, transactions)
                    const query = refundSearches[refund.id]?.toLowerCase() ?? ''
                    const filteredCandidates = query
                      ? candidates.filter((candidate) => {
                          const haystack = `${candidate.cleanDescription} ${candidate.description} ${formatCurrency(candidate.amount)} ${formatDate(candidate.transDate, 'MMM d, yyyy')}`.toLowerCase()
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
                          <p className="text-sm font-medium text-slate-800">{refund.cleanDescription}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[220px]">{refund.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                          {formatCurrency(Math.abs(refund.amount))}
                        </td>
                        <td className="px-4 py-3 min-w-[280px]">
                          <div className="flex flex-col gap-1.5">
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
                              {filteredCandidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {formatDate(candidate.transDate, 'MMM d')} · {candidate.cleanDescription} · {formatCurrency(candidate.amount)}
                                </option>
                              ))}
                            </select>
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
              <table className="w-full text-sm">
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
          )}
        </>
      )}
    </div>
  )
}
