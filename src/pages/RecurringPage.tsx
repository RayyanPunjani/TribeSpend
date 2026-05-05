import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Scan, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { useSampleTransactionStore } from '@/stores/sampleTransactionStore'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { parseISO, differenceInDays } from 'date-fns'
import { runRecurringDetector } from '@/services/recurringDetector'
import CategoryDropdown from '@/components/transactions/CategoryDropdown'

interface RecurringCharge {
  merchant: string
  category: string
  recurringType: RecurringType
  cardId: string
  amounts: number[]
  dates: string[]
  latest: number
  latestDate: string
  frequency: RecurringFrequency | null
  annualEstimate: number | null
  hasSavedFrequency: boolean
  isFrequencyAutoDetected: boolean
  frequencyNeedsReview: boolean
  isPriceChanged: boolean
  isMissing: boolean
  isAutoDetected: boolean
  transactionIds: string[]
}

interface RecurringService {
  merchant: string
  category: string
  recurringType: RecurringType
  cardIds: string[]
  amounts: number[]
  latest: number
  latestDate: string
  frequency: RecurringFrequency | null
  isPriceChanged: boolean
  isDuplicate: boolean
  annualEstimate: number | null
}

type RecurringType = 'subscription' | 'utility' | 'insurance' | 'membership' | 'other'
type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'semi_annually' | 'yearly'

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annually: 'Semi-annually',
  yearly: 'Yearly',
}

const FREQUENCY_OPTIONS: RecurringFrequency[] = ['weekly', 'monthly', 'quarterly', 'semi_annually', 'yearly']

const TYPE_LABELS: Record<RecurringType, string> = {
  subscription: 'Subscription',
  utility: 'Utility',
  insurance: 'Insurance',
  membership: 'Membership',
  other: 'Other',
}

const TYPE_STYLES: Record<RecurringType, string> = {
  subscription: 'bg-violet-50 text-violet-700',
  utility: 'bg-cyan-50 text-cyan-700',
  insurance: 'bg-emerald-50 text-emerald-700',
  membership: 'bg-amber-50 text-amber-700',
  other: 'bg-slate-100 text-slate-600',
}

