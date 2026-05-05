import { suggestCsvMerchantCategory } from './csvMerchantCategorizer'

/**
 * Suggest a category for a transaction description using keyword matching.
 * Returns null if no match is found.
 */
export function suggestCategory(description: string): string | null {
  return suggestCsvMerchantCategory(description)
}
