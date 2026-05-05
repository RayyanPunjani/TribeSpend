import { useTransactionStore } from '@/stores/transactionStore'
import { formatCurrency } from '@/utils/formatters'
import { getMonth, getYear, parseISO } from 'date-fns'
import { AlertCircle, Menu } from 'lucide-react'
import { useMemo } from 'react'

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const transactions = useTransactionStore((s) => s.transactions)

  const { thisMonthSpend, needsReviewCount, outstandingReimb } = useMemo(() => {
    const now = new Date()
    const m = getMonth(now)
    const y = getYear(now)

    let thisMonthSpend = 0
    let needsReviewCount = 0
    let outstandingReimb = 0

    for (const t of transactions) {
      if (t.isPayment || t.isCredit) continue
      const d = parseISO(t.transDate)
      if (getMonth(d) === m && getYear(d) === y) {
        thisMonthSpend += t.amount
      }
      if (t.category === 'Needs Review') needsReviewCount++
      if (t.reimbursementStatus !== 'none' && !t.reimbursementPaid) {
        const amt =
          t.reimbursementStatus === 'settled'
            ? t.amount
            : t.reimbursementAmount ?? 0
        outstandingReimb += amt
      }
    }

    return { thisMonthSpend, needsReviewCount, outstandingReimb }
  }, [transactions])

  return (
    <header className="min-h-14 bg-white border-b border-slate-200 flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 lg:gap-6 shrink-0">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={21} />
      </button>

      <div className="flex-1" />

      {needsReviewCount > 0 && (
        <div className="flex min-w-0 items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium">
          <AlertCircle size={14} />
          <span className="truncate">{needsReviewCount} needs review</span>
        </div>
      )}

      <div className="hidden md:flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">This month:</span>
          <span className="font-semibold text-slate-800">
            {formatCurrency(thisMonthSpend)}
          </span>
        </div>

        {outstandingReimb > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Owed to you:</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(outstandingReimb)}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
