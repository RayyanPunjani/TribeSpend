interface ClassificationInput {
  description: string
  amount: number
  categoryHint?: string
  typeHint?: string
  isPaymentHint?: boolean
  isCreditHint?: boolean
  isBalancePaymentHint?: boolean
}

interface TransactionClassification {
  category?: string
  isPayment: boolean
  isCredit: boolean
  isBalancePayment: boolean
  refundReviewPending: boolean
}

const INCOMING_CREDIT_PATTERN = /\b(zelle|venmo|paypal|cash\s*app|cashapp|refund|returned|ach\s+credit|credit\s+received|deposit)\b/i
const REFUND_PATTERN = /\b(refund|returned|credit\s+adj|credit\s+adjustment)\b/i
const BALANCE_PAYMENT_PATTERN =
  /\b(autopay|auto\s+pay|payment\s+thank\s+you|thank\s+you.*payment|credit\s+card|card\s+payment|online\s+payment|payment\s+received|ba\s+electronic\s+pmt|web\s+pay|balance\s+transfer|payment)\b/i
const BALANCE_PAYMENT_HINT_PATTERN = /\b(payment|autopay|credit\s+card\s+payment|card\s+payment|loan\s+payment)\b/i

export function classifyCreditAndPayment(input: ClassificationInput): TransactionClassification {
  const description = input.description || ''
  const categoryHint = input.categoryHint || ''
  const typeHint = input.typeHint || ''
  const hintText = `${categoryHint} ${typeHint}`
  const amount = Number(input.amount) || 0

  const hasIncomingCreditKeyword = INCOMING_CREDIT_PATTERN.test(description)
  const hasBalancePaymentKeyword = BALANCE_PAYMENT_PATTERN.test(description)
  const hasBalancePaymentHint =
    input.isPaymentHint === true ||
    input.isBalancePaymentHint === true ||
    BALANCE_PAYMENT_HINT_PATTERN.test(hintText)

  const isIncomingCredit =
    (amount < 0 && hasIncomingCreditKeyword) ||
    (!hasBalancePaymentHint && !hasBalancePaymentKeyword && amount < 0) ||
    (!hasBalancePaymentHint && input.isCreditHint === true && !hasBalancePaymentKeyword)

  if (isIncomingCredit) {
    return {
      category: REFUND_PATTERN.test(description) ? 'Refunds & Credits' : 'Transfer',
      isPayment: false,
      isCredit: true,
      isBalancePayment: false,
      refundReviewPending: true,
    }
  }

  if (hasBalancePaymentHint || hasBalancePaymentKeyword) {
    return {
      category: 'Credit Card Payment',
      isPayment: true,
      isCredit: false,
      isBalancePayment: true,
      refundReviewPending: false,
    }
  }

  return {
    isPayment: false,
    isCredit: false,
    isBalancePayment: false,
    refundReviewPending: false,
  }
}
