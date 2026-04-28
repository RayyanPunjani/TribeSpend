import type { Transaction } from '@/types'
import { normalizeMerchantKey, normalizeMerchantName } from '@/lib/merchantNormalize'

interface RefundMatchResult {
  updatedRefunds: Transaction[]
  updatedOriginals: Transaction[]
  autoMatched: number
  pendingReview: number
}

export interface RankedRefundCandidate {
  transaction: Transaction
  canonicalMerchant: string
  confidence: 'high' | 'medium' | 'low'
  score: number
  amountExact: boolean
  merchantMatch: boolean
  daysBeforeRefund: number
  sameCard: boolean
  sameCardholder: boolean
}

const REFUND_CATEGORY = 'Refunds & Credits'
const LOOKBACK_DAYS = 90
const AMOUNT_TOLERANCE = 0.01
const MS_PER_DAY = 24 * 60 * 60 * 1000

function dateMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const ms = Date.UTC(year, month - 1, day)
  return Number.isFinite(ms) ? ms : 0
}

function getMerchant(t: Transaction): string {
  return normalizeMerchantKey(`${t.cleanDescription || ''} ${t.description || ''}`)
}

function isPriorPurchase(candidate: Transaction, refund: Transaction, matchedOriginalIds: Set<string>): boolean {
  if (candidate.deleted) return false
  if (candidate.isPayment || candidate.isCredit || candidate.isBalancePayment) return false
  if (candidate.amount <= 0) return false
  if (candidate.hasRefund || matchedOriginalIds.has(candidate.id)) return false

  const refundDate = dateMs(refund.transDate)
  const candidateDate = dateMs(candidate.transDate)
  if (!refundDate || !candidateDate) return false
  if (candidateDate > refundDate) return false
  return refundDate - candidateDate <= LOOKBACK_DAYS * MS_PER_DAY
}

function rankCandidate(candidate: Transaction, refund: Transaction): RankedRefundCandidate | null {
  const refundDate = dateMs(refund.transDate)
  const candidateDate = dateMs(candidate.transDate)
  if (!refundDate || !candidateDate || candidateDate > refundDate) return null

  const daysBeforeRefund = Math.round((refundDate - candidateDate) / MS_PER_DAY)
  const amountExact = Math.abs(Math.abs(candidate.amount) - Math.abs(refund.amount)) <= AMOUNT_TOLERANCE
  const merchantMatch = getMerchant(candidate) === getMerchant(refund)
  const sameCard = !!refund.cardId && refund.cardId === candidate.cardId
  const sameCardholder = !!refund.cardholderName && refund.cardholderName === candidate.cardholderName
  const dateScore = Math.max(0, 14 - Math.min(daysBeforeRefund, LOOKBACK_DAYS) / 7)

  let score = dateScore
  if (amountExact) score += 50
  if (merchantMatch) score += 35
  if (sameCard) score += 8
  if (sameCardholder) score += 5

  const confidence: RankedRefundCandidate['confidence'] =
    amountExact && merchantMatch ? 'high' :
    amountExact || merchantMatch ? 'medium' :
    'low'

  return {
    transaction: candidate,
    canonicalMerchant: normalizeMerchantName(candidate.cleanDescription || candidate.description),
    confidence,
    score,
    amountExact,
    merchantMatch,
    daysBeforeRefund,
    sameCard,
    sameCardholder,
  }
}

export function getRefundMatchCandidates(
  refund: Transaction,
  transactions: Transaction[],
  options: { lookbackDays?: number; includeRefunded?: boolean } = {},
): RankedRefundCandidate[] {
  const lookbackDays = options.lookbackDays ?? LOOKBACK_DAYS
  const refundDate = dateMs(refund.transDate)

  return transactions
    .filter((candidate) => {
      if (candidate.id === refund.id) return false
      const candidateDate = dateMs(candidate.transDate)
      if (candidate.deleted) return false
      if (candidate.isPayment || candidate.isCredit || candidate.isBalancePayment) return false
      if (candidate.amount <= 0) return false
      if (!options.includeRefunded && candidate.hasRefund) return false
      if (!refundDate || !candidateDate || candidateDate > refundDate) return false
      return refundDate - candidateDate <= lookbackDays * MS_PER_DAY
    })
    .map((candidate) => rankCandidate(candidate, refund))
    .filter((candidate): candidate is RankedRefundCandidate => !!candidate)
    .sort((a, b) =>
      b.score - a.score ||
      Number(b.amountExact) - Number(a.amountExact) ||
      Number(b.merchantMatch) - Number(a.merchantMatch) ||
      dateMs(b.transaction.transDate) - dateMs(a.transaction.transDate),
    )
}

export function matchRefunds(
  newTransactions: Transaction[],
  existingTransactions: Transaction[],
): RefundMatchResult {
  const updatedRefunds: Transaction[] = []
  const originalsById = new Map<string, Transaction>()
  const matchedOriginalIds = new Set<string>()
  let autoMatched = 0
  let pendingReview = 0

  for (const refund of newTransactions) {
    if (refund.category !== REFUND_CATEGORY) continue

    const refundAmount = Math.abs(refund.amount)
    const refundMerchant = getMerchant(refund)
    const candidates = getRefundMatchCandidates(refund, existingTransactions)
      .filter(({ transaction, amountExact, merchantMatch }) => {
        if (!isPriorPurchase(transaction, refund, matchedOriginalIds)) return false
        if (!merchantMatch || getMerchant(transaction) !== refundMerchant) return false
        return amountExact && Math.abs(Math.abs(transaction.amount) - refundAmount) <= AMOUNT_TOLERANCE
      })

    if (candidates.length === 0) {
      updatedRefunds.push({
        ...refund,
        refundForId: null,
        refundReviewPending: true,
      })
      pendingReview += 1
      continue
    }

    const original = candidates[0].transaction
    matchedOriginalIds.add(original.id)
    originalsById.set(original.id, { ...original, hasRefund: true })

    if (candidates.length === 1) {
      updatedRefunds.push({
        ...refund,
        refundForId: original.id,
        refundReviewPending: false,
      })
      autoMatched += 1
    } else {
      updatedRefunds.push({
        ...refund,
        refundForId: original.id,
        refundReviewPending: true,
      })
      pendingReview += 1
    }
  }

  return {
    updatedRefunds,
    updatedOriginals: Array.from(originalsById.values()),
    autoMatched,
    pendingReview,
  }
}
