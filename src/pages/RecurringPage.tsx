import { useMemo, useState } from 'react'
import { RefreshCw, Upload, AlertTriangle, Scan, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { formatCurrency, formatDate } from '@/utils/formatters'
import EmptyState from '@/components/shared/EmptyState'
import { parseISO, differenceInDays } from 'date-fns'
import { runRecurringDetector } from '@/services/recurringDetector'

interface RecurringCharge {
  merchant: string
  category: string
  cardId: string
  amounts: number[]
  dates: string[]
  latest: number
  latestDate: string
  frequency: string
  isPriceChanged: boolean
  isMissing: boolean
  isAutoDetected: boolean
}

interface SubscriptionGroup {
  merchant: string
  category: string
  cardIds: string[]
  amounts: number[]
  latest: number
  latestDate: string
  frequency: string
  isPriceChanged: boolean
  isDuplicate: boolean
  annualEstimate: number
}

type Tab = 'recurring' | 'subscriptions'

export default function RecurringPage() {
  const { transactions, updateMany } = useTransactionStore()
  const { cards } = useCardStore()
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const [tab, setTab] = useState<Tab>('recurring')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<number | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const count = await runRecurringDetector(transactions, updateMany)
      setScanResult(count)
    } finally {
      setScanning(false)
    }
  }

  const recurring = useMemo(
    () => transactions.filter((t) => t.isRecurring && !t.isPayment && !t.isCredit),
    [transactions],
  )

  // Group by merchant + card (existing recurring logic)
  const charges = useMemo((): RecurringCharge[] => {
    const groups = new Map<string, typeof recurring>()
    for (const t of recurring) {
      const key = `${t.cleanDescription}|${t.cardId}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }

    const now = new Date()
    const result: RecurringCharge[] = []

    for (const [, txns] of groups) {
      const sorted = [...txns].sort((a, b) => b.transDate.localeCompare(a.transDate))
      const amounts = sorted.map((t) => t.amount)
      const dates = sorted.map((t) => t.transDate)
      const latest = amounts[0]
      const latestDate = dates[0]

      // Detect price change
      const isPriceChanged = amounts.length > 1 && amounts[0] !== amounts[1]

      // Detect missing (last charge > 45 days ago)
      const daysSince = differenceInDays(now, parseISO(latestDate))
      const isMissing = daysSince > 45

      // Frequency detection
      let frequency = 'Unknown'
      if (dates.length >= 2) {
        const gaps = dates.slice(0, -1).map((d, i) =>
          differenceInDays(parseISO(d), parseISO(dates[i + 1])),
        )
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
        if (avgGap < 10) frequency = 'Weekly'
        else if (avgGap < 40) frequency = 'Monthly'
        else if (avgGap < 100) frequency = 'Quarterly'
        else frequency = 'Annual'
      }

      result.push({
        merchant: sorted[0].cleanDescription,
        category: sorted[0].category,
        cardId: sorted[0].cardId,
        amounts,
        dates,
        latest,
        latestDate,
        frequency,
        isPriceChanged,
        isMissing,
        isAutoDetected: sorted.some((t) => t.recurringAutoDetected),
      })
    }

    return result.sort((a, b) => b.latest - a.latest)
  }, [recurring])

  const monthlyTotal = useMemo(() => {
    return charges
      .filter((c) => c.frequency === 'Monthly' || c.frequency === 'Weekly')
      .reduce((s, c) => s + c.latest, 0)
  }, [charges])

  // Subscriptions: group by merchant only
  const subscriptions = useMemo((): SubscriptionGroup[] => {
    const groups = new Map<string, typeof recurring>()
    for (const t of recurring) {
      const key = t.cleanDescription.toLowerCase().trim()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }

    const result: SubscriptionGroup[] = []

    for (const [, txns] of groups) {
      const sorted = [...txns].sort((a, b) => b.transDate.localeCompare(a.transDate))
      const amounts = sorted.map((t) => t.amount)
      const dates = sorted.map((t) => t.transDate)
      const latest = amounts[0]
      const latestDate = dates[0]

      const isPriceChanged = amounts.length > 1 && amounts[0] !== amounts[1]

      // Collect unique cardIds
      const cardIds = [...new Set(sorted.map((t) => t.cardId))]
      const isDuplicate = cardIds.length > 1

      // Frequency detection
      let frequency = 'Unknown'
      if (dates.length >= 2) {
        const gaps = dates.slice(0, -1).map((d, i) =>
          differenceInDays(parseISO(d), parseISO(dates[i + 1])),
        )
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
        if (avgGap < 10) frequency = 'Weekly'
        else if (avgGap < 40) frequency = 'Monthly'
        else if (avgGap < 100) frequency = 'Quarterly'
        else frequency = 'Annual'
      }

      // Annual estimate
      let annualEstimate = 0
      if (frequency === 'Monthly') annualEstimate = latest * 12
      else if (frequency === 'Weekly') annualEstimate = latest * 52
      else if (frequency === 'Quarterly') annualEstimate = latest * 4
      else if (frequency === 'Annual') annualEstimate = latest

      result.push({
        merchant: sorted[0].cleanDescription,
        category: sorted[0].category,
        cardIds,
        amounts,
        latest,
        latestDate,
        frequency,
        isPriceChanged,
        isDuplicate,
        annualEstimate,
      })
    }

    return result.sort((a, b) => b.annualEstimate - a.annualEstimate)
  }, [recurring])

  // Monthly and annual totals for subscriptions
  const subMonthlyTotal = useMemo(() => {
    return subscriptions.reduce((s, sub) => {
      if (sub.frequency === 'Monthly') return s + sub.latest
      if (sub.frequency === 'Weekly') return s + sub.latest * (52 / 12)
      if (sub.frequency === 'Quarterly') return s + sub.latest / 3
      if (sub.frequency === 'Annual') return s + sub.latest / 12
      return s
    }, 0)
  }, [subscriptions])

  const subAnnualTotal = useMemo(
    () => subscriptions.reduce((s, sub) => s + sub.annualEstimate, 0),
    [subscriptions],
  )

  // Detect overlapping subscriptions by category (3+ in same category)
  const overlappingCategories = useMemo(() => {
    const catCount = new Map<string, number>()
    for (const sub of subscriptions) {
      catCount.set(sub.category, (catCount.get(sub.category) ?? 0) + 1)
    }
    return Array.from(catCount.entries())
      .filter(([, count]) => count >= 3)
      .map(([cat]) => cat)
  }, [subscriptions])

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No recurring charges yet"
        description="Upload statements to get started. Recurring charges are detected automatically from your transaction history."
        action={
          <Link to="/app/upload" className="flex items-center gap-2 px-5 py-2.5 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700">
            <Upload size={15} /> Upload Statement
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">Recurring Charges</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            Est. monthly:{' '}
            <span className="font-semibold text-slate-800">{formatCurrency(monthlyTotal)}</span>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {scanning
              ? <Loader2 size={13} className="animate-spin" />
              : <Scan size={13} />
            }
            {scanning ? 'Scanning…' : 'Scan for recurring'}
          </button>
        </div>
      </div>

      {scanResult !== null && (
        <div className={`rounded-xl px-4 py-2.5 text-sm ${
          scanResult > 0
            ? 'bg-accent-50 border border-accent-200 text-accent-700'
            : 'bg-slate-50 border border-slate-200 text-slate-500'
        }`}>
          {scanResult > 0
            ? `Found ${scanResult} new recurring charge${scanResult !== 1 ? 's' : ''}. Scroll down to see them.`
            : 'No new recurring charges found.'}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 self-start">
        {(['recurring', 'subscriptions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'recurring' ? 'Recurring' : 'Subscriptions'}
          </button>
        ))}
      </div>

      {tab === 'recurring' && (
        <>
          {charges.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              <p>No recurring charges detected yet.</p>
              <p className="mt-1">Recurring charges are detected automatically as you import statements. You can also mark any transaction manually using the ↻ button, or click <strong>Scan for recurring</strong> above.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Merchant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Card</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Frequency</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Last Charged</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {charges.map((charge, i) => {
                    const card = cardMap.get(charge.cardId)
                    return (
                      <tr key={i} className={`hover:bg-slate-50 ${charge.isMissing ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            {charge.merchant}
                            {charge.isAutoDetected && (
                              <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                                Auto
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {charge.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {card ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                              <span className="text-xs text-slate-600">…{card.lastFour}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">{charge.frequency}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(charge.latest)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(charge.latestDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {charge.isPriceChanged && (
                              <span
                                title="Amount changed from previous"
                                className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"
                              >
                                <AlertTriangle size={10} /> Price ↑
                              </span>
                            )}
                            {charge.isMissing && (
                              <span
                                title="Not seen in recent statements"
                                className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full"
                              >
                                <AlertTriangle size={10} /> Missing
                              </span>
                            )}
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

      {tab === 'subscriptions' && (
        <>
          {overlappingCategories.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Potential overlapping subscriptions</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  You have 3+ subscriptions in: {overlappingCategories.join(', ')}. Review for duplicates.
                </p>
              </div>
            </div>
          )}

          {subscriptions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              No subscriptions detected yet. Import statements to detect recurring charges automatically, or mark transactions using the ↻ button.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cards</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Frequency</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Annual Est.</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((sub, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{sub.merchant}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {sub.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {sub.cardIds.map((cid) => {
                            const card = cardMap.get(cid)
                            return card ? (
                              <span
                                key={cid}
                                title={card.name}
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: card.color }}
                              />
                            ) : null
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">{sub.frequency}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(sub.latest)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {sub.annualEstimate > 0 ? formatCurrency(sub.annualEstimate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {sub.isDuplicate && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Duplicate?
                            </span>
                          )}
                          {sub.isPriceChanged && (
                            <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Price ↑
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-500">
                      Total ({subscriptions.length} subscriptions)
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                      {formatCurrency(subMonthlyTotal)}/mo
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                      {formatCurrency(subAnnualTotal)}/yr
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
