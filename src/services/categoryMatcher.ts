import type { CategoryRule, ParsedTransactionRaw } from '@/types'
import { normalizeMerchantKey } from '@/lib/merchantNormalize'

/**
 * Normalize a description for matching: lowercase, remove special chars, collapse spaces
 */
export function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if a raw description matches a rule's merchant pattern
 */
export function matchesRule(rawDescription: string, rule: CategoryRule): boolean {
  const normalized = normalizeDescription(rawDescription)
  const pattern = normalizeDescription(rule.merchantPattern)
  const merchantKey = normalizeMerchantKey(rawDescription)
  const merchantPattern = normalizeMerchantKey(rule.merchantPattern)
  return normalized.includes(pattern) || (!!merchantPattern && merchantKey.includes(merchantPattern))
}

/**
 * Find the best matching rule for a raw description
 * Returns null if no match
 */
export function findMatchingRule(
  rawDescription: string,
  rules: CategoryRule[],
): CategoryRule | null {
  let bestMatch: CategoryRule | null = null
  let bestLength = 0

  for (const rule of rules) {
    if (matchesRule(rawDescription, rule)) {
      const len = normalizeDescription(rule.merchantPattern).length
      if (len > bestLength) {
        bestMatch = rule
        bestLength = len
      }
    }
  }

  return bestMatch
}

/**
 * Apply category rules to a list of raw parsed transactions.
 * Returns { matched, unmatched } partitions.
 */
export function applyRulesToTransactions(
  transactions: ParsedTransactionRaw[],
  rules: CategoryRule[],
): {
  matched: Array<ParsedTransactionRaw & { matchedRule: CategoryRule }>
  unmatched: ParsedTransactionRaw[]
} {
  const matched: Array<ParsedTransactionRaw & { matchedRule: CategoryRule }> = []
  const unmatched: ParsedTransactionRaw[] = []

  for (const txn of transactions) {
    const rule = findMatchingRule(txn.raw_description, rules)
    if (rule) {
      matched.push({
        ...txn,
        category: rule.category,
        clean_description: rule.cleanDescription,
        matchedRule: rule,
      })
    } else {
      unmatched.push(txn)
    }
  }

  return { matched, unmatched }
}

/**
 * Generate a suggested merchant pattern from a clean description
 * e.g., "Dallas Masjid of Al Islam" → "dallas masjid"
 */
export function suggestMerchantPattern(cleanDescription: string): string {
  const words = cleanDescription.toLowerCase().split(/\s+/)
  // Take first 2-3 meaningful words (skip common words)
  const skip = new Set(['of', 'the', 'and', 'at', 'in', 'for', '&'])
  const meaningful = words.filter((w) => !skip.has(w) && w.length > 1)
  return meaningful.slice(0, 2).join(' ')
}
