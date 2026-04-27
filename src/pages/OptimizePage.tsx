import { useMemo, useState } from 'react'
import { Sparkles, CreditCard, AlertCircle, TrendingUp, ExternalLink } from 'lucide-react'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { formatCurrency } from '@/utils/formatters'
import { POINT_VALUE_CENTS, EXCLUDED_FROM_SPEND } from '@/lib/constants'
import type { CardRewardRule, CardCredit, CreditCard as CreditCardType } from '@/types'

function getEffectiveCashbackRate(rule: CardRewardRule): number {
  if (rule.rewardType === 'cashback') return rule.rewardRate
  return rule.rewardRate * POINT_VALUE_CENTS
}

function getBestCardForCategory(
  category: string,
  cards: CreditCardType[],
  rules: CardRewardRule[],
): { card: CreditCardType; rule: CardRewardRule; effectiveRate: number } | null {
  const today = new Date().toISOString().slice(0, 10)
  let best: { card: CreditCardType; rule: CardRewardRule; effectiveRate: number } | null = null
  for (const card of cards) {
    const cardRules = rules.filter((r) => r.cardId === card.id)
    const catRule = cardRules.find((r) => {
      if (r.category !== category) return false
      if (r.isRotating) {
        if (r.activeStartDate && today < r.activeStartDate) return false
        if (r.activeEndDate && today > r.activeEndDate) return false
      }
      return true
    })
    const baseRule = cardRules.find((r) => r.category === 'base')
    const rule = catRule ?? baseRule
    if (!rule) continue
    const rate = getEffectiveCashbackRate(rule)
    if (!best || rate > best.effectiveRate) best = { card, rule, effectiveRate: rate }
  }
  return best
}

// ── Period helpers ─────────────────────────────────────────────────────────────

interface PeriodInfo {
  startStr: string   // ISO date
  endStr: string     // ISO date
  key: string        // e.g. "2026-01", "2026-Q1"
  label: string      // human readable
  daysLeft: number
  totalDays: number
}

function getPeriodInfo(
  frequency: CardCredit['frequency'],
  now: Date,
): PeriodInfo {
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based

  let start: Date, end: Date, key: string, label: string

  if (frequency === 'monthly') {
    start = new Date(y, m, 1)
    end   = new Date(y, m + 1, 0)
    key   = `${y}-${String(m + 1).padStart(2, '0')}`
    label = start.toLocaleString('default', { month: 'long', year: 'numeric' })
  } else if (frequency === 'quarterly') {
    const q = Math.floor(m / 3)
    start = new Date(y, q * 3, 1)
    end   = new Date(y, q * 3 + 3, 0)
    key   = `${y}-Q${q + 1}`
    label = `Q${q + 1} ${y}`
  } else if (frequency === 'semi-annual') {
    const h = m < 6 ? 0 : 1
    start = new Date(y, h * 6, 1)
    end   = new Date(y, h * 6 + 6, 0)
    key   = `${y}-H${h + 1}`
    label = `${h === 0 ? 'Jan–Jun' : 'Jul–Dec'} ${y}`
  } else {
    start = new Date(y, 0, 1)
    end   = new Date(y, 11, 31)
    key   = `${y}`
    label = `${y}`
  }

  const todayMs = now.getTime()
  const endMs   = end.getTime()
  const totalDays = Math.round((endMs - start.getTime()) / 86_400_000) + 1
  const daysLeft  = Math.max(0, Math.round((endMs - todayMs) / 86_400_000) + 1)

  return {
    startStr: start.toISOString().slice(0, 10),
    endStr:   end.toISOString().slice(0, 10),
    key, label, daysLeft, totalDays,
  }
}

