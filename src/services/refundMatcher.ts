import type { Transaction } from '@/types'

interface RefundMatchResult {
  updatedRefunds: Transaction[]
  updatedOriginals: Transaction[]
  autoMatched: number
  pendingReview: number
}

const REFUND_CATEGORY = 'Refunds & Credits'
const LOOKBACK_DAYS = 90
const AMOUNT_TOLERANCE = 0.01
const MS_PER_DAY = 24 * 60 * 60 * 1000

function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+\b(?:llc|inc|co|corp)\b$/i, '')
    .trim()
}

function dateMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const ms = Date.UTC(year, month - 1, day)
  return Number.isFinite(ms) ? ms : 0
}

function getMerchant(t: Transaction): string {
  return normalizeMerchant(t.cleanDescription || t.description)
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
    const candidates = existingTransactions
      .filter((candidate) => {
        if (!isPriorPurchase(candidate, refund, matchedOriginalIds)) return false
        if (getMerchant(candidate) !== refundMerchant) return false
        return Math.abs(Math.abs(candidate.amount) - refundAmount) <= AMOUNT_TOLERANCE
      })
      .sort((a, b) => dateMs(b.transDate) - dateMs(a.transDate))

    if (candidates.length === 0) {
      updatedRefunds.push({
        ...refund,
        refundForId: null,
        refundReviewPending: true,
      })
      pendingReview += 1
      continue
    }

    const original = candidates[0]
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
