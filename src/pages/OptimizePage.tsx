import { useMemo, useState } from 'react'
import { Sparkles, CreditCard, AlertCircle, TrendingUp, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { formatCurrency } from '@/utils/formatters'
import { POINT_VALUE_CENTS, EXCLUDED_FROM_SPEND } from '@/lib/constants'
import type { CardRewardRule, CardCredit, CreditCard as CreditCardType, Transaction } from '@/types'

function getEffectiveCashbackRate(rule: CardRewardRule): number {
  if (rule.rewardType === 'cashback') return rule.rewardRate
  return rule.rewardRate * POINT_VALUE_CENTS
}

type RewardMatch = {
  card: CreditCardType
  rule: CardRewardRule
  effectiveRate: number
  merchantLabel?: string
}

function titleKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .map((part) => {
      if (part === 'amzn') return 'Amazon'
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function merchantLabelFromKeywords(keywords: string[]): string | undefined {
  if (keywords.length === 0) return undefined
  const unique = Array.from(new Set(
    keywords
      .map((keyword) => {
        const normalized = keyword.toUpperCase()
        if (['AMAZON', 'AMZN'].includes(normalized)) return 'Amazon'
        if (['WHOLE FOODS', 'WHOLEFOODS', 'WHOLEFDS'].includes(normalized)) return 'Whole Foods'
        return titleKeyword(keyword)
      }),
  ))
  return `${unique.slice(0, 3).join(' / ')} only`
}

function inferredMerchantKeywords(rule: CardRewardRule, card: CreditCardType): string[] {
  const explicit = rule.merchantKeywords?.map((keyword) => keyword.trim().toUpperCase()).filter(Boolean) ?? []
  if (explicit.length > 0) return explicit

  const cardText = `${card.name} ${card.issuer} ${card.cardType} ${rule.notes ?? ''}`.toUpperCase()
  if (rule.category === 'Shopping' && cardText.includes('AMAZON')) return ['AMAZON', 'AMZN', 'WHOLE FOODS', 'WHOLEFOODS', 'WHOLEFDS']
  if (rule.category === 'Shopping' && cardText.includes('TARGET')) return ['TARGET']
  if (rule.category === 'Shopping' && cardText.includes('APPLE')) return ['APPLE', 'APPLE.COM', 'APP STORE', 'ICLOUD']
  if ((rule.category === 'Groceries' || rule.category === 'Shopping') && cardText.includes('COSTCO')) return ['COSTCO']
  if ((rule.category === 'Groceries' || rule.category === 'Shopping') && cardText.includes('WALMART')) return ['WALMART', 'WAL-MART']
  return []
}

function transactionMerchantText(transaction: Transaction): string {
  return `${transaction.cleanDescription ?? ''} ${transaction.description ?? ''}`.toUpperCase()
}

function ruleIsActive(rule: CardRewardRule, today: string): boolean {
  if (!rule.isRotating) return true
  if (rule.activeStartDate && today < rule.activeStartDate) return false
  if (rule.activeEndDate && today > rule.activeEndDate) return false
  return true
}

function ruleMatchesTransaction(
  rule: CardRewardRule,
  card: CreditCardType,
  transaction: Transaction,
  today: string,
): boolean {
  if (rule.category !== transaction.category) return false
  if (!ruleIsActive(rule, today)) return false

  const keywords = inferredMerchantKeywords(rule, card)
  if (keywords.length === 0) return true

  const merchantText = transactionMerchantText(transaction)
  return keywords.some((keyword) => merchantText.includes(keyword))
}

function getRewardForTransaction(
  card: CreditCardType,
  transaction: Transaction,
  rules: CardRewardRule[],
  today: string,
): RewardMatch | null {
  const cardRules = rules.filter((r) => r.cardId === card.id)
  const matchingRules = cardRules
    .filter((rule) => rule.category !== 'base' && ruleMatchesTransaction(rule, card, transaction, today))
    .sort((a, b) => getEffectiveCashbackRate(b) - getEffectiveCashbackRate(a))
  const rule = matchingRules[0] ?? cardRules.find((r) => r.category === 'base')
  if (!rule) return null

  const keywords = rule.category === 'base' ? [] : inferredMerchantKeywords(rule, card)
  return {
    card,
    rule,
    effectiveRate: getEffectiveCashbackRate(rule),
    merchantLabel: merchantLabelFromKeywords(keywords),
  }
}

function getBestCardForTransaction(
  transaction: Transaction,
  cards: CreditCardType[],
  rules: CardRewardRule[],
  today: string,
): RewardMatch | null {
  let best: RewardMatch | null = null
  for (const card of cards) {
    const match = getRewardForTransaction(card, transaction, rules, today)
    if (!match) continue
    if (!best || match.effectiveRate > best.effectiveRate) best = match
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
  transactions: Transaction[],
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

function formatCreditFrequency(frequency: CardCredit['frequency']): string {
  if (frequency === 'semi-annual') return 'semi-annual'
  return frequency
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OptimizePage() {
  const { rules } = useCardRewardStore()
  const { credits } = useCardCreditStore()
  const { transactions } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()

  const [missedRewardsExpanded, setMissedRewardsExpanded] = useState(false)
  const [expandedCreditCards, setExpandedCreditCards] = useState<Set<string>>(new Set())

  // Portal credits manually toggled — key: `${creditId}_${periodKey}`
  const [portalUsed, setPortalUsed] = useState<Record<string, boolean>>({})
  const togglePortal = (creditId: string, periodKey: string) =>
    setPortalUsed((prev) => ({
      ...prev,
      [`${creditId}_${periodKey}`]: !prev[`${creditId}_${periodKey}`],
    }))

  const toggleCreditCard = (cardId: string) => {
    setExpandedCreditCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

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
    const today = new Date().toISOString().slice(0, 10)

    const result: {
      date: string; merchant: string; category: string; amount: number
      cardUsed: CreditCardType | undefined; cardUsedColor: string; earned: number; earnedRate: number
      bestCard: CreditCardType | undefined; bestCardColor: string; potential: number; bestRate: number; diff: number
    }[] = []

    for (const t of spendTxns) {
      const usedCard = cardMap.get(t.cardId)
      const usedReward = usedCard ? getRewardForTransaction(usedCard, t, rules, today) : null
      const earnedRate = usedReward?.effectiveRate ?? 0
      const earned = t.amount * earnedRate
      const best = getBestCardForTransaction(t, creditCards, rules, today)
      const bestRate = best?.effectiveRate ?? 0
      const potential = t.amount * bestRate
      const diff = potential - earned
      if (diff > 0.01 && best && best.card.id !== t.cardId) {
        result.push({
          date: t.transDate, merchant: t.cleanDescription || t.description, category: t.category, amount: t.amount,
          cardUsed: usedCard, cardUsedColor: usedCard?.color ?? '#94a3b8', earned, earnedRate,
          bestCard: best.card, bestCardColor: best.card.color, potential, bestRate, diff,
        })
      }
    }
    return result.sort((a, b) => b.diff - a.diff).slice(0, 20)
  }, [transactions, rules, cardMap, creditCards, hasRules])

  const totalMissed = useMemo(() => missedRewards.reduce((s, r) => s + r.diff, 0), [missedRewards])
  const missedRewardsSummary = useMemo(() => {
    if (missedRewards.length === 0) return null

    const dates = missedRewards.map((reward) => new Date(`${reward.date}T00:00:00`).getTime()).filter(Number.isFinite)
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)
    const dateRangeDays = dates.length > 0 ? Math.max(1, Math.round((maxDate - minDate) / 86_400_000) + 1) : 90
    const months = Math.max(1, dateRangeDays / 30.4375)
    const monthlyAverage = totalMissed / months

    const categoryTotals = new Map<string, number>()
    const cardTotals = new Map<string, number>()
    for (const reward of missedRewards) {
      categoryTotals.set(reward.category, (categoryTotals.get(reward.category) ?? 0) + reward.diff)
      if (reward.bestCard?.name) cardTotals.set(reward.bestCard.name, (cardTotals.get(reward.bestCard.name) ?? 0) + reward.diff)
    }

    const topCategory = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topCard = Array.from(cardTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topHint = [topCategory, topCard].filter(Boolean).join(' · ')

    return { monthlyAverage, topHint }
  }, [missedRewards, totalMissed])

  const visibleMissedRewards = missedRewardsExpanded ? missedRewards : missedRewards.slice(0, 5)

  // ── Section 2: Card Recommendations ───────────────────────────────────────
  const cardRecommendations = useMemo(() => {
    if (!hasRules) return []
    const spendTxns = transactions.filter((t) => !t.deleted && !t.isPayment && !t.isCredit && !t.isBalancePayment && !EXCLUDED_FROM_SPEND.includes(t.category))
    const today = new Date().toISOString().slice(0, 10)
    const catSpend = new Map<string, { total: number; topPersonName: string; personTotals: Map<string, number>; transactions: Transaction[] }>()
    for (const t of spendTxns) {
      const card = cardMap.get(t.cardId)
      const person = card ? personMap.get(card.owner) : undefined
      const name = person?.name ?? t.cardholderName ?? 'Unknown'
      if (!catSpend.has(t.category)) catSpend.set(t.category, { total: 0, topPersonName: name, personTotals: new Map(), transactions: [] })
      const entry = catSpend.get(t.category)!
      entry.total += t.amount
      entry.transactions.push(t)
      entry.personTotals.set(name, (entry.personTotals.get(name) ?? 0) + t.amount)
    }
    for (const entry of catSpend.values()) {
      let maxAmt = 0
      for (const [name, amt] of entry.personTotals) {
        if (amt > maxAmt) { maxAmt = amt; entry.topPersonName = name }
      }
    }
    const recs: {
      category: string
      topPerson: string
      total: number
      bestCard: CreditCardType | null
      effectiveRate: number
      merchantLabels: string[]
    }[] = []
    for (const [cat, data] of catSpend) {
      let bestCard: CreditCardType | null = null
      let bestRewards = 0
      let bestLabels: string[] = []

      for (const card of creditCards) {
        let rewards = 0
        let hasMatchingRule = false
        const labels = new Set<string>()

        for (const transaction of data.transactions) {
          const match = getRewardForTransaction(card, transaction, rules, today)
          if (!match) continue
          hasMatchingRule = true
          rewards += transaction.amount * match.effectiveRate
          if (match.merchantLabel) labels.add(match.merchantLabel)
        }

        if (!hasMatchingRule) continue
        if (!bestCard || rewards > bestRewards) {
          bestCard = card
          bestRewards = rewards
          bestLabels = Array.from(labels)
        }
      }

      if (!bestCard) continue
      recs.push({
        category: cat,
        topPerson: data.topPersonName,
        total: data.total,
        bestCard,
        effectiveRate: data.total > 0 ? bestRewards / data.total : 0,
        merchantLabels: bestLabels,
      })
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
    const today = new Date().toISOString().slice(0, 10)
    const spendTxns = transactions.filter((t) => !t.deleted && !t.isPayment && !t.isCredit && !t.isBalancePayment && !EXCLUDED_FROM_SPEND.includes(t.category) && t.transDate >= cutoffStr)
    return cardsWithFees.map((card) => {
      const cardTxns = spendTxns.filter((t) => t.cardId === card.id)
      let totalRewards = 0
      for (const t of cardTxns) {
        const match = getRewardForTransaction(card, t, rules, today)
        if (match) totalRewards += t.amount * match.effectiveRate
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
          {missedRewardsSummary && (
            <div className="text-right">
              <p className="text-sm font-semibold text-orange-600">
                {formatCurrency(totalMissed)} left on the table
                <span className="text-orange-500 font-medium"> (≈ {formatCurrency(missedRewardsSummary.monthlyAverage)}/month)</span>
              </p>
              {missedRewardsSummary.topHint && (
                <p className="text-xs text-slate-400 mt-0.5">Mostly from {missedRewardsSummary.topHint}</p>
              )}
            </div>
          )}
        </div>
        {!hasRules ? (
          <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500">Configure card rewards in Settings → Card Rewards to see optimization tips.</div>
        ) : missedRewards.length === 0 ? (
          <div className="p-4 bg-green-50 rounded-xl text-sm text-green-700">
            Great job! You're using your best cards for all categories (or no transactions found in the last 90 days).
          </div>
        ) : (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {visibleMissedRewards.map((r, i) => {
                const rateDiff = r.bestRate - r.earnedRate
                return (
                  <div key={`${r.date}-${r.merchant}-${i}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 bg-white">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 truncate">{r.merchant}</span>
                        <span className="text-xs text-slate-400 shrink-0">{r.date}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>{formatCurrency(r.amount)}</span>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.cardUsedColor }} />
                          {r.cardUsed?.name ?? 'Unknown card'} {(r.earnedRate * 100).toFixed(1)}%
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="inline-flex items-center gap-1 text-accent-700">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.bestCardColor }} />
                          {r.bestCard?.name ?? 'Best card'} {(r.bestRate * 100).toFixed(1)}%
                        </span>
                        <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-orange-700">
                          +{(rateDiff * 100).toFixed(1)} pts
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-orange-600 shrink-0 self-center">
                      +{formatCurrency(r.diff)}
                    </span>
                  </div>
                )
              })}
            </div>

            {missedRewards.length > 5 && (
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 text-center">
                <button
                  type="button"
                  onClick={() => setMissedRewardsExpanded((expanded) => !expanded)}
                  className="text-sm font-medium text-accent-700 hover:text-accent-800"
                >
                  {missedRewardsExpanded ? 'Show less' : 'Show all missed rewards'}
                </button>
              </div>
            )}
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
                    <span className="ml-auto text-xs text-accent-600 font-semibold">{(rec.effectiveRate * 100).toFixed(1)}% avg</span>
                  </div>
                )}
                {rec.merchantLabels.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">{rec.merchantLabels.slice(0, 2).join(', ')}</p>
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
          <div className="flex flex-col gap-3">
            {Array.from(creditsByCard.entries()).map(([cardId, entries]) => {
              const card = cardMap.get(cardId)
              const expanded = expandedCreditCards.has(cardId)
              const totalCreditValue = entries.reduce((sum, entry) => sum + entry.credit.amount, 0)

              return (
                <div key={cardId} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCreditCard(cardId)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    {expanded ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                    {card && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: card.color }} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate">{card?.name ?? 'Unknown card'}</span>
                        <span className="text-xs text-slate-400 shrink-0">Credits & Offers</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {entries.length} credit{entries.length !== 1 ? 's' : ''} · {formatCurrency(totalCreditValue)} tracked
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {entries.map(({ credit, used, period }) => {
                          const isStatement = credit.creditType === 'statement'
                          const isInApp = credit.creditType === 'in-app'
                          const isManual = !isStatement  // portal + in-app both need manual toggle
                          const daysLabel = period.daysLeft === 1 ? '1 day left' : `${period.daysLeft} days left`

                          return (
                            <div key={credit.id} className="flex items-start gap-3 rounded-lg bg-white border border-slate-100 px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-slate-800">{credit.name}</p>
                                  <span className="text-xs text-slate-500">
                                    {formatCurrency(credit.amount)}/{formatCreditFrequency(credit.frequency)}
                                  </span>
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
                                {isManual ? (
                                  <button
                                    onClick={() => togglePortal(credit.id, period.key)}
                                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                      used
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-green-300'
                                    }`}
                                  >
                                    {used ? 'Used' : 'Mark used'}
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
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
