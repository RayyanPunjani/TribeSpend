import Papa from 'papaparse'
import type { CsvBankFormat, CsvParsedRow, CsvColumnMapping, CsvFieldRole } from '@/types'
import { normalizeMerchantName } from '@/lib/merchantNormalize'
import { classifyCreditAndPayment } from '@/services/transactionClassifier'
// CSV mappings stored in localStorage
const CSV_MAPPINGS_KEY = 'tribespend_csv_mappings'

// ─── Date Normalization ───────────────────────────────────────────────────────

function parseDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const [, m, d, y] = mdy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM/DD/YY
  const mdyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (mdyy) {
    const [, m, d, y] = mdyy
    const full = parseInt(y) >= 50 ? `19${y}` : `20${y}`
    return `${full}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM-DD-YYYY
  const mddash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (mddash) {
    const [, m, d, y] = mddash
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return s
}

// ─── Amount Helpers ───────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return 0
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '')
  // Some banks use parentheses for negatives
  const isNeg = raw.includes('(') || raw.trim().startsWith('-')
  const val = parseFloat(cleaned) || 0
  return isNeg && val > 0 ? -val : val
}

// ─── Clean merchant name helpers ──────────────────────────────────────────────

function cleanMerchant(raw: string): string {
  let s = raw.trim()
  // Strip AplPay / Apple Pay prefix
  s = s.replace(/^AplPay\s+/i, '')
  s = s.replace(/^Apple Pay\s+/i, '')
  return normalizeMerchantName(s)
}

// ─── Balance Payment Detection ────────────────────────────────────────────────

const BALANCE_PAYMENT_PATTERNS = [
  /autopay/i,
  /auto pay/i,
  /payment thank you/i,
  /thank you.*payment/i,
  /payment received/i,
  /online payment/i,
  /ba electronic pmt/i,
  /web pay/i,
  /balance transfer/i,
  /\bpayment\b.*\bfrom\b/i,
]

function isBalancePayment(description: string, isPayment: boolean): boolean {
  if (!isPayment) return false
  return BALANCE_PAYMENT_PATTERNS.some((p) => p.test(description))
}

function applyCreditPaymentClassification(row: CsvParsedRow): CsvParsedRow {
  const classification = classifyCreditAndPayment({
    description: row.description,
    amount: row.amount,
    categoryHint: row.category,
    isPaymentHint: row.isPayment,
    isCreditHint: row.isCredit,
    isBalancePaymentHint: row.isBalancePayment,
  })

  return {
    ...row,
    category: classification.category ?? row.category,
    isPayment: classification.isPayment,
    isCredit: classification.isCredit,
    isBalancePayment: classification.isBalancePayment,
    refundReviewPending: classification.refundReviewPending,
  }
}

// ─── Known Format Definitions ─────────────────────────────────────────────────

interface FormatDef {
  id: CsvBankFormat
  requiredHeaders: string[]
  parse: (row: Record<string, string>) => CsvParsedRow | null
}

const FORMATS: FormatDef[] = [
  // ── Capital One ────────────────────────────────────────────────────────────
  {
    id: 'capital-one',
    requiredHeaders: ['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit'],
    parse(row) {
      const debit = parseAmount(row['Debit'])
      const credit = parseAmount(row['Credit'])
      const amount = debit > 0 ? debit : -Math.abs(credit)
      const desc = row['Description'] ?? ''
      const cat = row['Category'] ?? ''
      const isPayment = cat.toLowerCase().includes('payment')
      return {
        transDate: parseDate(row['Transaction Date']),
        postDate: parseDate(row['Posted Date']),
        description: desc,
        cleanDescription: cleanMerchant(desc),
        amount,
        category: 'Needs Review',
        isPayment,
        isCredit: credit > 0,
        isBalancePayment: isBalancePayment(desc, isPayment),
        cardLastFour: String(row['Card No.'] ?? '').slice(-4),
      }
    },
  },

  // ── Chase ──────────────────────────────────────────────────────────────────
  {
    id: 'chase',
    requiredHeaders: ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount'],
    parse(row) {
      // Chase: negative = purchase, positive = payment — flip sign
      const raw = parseAmount(row['Amount'])
      const amount = -raw
      const desc = row['Description'] ?? ''
      const type = row['Type'] ?? ''
      const isPayment = type === 'Payment' || /automatic payment/i.test(desc)
      const isCredit = amount < 0 && !isPayment
      return {
        transDate: parseDate(row['Transaction Date']),
        postDate: parseDate(row['Post Date']),
        description: desc,
        cleanDescription: cleanMerchant(desc),
        amount,
        category: mapChaseCategory(row['Category'] ?? ''),
        isPayment,
        isCredit,
        isBalancePayment: isBalancePayment(desc, isPayment),
      }
    },
  },

  // ── Bank of America ────────────────────────────────────────────────────────
  {
    id: 'bank-of-america',
    requiredHeaders: ['Posted Date', 'Reference Number', 'Payee', 'Address', 'Amount'],
    parse(row) {
      // BofA: negative = purchase, positive = credit — flip sign
      const raw = parseAmount(row['Amount'])
      const amount = -raw
      const desc = row['Payee'] ?? ''
      const isPayment = /payment|autopay|ba electronic pmt/i.test(desc)
      const isCredit = amount < 0 && !isPayment
      const notes = row['Address'] ? row['Address'].trim() : undefined
      return {
        transDate: parseDate(row['Posted Date']),
        postDate: parseDate(row['Posted Date']),
        description: desc,
        cleanDescription: cleanMerchant(desc),
        amount,
        category: 'Needs Review',
        isPayment,
        isCredit,
        isBalancePayment: isBalancePayment(desc, isPayment),
        notes,
      }
    },
  },

  // ── American Express ───────────────────────────────────────────────────────
  {
    id: 'amex',
    requiredHeaders: ['Date', 'Description', 'Amount', 'Extended Details', 'Appears On Your Statement As', 'Address', 'City/State', 'Zip Code', 'Country', 'Reference', 'Category'],
    parse(row) {
      // Amex: positive = purchase, negative = credit — do NOT flip
      const amount = parseAmount(row['Amount'])
      const desc = row['Description'] ?? ''
      const strippedDesc = desc.replace(/^AplPay\s+/i, '').trim()
      const isPayment = /autopay payment|payment.*thank you/i.test(desc)
      const isCredit = amount < 0 && !isPayment
      return {
        transDate: parseDate(row['Date']),
        postDate: parseDate(row['Date']),
        description: desc,
        cleanDescription: cleanMerchant(strippedDesc),
        amount,
        category: mapAmexCategory(row['Category'] ?? '', amount),
        isPayment,
        isCredit,
        isBalancePayment: isBalancePayment(desc, isPayment),
      }
    },
  },

  // ── Discover ───────────────────────────────────────────────────────────────
  {
    id: 'discover',
    requiredHeaders: ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category'],
    parse(row) {
      // Discover: positive = purchase, negative = credit
      const amount = parseAmount(row['Amount'])
      const desc = row['Description'] ?? ''
      const isPayment = /payment|autopay/i.test(desc)
      const isCredit = amount < 0 && !isPayment
      return {
        transDate: parseDate(row['Trans. Date']),
        postDate: parseDate(row['Post Date']),
        description: desc,
        cleanDescription: cleanMerchant(desc),
        amount,
        category: 'Needs Review',
        isPayment,
        isCredit,
        isBalancePayment: isBalancePayment(desc, isPayment),
      }
    },
  },

  // ── Citi ───────────────────────────────────────────────────────────────────
  {
    id: 'citi',
    requiredHeaders: ['Status', 'Date', 'Description', 'Debit', 'Credit'],
    parse(row) {
      const status = row['Status'] ?? ''
      if (status && !['Cleared', 'Posted', ''].includes(status)) return null
      const debit = parseAmount(row['Debit'])
      const credit = parseAmount(row['Credit'])
      const amount = debit > 0 ? debit : -Math.abs(credit)
      const desc = row['Description'] ?? ''
      const isPayment = /payment|autopay/i.test(desc)
      return {
        transDate: parseDate(row['Date']),
        postDate: parseDate(row['Date']),
        description: desc,
        cleanDescription: cleanMerchant(desc),
        amount,
        category: 'Needs Review',
        isPayment,
        isCredit: credit > 0,
        isBalancePayment: isBalancePayment(desc, isPayment),
      }
    },
  },

  // ── Robinhood ──────────────────────────────────────────────────────────────
  {
    id: 'robinhood',
    requiredHeaders: ['Date', 'Time', 'Cardholder', 'Amount', 'Points', 'Balance', 'Status', 'Type', 'Merchant', 'Description'],
    parse(row) {
      if (row['Status'] === 'Declined') return null
      const amount = parseAmount(row['Amount'])
      const type = row['Type'] ?? ''
      const isPayment = type === 'Payment'
      const isCredit = type === 'Refund'
      return {
        transDate: parseDate(row['Date']),
        postDate: parseDate(row['Date']),
        description: row['Description'] ?? '',
        cleanDescription: cleanMerchant(row['Merchant'] ?? row['Description'] ?? ''),
        amount,
        category: 'Needs Review',
        isPayment,
        isCredit,
        isBalancePayment: isBalancePayment(row['Description'] ?? '', isPayment),
        cardholderName: row['Cardholder'],
      }
    },
  },
]

// ─── Bank Category Mappers ────────────────────────────────────────────────────

function mapChaseCategory(cat: string): string {
  const map: Record<string, string> = {
    'Food & Drink': 'Dining',
    'Groceries': 'Groceries',
    'Travel': 'Travel',
    'Gas': 'Gas & EV Charging',
    'Shopping': 'Shopping',
    'Entertainment': 'Entertainment',
    'Health & Wellness': 'Health & Medical',
    'Home': 'Home & Utilities',
    'Professional Services': 'Other',
    'Personal': 'Personal Care',
    'Education': 'Education',
    'Utilities': 'Home & Utilities',
    'Automotive': 'Transportation',
  }
  for (const [key, val] of Object.entries(map)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return val
  }
  return cat ? 'Needs Review' : 'Needs Review'
}

function mapAmexCategory(cat: string, amount: number): string {
  if (!cat) return 'Needs Review'
  const c = cat.toLowerCase()
  if (c.includes('restaurant') || c.includes('bar') || c.includes('caf')) return 'Dining'
  if (c.includes('groceries')) return 'Groceries'
  if (c.includes('airline') || c.includes('travel')) return 'Travel'
  if (c.includes('transportation')) return 'Transportation'
  if (c.includes('gas') || c.includes('fuel')) return 'Gas & EV Charging'
  if (c.includes('entertainment') || c.includes('streaming')) return 'Entertainment'
  if (c.includes('health') || c.includes('medical') || c.includes('pharmacy')) return 'Health & Medical'
  if (c.includes('membership') || c.includes('subscription')) return 'Subscriptions'
  if (c.includes('merchandise') && c.includes('groceries')) return 'Groceries'
  if (c.includes('fees') || c.includes('adjustments')) return amount < 0 ? 'Needs Review' : 'Government & Fees'
  return 'Needs Review'
}

// ─── Format Detection ─────────────────────────────────────────────────────────

export interface DetectResult {
  format: CsvBankFormat
  confidence: 'high' | 'low'
  headers: string[]
  rows: Record<string, string>[]
  savedMapping?: CsvColumnMapping
}

export async function detectAndParseCSV(file: File): Promise<DetectResult> {
  const text = await file.text()

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
    dynamicTyping: false,
  })

  const headers = result.meta.fields ?? []
  const rows = result.data

  // 1. Try exact known format match
  for (const fmt of FORMATS) {
    const matches = fmt.requiredHeaders.every((h) =>
      headers.some((fh) => fh.trim() === h.trim()),
    )
    if (matches) {
      return { format: fmt.id, confidence: 'high', headers, rows }
    }
  }

  // 2. Check saved custom mappings
  const fingerprint = [...headers].sort().join('|').toLowerCase()
  const saved = (() => {
    try {
      const all = JSON.parse(localStorage.getItem(CSV_MAPPINGS_KEY) || '[]')
      return all.find((m: { headerFingerprint: string }) => m.headerFingerprint === fingerprint) || null
    } catch { return null }
  })()
  if (saved) {
    return { format: 'unknown', confidence: 'high', headers, rows, savedMapping: saved }
  }

  // 3. Low-confidence fuzzy
  return { format: 'unknown', confidence: 'low', headers, rows }
}

// ─── Fuzzy Column Role Detection ──────────────────────────────────────────────

export function fuzzyDetectRoles(headers: string[]): Record<string, CsvFieldRole> {
  const roles: Record<string, CsvFieldRole> = {}
  for (const h of headers) {
    const l = h.toLowerCase()
    if (/\bpost(ed)?\b/.test(l) && /date/.test(l)) {
      roles[h] = 'postDate'
    } else if (/date/.test(l) || /when/.test(l)) {
      roles[h] = 'date'
    } else if (/description|merchant|payee|memo|name/.test(l)) {
      roles[h] = 'description'
    } else if (/debit/.test(l)) {
      roles[h] = 'debit'
    } else if (/credit/.test(l)) {
      roles[h] = 'credit'
    } else if (/amount|charge/.test(l)) {
      roles[h] = 'amount'
    } else if (/category|type/.test(l)) {
      roles[h] = 'category'
    } else if (/card\s*(no|num|number)|account|last.?four/.test(l)) {
      roles[h] = 'cardNumber'
    } else if (/cardholder|holder/.test(l)) {
      roles[h] = 'cardholder'
    } else if (/status/.test(l)) {
      roles[h] = 'status'
    } else {
      roles[h] = 'skip'
    }
  }
  return roles
}

// ─── Main Parse Function ──────────────────────────────────────────────────────

export function parseRowsWithFormat(
  format: CsvBankFormat,
  rows: Record<string, string>[],
): CsvParsedRow[] {
  const fmt = FORMATS.find((f) => f.id === format)
  if (!fmt) return []
  const out: CsvParsedRow[] = []
  for (const row of rows) {
    const parsed = fmt.parse(row)
    if (parsed && parsed.transDate) out.push(applyCreditPaymentClassification(parsed))
  }
  return out
}

export function parseRowsWithMapping(
  rows: Record<string, string>[],
  mapping: Record<string, CsvFieldRole>,
): CsvParsedRow[] {
  // Find which header maps to which role
  const role = (r: CsvFieldRole) =>
    Object.entries(mapping).find(([, v]) => v === r)?.[0]

  const dateCol = role('date')
  const postDateCol = role('postDate')
  const descCol = role('description')
  const amountCol = role('amount')
  const debitCol = role('debit')
  const creditCol = role('credit')
  const cardCol = role('cardNumber')
  const holderCol = role('cardholder')
  const statusCol = role('status')

  // Auto-detect sign flip: if most amounts are negative → flip (Chase-style)
  let pos = 0, neg = 0
  if (amountCol) {
    for (const row of rows.slice(0, 20)) {
      const v = parseAmount(row[amountCol] ?? '')
      if (v > 0) pos++
      else if (v < 0) neg++
    }
  }
  const flipSign = neg > pos

  const out: CsvParsedRow[] = []
  for (const row of rows) {
    if (statusCol) {
      const st = row[statusCol]?.toLowerCase() ?? ''
      if (st && !['cleared', 'posted', ''].includes(st)) continue
    }
    const rawDate = dateCol ? row[dateCol] : ''
    if (!rawDate) continue

    let amount = 0
    if (debitCol || creditCol) {
      const debit = parseAmount(row[debitCol ?? ''] ?? '')
      const credit = parseAmount(row[creditCol ?? ''] ?? '')
      amount = debit > 0 ? debit : -Math.abs(credit)
    } else if (amountCol) {
      amount = parseAmount(row[amountCol] ?? '')
      if (flipSign) amount = -amount
    }

    const desc = descCol ? (row[descCol] ?? '') : ''
    const isPayment = /payment|autopay/i.test(desc) && amount <= 0
    const isCredit = amount < 0 && !isPayment

    out.push(applyCreditPaymentClassification({
      transDate: parseDate(rawDate),
      postDate: parseDate((postDateCol ? row[postDateCol] : rawDate) ?? rawDate),
      description: desc,
      cleanDescription: cleanMerchant(desc),
      amount,
      category: 'Needs Review',
      isPayment,
      isCredit,
      isBalancePayment: isBalancePayment(desc, isPayment),
      cardLastFour: cardCol ? String(row[cardCol] ?? '').slice(-4) : undefined,
      cardholderName: holderCol ? row[holderCol] : undefined,
    }))
  }
  return out
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export function findDuplicates(
  incoming: CsvParsedRow[],
  existing: { transDate: string; amount: number; description: string }[],
): Set<number> {
  const dupes = new Set<number>()
  const existingKeys = new Set(
    existing.map((t) => `${t.transDate}|${t.amount.toFixed(2)}|${t.description.toLowerCase().slice(0, 20)}`)
  )
  incoming.forEach((row, i) => {
    const key = `${row.transDate}|${row.amount.toFixed(2)}|${row.description.toLowerCase().slice(0, 20)}`
    if (existingKeys.has(key)) dupes.add(i)
  })
  return dupes
}
