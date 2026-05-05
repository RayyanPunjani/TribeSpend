interface CsvMerchantCategoryRule {
  category: string
  keywords: string[]
}

const CSV_MERCHANT_CATEGORY_RULES: CsvMerchantCategoryRule[] = [
  {
    category: 'Dining',
    keywords: ['einstein', 'giordanos', 'chipotle', 'starbucks', 'cafe', 'pizza', 'burger'],
  },
  {
    category: 'Subscriptions',
    keywords: ['netflix', 'spotify', 'apple com bill', 'apple.com/bill', 'google'],
  },
  {
    category: 'Shopping',
    keywords: ['amazon', 'bestbuy', 'best buy', 'apple', 'target', 'walmart'],
  },
  {
    category: 'Entertainment',
    keywords: ['cinema', 'theater', 'theatre', 'escape', 'carnival', 'concert', 'tickets'],
  },
  {
    category: 'Gas & EV Charging',
    keywords: ['tesla supercharger', 'supercharger', 'shell', 'chevron'],
  },
  {
    category: 'Groceries',
    keywords: ['whole foods', 'trader joe', 'kroger', 'aldi'],
  },
  {
    category: 'Insurance',
    keywords: ['geico', 'state farm', 'progressive'],
  },
  {
    category: 'Travel',
    keywords: ['delta', 'united', 'airbnb', 'hotel'],
  },
  {
    category: 'Transportation',
    keywords: ['uber', 'lyft', 'parking', 'toll'],
  },
]

export function normalizeCsvMerchantText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(sq|pos|tst|paypal|pp|debit|card|purchase|auth|visa|mc)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function suggestCsvMerchantCategory(description: string): string | null {
  const normalized = ` ${normalizeCsvMerchantText(description)} `
  if (!normalized.trim()) return null

  for (const rule of CSV_MERCHANT_CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => {
      const normalizedKeyword = normalizeCsvMerchantText(keyword)
      return normalizedKeyword && normalized.includes(` ${normalizedKeyword} `)
    })) {
      return rule.category
    }
  }

  return null
}
