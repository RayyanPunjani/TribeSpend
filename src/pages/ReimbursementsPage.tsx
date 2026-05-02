import { useMemo, useState } from 'react'
import { AlertCircle, DollarSign, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTransactionStore } from '@/stores/transactionStore'
import { useSampleTransactionStore } from '@/stores/sampleTransactionStore'
import { formatCurrency, formatDate } from '@/utils/formatters'

export default function ReimbursementsPage() {
  const { transactions, update, updateMany } = useTransactionStore()
  const sampleTransactions = useSampleTransactionStore((state) => state.transactions)
  const sampleFlags = useSampleTransactionStore((state) => state.flags)
  const sampleReimbursementDetails = useSampleTransactionStore((state) => state.reimbursements)
  const [settlingUp, setSettlingUp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reimbursable = useMemo(
    () => transactions.filter((t) => t.reimbursementStatus !== 'none' && !t.deleted),
    [transactions],
  )

  const byPerson = useMemo(() => {
    const groups = new Map<string, typeof reimbursable>()
    for (const t of reimbursable) {
      const key = t.reimbursementPerson ?? 'Unknown'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    return groups
  }, [reimbursable])

  const totalOutstanding = useMemo(() => {
    return reimbursable
      .filter((t) => !t.reimbursementPaid)
      .reduce((s, t) => {
        const amt = t.reimbursementStatus === 'settled' ? t.amount : t.reimbursementAmount ?? 0
        return s + amt
      }, 0)
  }, [reimbursable])

  const settleUp = async (person: string) => {
    setSettlingUp(person)
    setError(null)
    try {
      const personTxns = byPerson.get(person) ?? []
      const unpaidIds = personTxns.filter((t) => !t.reimbursementPaid).map((t) => t.id)
      if (unpaidIds.length > 0) {
        const success = await updateMany(unpaidIds, { reimbursementPaid: true })
        if (!success) setError('Unable to settle reimbursements. Please try again.')
      }
    } catch {
      setError('Unable to settle reimbursements. Please try again.')
    } finally {
      setSettlingUp(null)
    }
  }

  const togglePaid = async (id: string, nextPaid: boolean) => {
    setError(null)
    try {
      const success = await update(id, { reimbursementPaid: nextPaid })
      if (!success) setError('Unable to update reimbursement status. Please try again.')
    } catch {
      setError('Unable to update reimbursement status. Please try again.')
    }
  }

  if (transactions.length === 0) {
    const sampleReimbursements = sampleTransactions.filter((transaction) => sampleFlags[transaction.id]?.reimbursement && !sampleFlags[transaction.id]?.hidden)
    const preview = sampleReimbursements.length > 0 ? sampleReimbursements : [sampleTransactions[1]]
    const outstanding = preview.reduce((sum, transaction) => {
      const details = sampleReimbursementDetails[transaction.id]
      return sum + (details?.paid ? 0 : details?.amount ?? transaction.amount / 2)
    }, 0)
    const paidTotal = preview.reduce((sum, transaction) => {
      const details = sampleReimbursementDetails[transaction.id]
      return sum + (details?.paid ? details.amount : 0)
    }, 0)
    const person = sampleReimbursementDetails[preview[0]?.id]?.person ?? 'Nada'

    return (
      <div className="flex flex-col gap-5 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Reimbursements</h1>
            <p className="mt-1 text-sm text-slate-500">Example data</p>
          </div>
          <Link
            to="/app/transactions"
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700"
          >
            Practice on Transactions
          </Link>
        </div>

        <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          Mark a sample transaction with the reimbursement icon to see it appear here. Example data disappears once real transactions exist.
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center text-accent-700 font-bold text-sm">
                {person.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{person}</p>
                <p className="text-xs text-slate-500">
                  Outstanding: {formatCurrency(outstanding)} · Paid: {formatCurrency(paidTotal)}
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium">
              <CheckCircle size={13} />
              Settle Up
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Date</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Description</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400">Total</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400">Reimbursable</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {preview.map((transaction) => {
                const details = sampleReimbursementDetails[transaction.id]
                const reimbursable = details?.amount ?? transaction.amount / 2
                return (
                  <tr key={transaction.id} className={`bg-accent-50/30 ${details?.paid ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{transaction.date}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-slate-800">{transaction.merchant}</p>
                      <p className="text-xs text-slate-400">{details?.note || transaction.description}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-700">{formatCurrency(transaction.amount)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-semibold ${details?.paid ? 'text-green-600 line-through' : 'text-orange-600'}`}>
                      {formatCurrency(reimbursable)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        details?.paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {details?.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Reimbursements</h1>
        {totalOutstanding > 0 && (
          <div className="text-sm">
            <span className="text-slate-500">Outstanding: </span>
            <span className="font-semibold text-orange-600">{formatCurrency(totalOutstanding)}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {byPerson.size === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <DollarSign size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">No transactions marked for reimbursement yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Use the <span className="font-mono">$</span> button on any transaction row.
          </p>
        </div>
      ) : (
        Array.from(byPerson.entries()).map(([person, txns]) => {
          const unpaid = txns.filter((t) => !t.reimbursementPaid)
          const paid = txns.filter((t) => t.reimbursementPaid)
          const outstanding = unpaid.reduce((s, t) => {
            return s + (t.reimbursementStatus === 'settled' ? t.amount : t.reimbursementAmount ?? 0)
          }, 0)
          const paidTotal = paid.reduce((s, t) => {
            return s + (t.reimbursementStatus === 'settled' ? t.amount : t.reimbursementAmount ?? 0)
          }, 0)

          return (
            <div key={person} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center text-accent-700 font-bold text-sm">
                    {person.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{person}</p>
                    <p className="text-xs text-slate-500">
                      Outstanding: {formatCurrency(outstanding)} · Paid: {formatCurrency(paidTotal)}
                    </p>
                  </div>
                </div>
                {outstanding > 0 && (
                  <button
                    onClick={() => settleUp(person)}
                    disabled={settlingUp === person}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={13} />
                    {settlingUp === person ? 'Settling…' : 'Settle Up'}
                  </button>
                )}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Description</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400">Total</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400">Reimbursable</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400">Note</th>
                    <th className="px-4 py-2 text-xs font-semibold text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {txns.map((t) => {
                    const reimb = t.reimbursementStatus === 'settled' ? t.amount : t.reimbursementAmount ?? 0
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 ${t.reimbursementPaid ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(t.transDate, 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-slate-800">{t.cleanDescription}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-700">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`text-sm font-semibold ${t.reimbursementPaid ? 'text-green-600 line-through' : 'text-orange-600'}`}>
                            {formatCurrency(reimb)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {t.reimbursementNote}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => togglePaid(t.id, !t.reimbursementPaid)}
                            className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-colors ${
                              t.reimbursementPaid
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            }`}
                          >
                            {t.reimbursementPaid ? <><CheckCircle size={11} /> Paid</> : 'Unpaid'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}
