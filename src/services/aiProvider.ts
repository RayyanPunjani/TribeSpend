import type { ParsedStatement, CategoryRule } from '@/types'

// ─── Shared Parsing Prompt ────────────────────────────────────────────────────

export function buildParsingPrompt(rawText: string, categoryRules: CategoryRule[]): string {
  let rulesContext = ''
  if (categoryRules.length > 0) {
    const ruleLines = categoryRules
      .slice(0, 50) // limit context size
      .map((r) => `- "${r.merchantPattern}" → Category: "${r.category}", Clean name: "${r.cleanDescription}"`)
      .join('\n')
    rulesContext = `\nThe user has previously categorized the following merchants. Use these as authoritative overrides:\n${ruleLines}\n\nApply these rules to matching transactions. For new merchants not in this list, categorize based on your best judgment or use "Needs Review" if uncertain.\n\n`
  }

  return `You are a financial document parser. Extract ALL transactions from this credit card statement text.
${rulesContext}
Return ONLY valid JSON with this exact structure:
{
  "statement_info": {
    "issuer": "string",
    "card_type": "string",
    "statement_start_date": "YYYY-MM-DD",
    "statement_end_date": "YYYY-MM-DD"
  },
  "cardholders": [
    {
      "name": "string",
      "last_four": "string",
      "transactions": [
        {
          "trans_date": "YYYY-MM-DD",
          "post_date": "YYYY-MM-DD",
          "raw_description": "string (exact text from statement)",
          "clean_description": "string (human-readable merchant name, properly capitalized)",
          "amount": 0.00,
          "original_amount": null,
          "original_currency": null,
          "exchange_rate": null,
          "category": "string",
          "is_payment_or_credit": false,
          "is_balance_payment": false,
          "is_recurring": false,
          "category_confidence": "high"
        }
      ]
    }
  ]
}

Valid categories: Groceries, Dining, Gas & EV Charging, Transportation, Travel, Shopping, Entertainment, Health & Medical, Fitness, Home & Utilities, Insurance, Subscriptions, Education, Donations & Charity, Government & Fees, Telecom, Personal Care, Pets, Gifts, Miscellaneous, Refunds & Credits, Needs Review

Rules:
- Use the year from the statement date range for all transactions (do NOT default to 2024 if statement is from a different year)
- For foreign transactions, the AMOUNT should be the USD equivalent shown on the statement
- Clean descriptions should be human-readable: "TESLA SUPERCHARGER US877-7983752CA" → "Tesla Supercharger"
- Payments and credits are negative amounts
- If you are confident about a category, assign it. If unsure, assign "Needs Review" with category_confidence "low"
- Mark is_recurring true for subscriptions, gym memberships, streaming, toll auto-charges, etc.
- Set is_balance_payment: true (AND is_payment_or_credit: true) for balance payments, autopay payments, and balance transfers — e.g. "CAPITAL ONE AUTOPAY PYMT", "CHASE PAYMENT THANK YOU", "AMEX AUTOPAY", "PAYMENT RECEIVED", "AUTOPAY PAYMENT", "BALANCE TRANSFER", "ONLINE PAYMENT". These are payments TO the card issuer, not purchases.
- For merchant credits and refunds (e.g. "REFUND FROM AMAZON", "CREDIT ADJ"), set is_payment_or_credit: true but is_balance_payment: false — these are real merchant transactions the user cares about.

Statement text:
${rawText}`
}

// ─── AI Provider Interface ────────────────────────────────────────────────────

export interface AIProvider {
  name: string
  parseStatement(rawText: string, categoryRules: CategoryRule[]): Promise<ParsedStatement>
}

// ─── JSON Extraction Helper ───────────────────────────────────────────────────

export function extractJSON(text: string): ParsedStatement {
  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    console.log('[extractJSON] Found markdown code block, attempting parse')
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch (err) {
      console.error('[extractJSON] Code block parse failed:', err)
      console.error('[extractJSON] Code block content:', codeBlockMatch[1].trim().slice(0, 500))
      throw err
    }
  }

  // Try to find the outermost JSON object
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    console.log(`[extractJSON] Found JSON object at [${start}..${end}], attempting parse`)
    const candidate = text.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch (err) {
      console.error('[extractJSON] Object parse failed:', err)
      console.error('[extractJSON] First 500 chars of candidate:', candidate.slice(0, 500))
      console.error('[extractJSON] Last 200 chars of candidate:', candidate.slice(-200))
      throw err
    }
  }

  console.error('[extractJSON] No JSON object found in text. Full text:', text)
  throw new Error('No valid JSON found in response')
}

/**
 * Merge multiple parsed statements (for chunked parsing)
 */
export function mergeStatements(parts: ParsedStatement[]): ParsedStatement {
  if (parts.length === 0) throw new Error('No parts to merge')
  if (parts.length === 1) return parts[0]

  const base = parts[0]
  const mergedCardholders: Map<string, typeof base.cardholders[0]> = new Map()

  for (const part of parts) {
    for (const ch of part.cardholders) {
      const key = `${ch.name}|${ch.last_four}`
      if (mergedCardholders.has(key)) {
        const existing = mergedCardholders.get(key)!
        existing.transactions.push(...ch.transactions)
      } else {
        mergedCardholders.set(key, { ...ch, transactions: [...ch.transactions] })
      }
    }
  }

  return {
    statement_info: base.statement_info,
    cardholders: Array.from(mergedCardholders.values()),
  }
}