function getRecurringType(category: string, merchant: string): RecurringType {
  const merchantText = merchant.toLowerCase()

  if (category === 'Subscriptions') return 'subscription'
  if (category === 'Insurance') return 'insurance'
  if (
    category === 'Home & Utilities' ||
    category === 'Telecom' ||
    /\b(utility|electric|water|gas|internet|xfinity|comcast|spectrum|verizon|t-mobile|tmobile|at&t|cox)\b/.test(merchantText)
  ) {
    return 'utility'
  }
  if (
    category === 'Fitness' ||
    /\b(membership|memb|gym|fitness|costco|sam'?s club|planet fitness|la fitness|lifetime|ymca|walmart\+)\b/.test(merchantText)
  ) {
    return 'membership'
  }

  return 'other'
}

interface FrequencyInference {
  frequency: RecurringFrequency | null
  confident: boolean
}

function getFrequencyInference(dates: string[]): FrequencyInference {
  if (dates.length < 2) return { frequency: 'monthly', confident: false }

  const gaps = dates.slice(0, -1).map((d, i) =>
    differenceInDays(parseISO(d), parseISO(dates[i + 1])),
  ).filter((gap) => Number.isFinite(gap) && gap > 0)
  if (gaps.length === 0) return { frequency: 'monthly', confident: false }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const closest = [
    { frequency: 'weekly' as const, days: 7, tolerance: 3 },
    { frequency: 'monthly' as const, days: 30, tolerance: 12 },
    { frequency: 'quarterly' as const, days: 90, tolerance: 25 },
    { frequency: 'semi_annually' as const, days: 180, tolerance: 45 },
    { frequency: 'yearly' as const, days: 365, tolerance: 60 },
  ]
    .map((candidate) => ({
      ...candidate,
      delta: Math.abs(avgGap - candidate.days),
    }))
    .sort((a, b) => a.delta - b.delta)[0]

  if (!closest || closest.delta > closest.tolerance) return { frequency: null, confident: false }
  return { frequency: closest.frequency, confident: true }
}

function getAnnualEstimate(frequency: RecurringFrequency | null, amount: number): number | null {
  if (!frequency) return null
  if (frequency === 'weekly') return amount * 52
  if (frequency === 'monthly') return amount * 12
  if (frequency === 'quarterly') return amount * 4
  if (frequency === 'semi_annually') return amount * 2
  return amount
}

function getMonthlyEstimate(frequency: RecurringFrequency | null, amount: number): number {
  if (!frequency) return 0
  if (frequency === 'weekly') return amount * (52 / 12)
  if (frequency === 'monthly') return amount
  if (frequency === 'quarterly') return amount / 3
  if (frequency === 'semi_annually') return amount / 6
  return amount / 12
}

function getRecurringAmount(transaction: { id: string; amount: unknown; cleanDescription?: string; description?: string }): number | null {
  const amount = Number(transaction.amount)
  if (!Number.isFinite(amount)) {
    console.warn('[RecurringPage] Missing or invalid recurring transaction amount:', {
      id: transaction.id,
      amount: transaction.amount,
      merchant: transaction.cleanDescription || transaction.description,
    })
    return null
  }
  return Math.abs(amount)
}

export default function RecurringPage() {
  const { transactions, updateMany } = useTransactionStore()
  const { cards } = useCardStore()
  const sampleTransactions = useSampleTransactionStore((state) => state.transactions)
  const sampleFlags = useSampleTransactionStore((state) => state.flags)
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<number | null>(null)
  const [savingFrequencyKey, setSavingFrequencyKey] = useState<string | null>(null)
  const [frequencyError, setFrequencyError] = useState<string | null>(null)

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
    () => transactions.filter((t) => t.isRecurring && !t.isPayment && !t.isCredit && !t.deleted),
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
      const amountEntries = sorted
        .map((t) => ({ transaction: t, amount: getRecurringAmount(t) }))
        .filter((entry): entry is { transaction: typeof sorted[number]; amount: number } => entry.amount !== null)
      if (amountEntries.length === 0) continue

      const amounts = amountEntries.map((entry) => entry.amount)
      const dates = sorted.map((t) => t.transDate)
      const latest = amounts[0]
      const latestDate = amountEntries[0].transaction.transDate

      // Detect price change
      const isPriceChanged = amounts.length > 1 && amounts[0] !== amounts[1]

      // Detect missing (last charge > 45 days ago)
      const daysSince = differenceInDays(now, parseISO(latestDate))
      const isMissing = daysSince > 45

      const savedFrequency = sorted.find((t) => t.recurringFrequency)?.recurringFrequency
      const inferredFrequency = getFrequencyInference(dates)
      const frequency = savedFrequency ?? inferredFrequency.frequency

      result.push({
        merchant: sorted[0].cleanDescription,
        category: sorted[0].category,
        recurringType: getRecurringType(sorted[0].category, sorted[0].cleanDescription),
        cardId: sorted[0].cardId,
        amounts,
        dates,
        latest,
        latestDate,
        frequency,
        annualEstimate: getAnnualEstimate(frequency, latest),
        hasSavedFrequency: Boolean(savedFrequency),
        isFrequencyAutoDetected: !savedFrequency && inferredFrequency.confident,
        frequencyNeedsReview: !frequency,
        isPriceChanged,
        isMissing,
        isAutoDetected: sorted.some((t) => t.recurringAutoDetected),
        transactionIds: sorted.map((t) => t.id),
      })
    }

    return result.sort((a, b) => b.latest - a.latest)
  }, [recurring])

  const monthlyTotal = useMemo(() => {
    return charges.reduce((s, c) => s + getMonthlyEstimate(c.frequency, c.latest), 0)
  }, [charges])

  const annualTotal = useMemo(
    () => charges.reduce((s, c) => s + (c.annualEstimate ?? 0), 0),
    [charges],
  )

  // Merchant-level view powers duplicate detection and summary totals.
  const recurringServices = useMemo((): RecurringService[] => {
    const groups = new Map<string, typeof recurring>()
    for (const t of recurring) {
      const key = t.cleanDescription.toLowerCase().trim()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }

    const result: RecurringService[] = []

    for (const [, txns] of groups) {
      const sorted = [...txns].sort((a, b) => b.transDate.localeCompare(a.transDate))
      const amountEntries = sorted
        .map((t) => ({ transaction: t, amount: getRecurringAmount(t) }))
        .filter((entry): entry is { transaction: typeof sorted[number]; amount: number } => entry.amount !== null)
      if (amountEntries.length === 0) continue

      const amounts = amountEntries.map((entry) => entry.amount)
      const dates = sorted.map((t) => t.transDate)
      const latest = amounts[0]
      const latestDate = amountEntries[0].transaction.transDate

      const isPriceChanged = amounts.length > 1 && amounts[0] !== amounts[1]

      // Collect unique cardIds
      const cardIds = [...new Set(sorted.map((t) => t.cardId))]
      const isDuplicate = cardIds.length > 1

      const savedFrequency = sorted.find((t) => t.recurringFrequency)?.recurringFrequency
      const inferredFrequency = getFrequencyInference(dates)
      const frequency = savedFrequency ?? inferredFrequency.frequency

      result.push({
        merchant: sorted[0].cleanDescription,
        category: sorted[0].category,
        recurringType: getRecurringType(sorted[0].category, sorted[0].cleanDescription),
        cardIds,
        amounts,
        latest,
        latestDate,
        frequency,
        isPriceChanged,
        isDuplicate,
        annualEstimate: getAnnualEstimate(frequency, latest),
      })
    }

    return result.sort((a, b) => (b.annualEstimate ?? 0) - (a.annualEstimate ?? 0))
  }, [recurring])

  const recurringServiceMap = useMemo(
    () => new Map(recurringServices.map((service) => [service.merchant.toLowerCase().trim(), service])),
    [recurringServices],
  )

  // Detect overlapping recurring services by category (3+ in same category).
  const overlappingCategories = useMemo(() => {
    const catCount = new Map<string, number>()
    for (const service of recurringServices) {
      catCount.set(service.category, (catCount.get(service.category) ?? 0) + 1)
    }
    return Array.from(catCount.entries())
      .filter(([, count]) => count >= 3)
      .map(([cat]) => cat)
  }, [recurringServices])

  const handleFrequencyChange = async (
    charge: RecurringCharge,
    frequency: RecurringFrequency,
    key: string,
  ) => {
    if (charge.frequency === frequency) return
    setSavingFrequencyKey(key)
    setFrequencyError(null)
    try {
      const ok = await updateMany(charge.transactionIds, { recurringFrequency: frequency })
      if (!ok) {
        setFrequencyError('Frequency could not be saved. Please try again.')
      }
    } finally {
      setSavingFrequencyKey(null)
    }
  }

  const handleCategoryChange = async (charge: RecurringCharge, category: string) => {
    if (charge.category === category) return
    await updateMany(charge.transactionIds, { category })
  }

  if (transactions.length === 0) {
    const sampleRecurring = sampleTransactions.filter((transaction) => sampleFlags[transaction.id]?.recurring && !sampleFlags[transaction.id]?.hidden)
    const preview = sampleRecurring.length > 0 ? sampleRecurring : [sampleTransactions[0]]
    const sampleMonthly = preview.reduce((sum, transaction) => sum + transaction.amount, 0)
    const sampleAnnual = sampleMonthly * 12

    return (
      <div className="flex flex-col gap-5 max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Recurring Charges</h1>
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
          Mark a sample transaction with the recurring icon to see it appear here. Example data disappears once real transactions exist.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Est. monthly</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(sampleMonthly)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Est. annual</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(sampleAnnual)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Merchant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Card</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Frequency</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Annual Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((transaction) => {
                  const type = getRecurringType(transaction.category, transaction.merchant)
                  return (
                    <tr key={transaction.id} className="bg-accent-50/30">
                      <td className="px-4 py-3 font-medium text-slate-800">{transaction.merchant}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[type]}`}>
                          {TYPE_LABELS[type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{transaction.card}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
                          Monthly
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(transaction.amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(transaction.amount * 12)}</td>
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
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Recurring Charges</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            Est. monthly:{' '}
            <span className="font-semibold text-slate-800">{formatCurrency(monthlyTotal)}</span>
            <span className="mx-2 text-slate-300">|</span>
            Est. annual:{' '}
            <span className="font-semibold text-slate-800">{formatCurrency(annualTotal)}</span>
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

      {frequencyError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {frequencyError}
        </div>
      )}

      {overlappingCategories.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Potential overlapping recurring charges</p>
            <p className="text-xs text-amber-600 mt-0.5">
              You have 3+ recurring services in: {overlappingCategories.join(', ')}. Review for duplicates.
            </p>
          </div>
        </div>
      )}

      {charges.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          <p>No recurring charges detected yet.</p>
          <p className="mt-1">Recurring charges are detected automatically as you import statements. You can also mark any transaction manually using the ↻ button, or click <strong>Scan for recurring</strong> above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Merchant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Card</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Frequency</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Annual Est.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Last Charged</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {charges.map((charge, i) => {
                  const card = cardMap.get(charge.cardId)
                  const service = recurringServiceMap.get(charge.merchant.toLowerCase().trim())
                  const rowKey = `${charge.merchant}-${charge.cardId}-${i}`
                  const isSavingFrequency = savingFrequencyKey === rowKey
                  const reviewReasons = [
                    service?.isDuplicate ? 'Seen on multiple cards' : null,
                    charge.isPriceChanged ? 'Amount changed from previous charge' : null,
                    charge.isMissing ? 'Not seen in recent statements' : null,
                  ].filter(Boolean)
                  const needsReview = reviewReasons.length > 0

                  return (
                    <tr key={rowKey} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{charge.merchant}</span>
                          {charge.isAutoDetected && (
                            <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                              Auto
                            </span>
                          )}
                          {needsReview && (
                            <span
                              title={reviewReasons.join(', ')}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                            >
                              <AlertTriangle size={10} /> Review
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[charge.recurringType]}`}>
                          {TYPE_LABELS[charge.recurringType]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryDropdown
                          value={charge.category}
                          onChange={(category) => handleCategoryChange(charge, category)}
                          compact
                        />
                      </td>
                      <td className="px-4 py-3">
                        {card ? (
                          <div
                            className="inline-flex max-w-[150px] items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-1 align-middle"
                            title={`${card.name}${card.lastFour ? ` • …${card.lastFour}` : ''}`}
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: card.color }} />
                            <span className="min-w-0 truncate text-xs font-medium text-slate-600">
                              {card.lastFour ? `…${card.lastFour}` : card.name}
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <label className={`relative inline-flex min-w-[150px] items-center justify-between gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSavingFrequency
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-accent-200 bg-accent-50 text-accent-700 hover:border-accent-300 hover:bg-accent-100'
                        }`}>
                          <span>{charge.frequency ? FREQUENCY_LABELS[charge.frequency] : 'Set frequency'}</span>
                          <ChevronDown size={12} className="shrink-0" />
                          <select
                            aria-label={`Frequency for ${charge.merchant}`}
                            value={charge.frequency ?? ''}
                            disabled={isSavingFrequency}
                            onChange={(event) => handleFrequencyChange(charge, event.target.value as RecurringFrequency, rowKey)}
                            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
                          >
                            {!charge.frequency && <option value="" disabled>Set frequency</option>}
                            {FREQUENCY_OPTIONS.map((option) => (
                              <option key={option} value={option}>{FREQUENCY_LABELS[option]}</option>
                            ))}
                          </select>
                        </label>
                        {!charge.frequencyNeedsReview && charge.isFrequencyAutoDetected ? (
                          <span className="ml-2 align-middle text-[10px] font-medium text-blue-500">
                            Auto-detected
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(charge.latest)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {charge.annualEstimate && charge.annualEstimate > 0 ? formatCurrency(charge.annualEstimate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(charge.latestDate)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => updateMany(charge.transactionIds, {
                            isRecurring: false,
                            recurringDismissed: true,
                          })}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        >
                          Remove from recurring
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Total ({charges.length} recurring charges)
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                    {formatCurrency(monthlyTotal)}/mo
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                    {formatCurrency(annualTotal)}/yr
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