function isStatementCreditUsed(
  credit: CardCredit,
  period: PeriodInfo,
  transactions: ReturnType<typeof useTransactionStore>['transactions'],
): boolean {
  return transactions.some((t) => {
    if (t.cardId !== credit.cardId) return false
    if (t.transDate < period.startStr || t.transDate > period.endStr) return false
    if (t.isPayment || t.isCredit) return false
    if (credit.merchantMatch) {
      const desc = `${t.description ?? ''} ${t.cleanDescription ?? ''}`.toUpperCase()
      return desc.includes(credit.merchantMatch)
    }
    if (credit.category) return t.category === credit.category
    return true
  })
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OptimizePage() {
  const { rules } = useCardRewardStore()
  const { credits } = useCardCreditStore()
  const { transactions } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()

  // Portal credits manually toggled — key: `${creditId}_${periodKey}`
  const [portalUsed, setPortalUsed] = useState<Record<string, boolean>>({})
  const togglePortal = (creditId: string, periodKey: string) =>
    setPortalUsed((prev) => ({
      ...prev,
      [`${creditId}_${periodKey}`]: !prev[`${creditId}_${periodKey}`],
    }))

  const cardMap     = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const personMap   = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])
  const creditCards = useMemo(() => cards.filter((c) => !c.isPaymentMethod), [cards])
  const hasRules    = rules.length > 0
  const now         = useMemo(() => new Date(), [])

  // ── Section 1: Missed Rewards ──────────────────────────────────────────────
  const missedRewards = useMemo(() => {
    if (!hasRules) return []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const spendTxns = transactions.filter(
      (t) => !t.deleted && !t.isPayment && !t.isCredit && !t.isBalancePayment && !EXCLUDED_FROM_SPEND.includes(t.category) && t.transDate >= cutoffStr,
    )

    const result: {
      date: string; merchant: string; amount: number
      cardUsed: CreditCardType | undefined; cardUsedColor: string; earned: number; earnedRate: number
      bestCard: CreditCardType | undefined; bestCardColor: string; potential: number; bestRate: number; diff: number
    }[] = []

    for (const t of spendTxns) {
      const usedCard = cardMap.get(t.cardId)
      const usedCardRules = rules.filter((r) => r.cardId === t.cardId)
      const catRule = usedCardRules.find((r) => r.category === t.category)
      const baseRule = usedCardRules.find((r) => r.category === 'base')
      const usedRule = catRule ?? baseRule
      const earnedRate = usedRule ? getEffectiveCashbackRate(usedRule) : 0
      const earned = t.amount * earnedRate
      const best = getBestCardForCategory(t.category, creditCards, rules)
      const bestRate = best?.effectiveRate ?? 0
      const potential = t.amount * bestRate
      const diff = potential - earned
      if (diff > 0.01 && best && best.card.id !== t.cardId) {
        result.push({
          date: t.transDate, merchant: t.cleanDescription || t.description, amount: t.amount,
          cardUsed: usedCard, cardUsedColor: usedCard?.color ?? '#94a3b8', earned, earnedRate,
          bestCard: best.card, bestCardColor: best.card.color, potential, bestRate, diff,
        })
      }
    }
    return result.sort((a, b) => b.diff - a.diff).slice(0, 20)
  }, [transactions, rules, cardMap, creditCards, hasRules])

  const totalMissed = useMemo(() => missedRewards.reduce((s, r) => s + r.diff, 0), [missedRewards])

  // ── Section 2: Card Recommendations ───────────────────────────────────────
  const cardRecommendations = useMemo(() => {
    if (!hasRules) return []
    const spendTxns = transactions.filter((t) => !t.deleted && !t.isPayment && !t.isCredit && !t.isBalancePayment && !EXCLUDED_FROM_SPEND.includes(t.category))
    const catSpend = new Map<string, { total: number; topPersonName: string; personTotals: Map<string, number> }>()
    for (const t of spendTxns) {
      const card = cardMap.get(t.cardId)
      const person = card ? personMap.get(card.owner) : undefined
      const name = person?.name ?? t.cardholderName ?? 'Unknown'
      if (!catSpend.has(t.category)) catSpend.set(t.category, { total: 0, topPersonName: name, personTotals: new Map() })
      const entry = catSpend.get(t.category)!
      entry.total += t.amount
      entry.personTotals.set(name, (entry.personTotals.get(name) ?? 0) + t.amount)
    }
    for (const entry of catSpend.values()) {
      let maxAmt = 0
      for (const [name, amt] of entry.personTotals) {
        if (amt > maxAmt) { maxAmt = amt; entry.topPersonName = name }
      }
    }
    const recs: { category: string; topPerson: string; total: number; bestCard: CreditCardType | null; effectiveRate: number }[] = []
    for (const [cat, data] of catSpend) {
      const best = getBestCardForCategory(cat, creditCards, rules)
      if (!best) continue
      recs.push({ category: cat, topPerson: data.topPersonName, total: data.total, bestCard: best.card, effectiveRate: best.effectiveRate })
    }
    return recs.sort((a, b) => b.total - a.total).slice(0, 8)
  }, [transactions, rules, cardMap, personMap, creditCards, hasRules])

  // ── Section 3: Annual Fee ROI ──────────────────────────────────────────────
  const feeRoi = useMemo(() => {
    // Skip AU cards — they share the primary holder's fee, don't count separately
    const cardsWithFees = creditCards.filter((c) => !c.isAuthorizedUser && c.annualFee && c.annualFee > 0)
    if (cardsWithFees.length === 0) return []
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const spendTxns = transactions.filter((t) => !t.deleted && !t.isPayment && !t.isCredit && !t.isBalancePayment && !EXCLUDED_FROM_SPEND.includes(t.category) && t.transDate >= cutoffStr)
    return cardsWithFees.map((card) => {
      const cardTxns = spendTxns.filter((t) => t.cardId === card.id)
      const cardRules = rules.filter((r) => r.cardId === card.id)
      let totalRewards = 0
      for (const t of cardTxns) {
        const catRule = cardRules.find((r) => r.category === t.category)
        const baseRule = cardRules.find((r) => r.category === 'base')
        const rule = catRule ?? baseRule
        if (rule) totalRewards += t.amount * getEffectiveCashbackRate(rule)
      }
      const annualFee = card.annualFee ?? 0
      return { card, annualFee, totalRewards, netValue: totalRewards - annualFee }
    })
  }, [creditCards, transactions, rules])

  // ── Section 4: Card Credits ────────────────────────────────────────────────
  const creditUsage = useMemo(() => {
    if (credits.length === 0) return []
    // Skip AU cards — they share the primary's credits
    const primaryCredits = credits.filter((credit) => !cardMap.get(credit.cardId)?.isAuthorizedUser)
    return primaryCredits.map((credit) => {
      const card = cardMap.get(credit.cardId)
      const period = getPeriodInfo(credit.frequency, now)
      const used = credit.creditType === 'statement'
        ? isStatementCreditUsed(credit, period, transactions)
        : (portalUsed[`${credit.id}_${period.key}`] ?? false)  // portal + in-app: manual toggle
      return { credit, card, used, period }
    })
  }, [credits, cardMap, transactions, now, portalUsed])

  // Group credits by card
  const creditsByCard = useMemo(() => {
    const map = new Map<string, typeof creditUsage>()
    for (const entry of creditUsage) {
      const key = entry.credit.cardId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }
    return map
  }, [creditUsage])

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
          <Sparkles size={20} className="text-accent-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Optimize</h1>
      </div>

      {/* Section 1: Missed Rewards */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-slate-700">Missed Rewards</h2>
            <span className="text-xs text-slate-400 ml-1">— last 90 days</span>
          </div>
          {missedRewards.length > 0 && (
            <span className="text-sm font-semibold text-orange-600">{formatCurrency(totalMissed)} left on the table</span>
          )}
        </div>
        {!hasRules ? (
          <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500">Configure card rewards in Settings → Card Rewards to see optimization tips.</div>
        ) : missedRewards.length === 0 ? (
          <div className="p-4 bg-green-50 rounded-xl text-sm text-green-700">
            Great job! You're using your best cards for all categories (or no transactions found in the last 90 days).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Merchant</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Amount</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Card Used</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Earned</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Best Card</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Potential</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-orange-500">Missed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missedRewards.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-xs text-slate-500">{r.date}</td>
                    <td className="py-2 px-3 text-slate-800 font-medium truncate max-w-[140px]">{r.merchant}</td>
                    <td className="py-2 px-3 text-right text-slate-700">{formatCurrency(r.amount)}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.cardUsedColor }} />
                        <span className="text-xs text-slate-600 truncate max-w-[80px]">{r.cardUsed?.name ?? '—'}</span>
                        <span className="text-xs text-slate-400">({(r.earnedRate * 100).toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500">{formatCurrency(r.earned)}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.bestCardColor }} />
                        <span className="text-xs text-slate-600 truncate max-w-[80px]">{r.bestCard?.name ?? '—'}</span>
                        <span className="text-xs text-slate-400">({(r.bestRate * 100).toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-slate-500">{formatCurrency(r.potential)}</td>
                    <td className="py-2 px-3 text-right text-xs font-semibold text-orange-600">+{formatCurrency(r.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Card Recommendations */}
      {hasRules && cardRecommendations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-700">Card Recommendations</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cardRecommendations.map((rec, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{rec.category}</span>
                  <span className="text-xs text-slate-400">{formatCurrency(rec.total)} spent</span>
                </div>
                {rec.bestCard && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rec.bestCard.color }} />
                    <span className="text-sm font-medium text-slate-800">{rec.bestCard.name}</span>
                    <span className="ml-auto text-xs text-accent-600 font-semibold">{(rec.effectiveRate * 100).toFixed(1)}% back</span>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1.5">Top spender: <span className="text-slate-600">{rec.topPerson}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Annual Fee ROI */}
      {feeRoi.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Annual Fee ROI</h2>
            <span className="text-xs text-slate-400 ml-1">— last 12 months of spending</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Card</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Annual Fee</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Est. Rewards</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Net Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeRoi.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.card.color }} />
                        <span className="font-medium text-slate-800">{row.card.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(row.annualFee)}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(row.totalRewards)}</td>
                    <td className={`py-3 px-3 text-right font-semibold ${row.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.netValue >= 0 ? '+' : ''}{formatCurrency(row.netValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: Card Credits */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-green-500" />
          <h2 className="text-sm font-semibold text-slate-700">Card Credits</h2>
          <span className="text-xs text-slate-400 ml-1">— per period</span>
        </div>

        {credits.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500">
            Add credits in Settings → Card Rewards to track your statement and portal credits.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Array.from(creditsByCard.entries()).map(([cardId, entries]) => {
              const card = cardMap.get(cardId)
              return (
                <div key={cardId}>
                  {/* Card header */}
                  <div className="flex items-center gap-2 mb-2">
                    {card && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: card.color }} />}
                    <span className="text-xs font-semibold text-slate-600">{card?.name ?? 'Unknown card'}</span>
                  </div>
                  <div className="flex flex-col gap-2 pl-4">
                    {entries.map(({ credit, used, period }) => {
                      const isStatement = credit.creditType === 'statement'
                      const isInApp = credit.creditType === 'in-app'
                      const isManual = !isStatement  // portal + in-app both need manual toggle
                      const daysLabel = period.daysLeft === 1 ? '1 day left' : `${period.daysLeft} days left`

                      return (
                        <div key={credit.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-800">{credit.name}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                isInApp ? 'bg-purple-100 text-purple-600'
                                : isStatement ? 'bg-green-100 text-green-600'
                                : 'bg-blue-100 text-blue-600'
                              }`}>
                                {credit.creditType}
                              </span>
                              {isInApp && (
                                <span className="text-[10px] text-slate-400">Loaded into app, not on statement</span>
                              )}
                              {!isStatement && !isInApp && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <ExternalLink size={9} /> Must use issuer portal
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {period.label} · {daysLabel}
                              {credit.notes && <span> · {credit.notes}</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-slate-700">{formatCurrency(credit.amount)}</p>
                            {isManual ? (
                              <button
                                onClick={() => togglePortal(credit.id, period.key)}
                                className={`mt-0.5 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                  used
                                    ? 'bg-green-100 text-green-700 border-green-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-green-300'
                                }`}
                              >
                                {used ? 'Used ✓' : 'Mark used'}
                              </button>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${used ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {used ? 'Used' : 'Unused'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
