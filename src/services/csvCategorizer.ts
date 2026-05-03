/**
 * Categorize CSV-parsed rows:
 * 1. Apply saved Category Rules (free, local)
 * 2. For remaining unknowns, batch-call Claude with just merchant names (~$0.01-0.02/file)
 */

import type { CsvParsedRow, CategoryRule } from '@/types'
import { findMatchingRule } from './categoryMatcher'
import { suggestCategory } from './keywordCategorizer'
import { CATEGORIES as ALL_CATEGORIES } from '@/utils/categories'
import { normalizeCategory, FALLBACK_CATEGORY } from '@/utils/categoryFallback'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
// Exclude meta-categories from AI classification targets
const DEFAULT_AI_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== 'Needs Review' && c !== 'Refunds & Credits')

/**
 * Categorize a list of parsed CSV rows using:
 * 1. Saved category rules (local, free)
 * 2. Claude API batch call for unknown merchants only
 */
export async function categorizeCsvRows(
  rows: CsvParsedRow[],
  rules: CategoryRule[],
  apiKey: string,
  model: string,
  categories: string[] = DEFAULT_AI_CATEGORIES,
): Promise<CsvParsedRow[]> {
  const result = rows.map((row) => ({ ...row }))
  const aiCategories = categories.filter((c) => c !== 'Needs Review' && c !== 'Refunds & Credits')

  // Step 1: Apply saved rules
  for (const row of result) {
    if (row.isBalancePayment || row.isPayment) {
      row.category = 'Credit Card Payment'
      row.isPayment = true
      row.isCredit = false
      row.refundReviewPending = false
      continue
    }
    if (row.isCredit) {
      row.category = row.category === 'Transfer' ? 'Transfer' : 'Refunds & Credits'
      row.refundReviewPending = true
      continue
    }
    if (row.category !== 'Needs Review') continue // already set by bank mapping

    const rule = findMatchingRule(`${row.description} ${row.cleanDescription}`, rules)
    if (rule) {
      row.category = rule.category
      row.cleanDescription = rule.cleanDescription
      row.cardId = rule.cardId
      row.personId = rule.personId
    }
  }

  // Step 1.5: Keyword matching for still-unknown transactions (no API call needed)
  for (const row of result) {
    if (row.category !== 'Needs Review' || row.isPayment || row.isBalancePayment) continue
    const suggested = suggestCategory(`${row.description} ${row.cleanDescription}`)
    if (suggested) {
      row.category = suggested
    }
  }

  // Step 2: Collect unique merchants still needing AI categorization
  const needsCategorization = result.filter(
    (r) => r.category === 'Needs Review' && !r.isPayment && !r.isBalancePayment,
  )
  const uniqueMerchants = [...new Set(needsCategorization.map((r) => r.cleanDescription || r.description))]

  const withFallbacks = () => result.map((row) => ({
    ...row,
    category: normalizeCategory(row.category === 'Needs Review' ? FALLBACK_CATEGORY : row.category),
  }))

  if (uniqueMerchants.length === 0 || !apiKey) return withFallbacks()

  // Step 3: Batch Claude call with only merchant names
  try {
    const aiMatches = await batchCategorizeMerchants(uniqueMerchants, apiKey, model, aiCategories)

    // Apply AI results
    for (const row of result) {
      if (row.category !== 'Needs Review') continue
      const merchant = row.cleanDescription || row.description
      const aiCat = aiMatches[merchant]
      if (aiCat && aiCategories.includes(aiCat)) {
        row.category = aiCat
      }
    }
  } catch (err) {
    console.warn('[csvCategorizer] AI batch categorization failed, falling back to Other:', err)
  }

  return withFallbacks()
}

async function batchCategorizeMerchants(
  merchants: string[],
  apiKey: string,
  model: string,
  categories: string[],
): Promise<Record<string, string>> {
  const prompt = `Categorize these merchants/businesses into one of these categories:
${categories.join(', ')}

Merchants:
${merchants.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Return ONLY valid JSON object mapping merchant name to category. Example:
{"Walmart": "Groceries", "Uber": "Transportation"}

If unsure about a merchant, use "Other". Never use a category not in the list.`

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      stream: false,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    throw new Error(`Anthropic API error ${resp.status}`)
  }

  const data = await resp.json()
  const text: string = data.content?.[0]?.text ?? ''

  // Extract JSON from response
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return {}

  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return {}
  }
}
