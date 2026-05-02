// ─── Core Data Models ────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  transDate: string        // ISO date string (YYYY-MM-DD)
  postDate: string         // ISO date string
  description: string      // Raw description from statement
  cleanDescription: string // AI-cleaned merchant name
  amount: number           // Always in USD (positive = charge, negative = payment/credit)
  originalAmount?: number  // Foreign currency amount if applicable
  originalCurrency?: string
  exchangeRate?: number
  category: string
  cardId: string
  cardholderName: string
  isPayment: boolean
  isCredit: boolean
  isBalancePayment?: boolean   // true for autopay/balance transfers — hidden by default
  statementId: string
  reimbursementStatus: 'none' | 'pending' | 'partial' | 'settled'
  reimbursementAmount?: number
  reimbursementPerson?: string
  reimbursementPaid: boolean
  reimbursementNote?: string
  highlightColor?: string
  isRecurring?: boolean
  notes?: string
  categoryConfidence?: 'high' | 'medium' | 'low'
  ruleMatched?: boolean        // true if categorized via a local CategoryRule
  deleted?: boolean            // soft-delete flag
  isManualEntry?: boolean      // true if entered by user (not parsed)
  source?: 'csv' | 'pdf' | 'plaid' | 'manual'  // import origin
  plaidTransactionId?: string  // Plaid's transaction ID for dedup
  expectingReturn?: boolean    // user flagged this charge as expecting a refund
  expectedReturnAmount?: number
  expectedReturnNote?: string
  returnStatus?: 'pending' | 'completed'
  returnMatchedTransactionId?: string  // ID of the credit transaction that closed it
  refundForId: string | null           // ID of the original purchase this refund/credit matches
  hasRefund: boolean                   // true when this purchase has a matched refund
  refundReviewPending: boolean         // true when refund matching needs user review
  spendType?: 'shared' | 'personal'
  recurringAutoDetected?: boolean   // true if flagged by auto-detection, not the user
  recurringDismissed?: boolean      // true if user explicitly un-flagged an auto-detected recurring
}

export interface CreditCard {
  id: string
  name: string          // e.g., "Rayyan's Venture X"
  issuer: string        // e.g., "Capital One"
  cardType: string      // e.g., "Venture X"
  lastFour: string
  owner: string         // Person ID
  color: string         // Hex color
  isPaymentMethod?: boolean  // true for Cash, Zelle, Venmo, etc.
  annualFee?: number
  isAuthorizedUser: boolean  // if true, this card skips annual fee + credits in Optimize
  isCustomName: boolean // true when the user manually edited the display name
}

export interface Person {
  id: string
  name: string
  color: string
  cards: string[]       // Card IDs
}

export interface Statement {
  id: string
  fileName: string
  uploadDate: string
  cardId: string
  statementStartDate: string
  statementEndDate: string
  totalTransactions: number
  totalAmount: number
  rawText: string
}

export interface CategoryRule {
  id: string
  merchantPattern: string      // Normalized match key, e.g., "dallas masjid"
  rawDescriptionExample: string
  cleanDescription: string     // User-confirmed clean name
  category: string
  createdAt: string
  source: 'user_correction' | 'ai_confirmed'
  matchCount?: number          // How many transactions matched
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  anthropicApiKey: string
  anthropicModel: string       // default: claude-sonnet-4-20250514
  onboardingComplete: boolean
}

// ─── AI Parsing Models ───────────────────────────────────────────────────────

export interface ParsedTransactionRaw {
  trans_date: string
  post_date: string
  raw_description: string
  clean_description: string
  amount: number
  original_amount: number | null
  original_currency: string | null
  exchange_rate: number | null
  category: string
  is_payment_or_credit: boolean
  is_balance_payment?: boolean
  is_recurring: boolean
  category_confidence: 'high' | 'medium' | 'low'
  cardholder_name?: string
  cardholder_last_four?: string
}

export interface ParsedCardholder {
  name: string
  last_four: string
  transactions: ParsedTransactionRaw[]
}

export interface ParsedStatement {
  statement_info: {
    issuer: string
    card_type: string
    statement_start_date: string
    statement_end_date: string
  }
  cardholders: ParsedCardholder[]
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

export type CsvBankFormat =
  | 'capital-one'
  | 'chase'
  | 'bank-of-america'
  | 'amex'
  | 'discover'
  | 'citi'
  | 'robinhood'
  | 'unknown'

export interface CsvColumnMapping {
  id: string
  // fingerprint: sorted joined header string
  headerFingerprint: string
  bankHint: string          // display name for saved mapping
  mapping: Record<string, CsvFieldRole>
  createdAt: string
}

export type CsvFieldRole =
  | 'date'
  | 'postDate'
  | 'description'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'category'
  | 'cardNumber'
  | 'cardholder'
  | 'status'
  | 'skip'

export interface CsvParsedRow {
  transDate: string        // YYYY-MM-DD
  postDate: string         // YYYY-MM-DD
  description: string
  cleanDescription: string
  amount: number           // positive = charge, negative = credit/payment
  category: string         // our taxonomy or 'Needs Review'
  isPayment: boolean
  isCredit: boolean
  isBalancePayment: boolean
  refundReviewPending?: boolean
  cardLastFour?: string
  cardholderName?: string
  notes?: string
}

// ─── Filter/View State ────────────────────────────────────────────────────────

export interface TransactionFilters {
  personIds: string[]
  cardIds: string[]
  categories: string[]
  dateStart: string
  dateEnd: string
  amountMin: string
  amountMax: string
  search: string
  showPayments: boolean
  showReimbursements: boolean
  recurringOnly: boolean
  needsReviewOnly: boolean
  showDeleted: boolean
  showBalancePayments: boolean
}

export interface ReimbursementSummary {
  person: string
  totalOwed: number
  totalPaid: number
  outstanding: number
  transactions: Transaction[]
}

export interface CardRewardRule {
  id: string
  cardId: string
  category: string   // spending category OR 'base' for default rate
  merchantKeywords?: string[] // optional uppercase keywords; rule applies only to matching merchants/descriptions
  rewardType: 'cashback' | 'points'
  rewardRate: number // e.g. 0.03 for 3% cashback, or 3 for 3x points
  isRotating?: boolean
  activeStartDate?: string
  activeEndDate?: string
  notes?: string
}

export interface CardCredit {
  id: string
  cardId: string
  name: string                   // e.g. "Uber Credit", "Travel Credit"
  amount: number                 // total amount per period (e.g. 300 for $300/yr, 15 for $15/mo)
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
  creditType: 'statement' | 'portal' | 'in-app'  // statement = auto-applied; portal = must use issuer portal; in-app = loaded into 3rd-party app (e.g. Uber Cash)
  category?: string              // optional spending category for auto-detection
  merchantMatch?: string         // uppercase keyword to match against transaction descriptions
  notes?: string
  cardAnniversaryBased?: boolean // resets on card anniversary vs calendar year/month
}
