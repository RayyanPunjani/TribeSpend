interface CsvMerchantCategoryRule {
  category: string
  keywords: string[]
}

const CSV_MERCHANT_CATEGORY_RULES: CsvMerchantCategoryRule[] = [
  {
    category: 'Dining',
    keywords: [
      'grubhub',
      'uber eats',
      'einstein',
      'einsteinbros',
      'waffle house',
      'bjs restaurant',
      'fuzzys taco',
      'restaurant',
      'coffee',
      'donuts',
      'cafe',
      'roasters',
      'chicken',
      'halal meats',
      'keki',
      'subway',
      'giordanos',
      'chipotle',
      'starbucks',
      'pizza',
      'burger',
    ],
  },
  {
    category: 'Subscriptions',
    keywords: ['netflix', 'spotify', 'apple com bill', 'apple.com/bill', 'google'],
  },
  {
    category: 'Shopping',
    keywords: [
      'best buy',
      'bestbuy',
      'ebay',
      'ebay o',
      'sephora',
      'pacsun',
      'hobby lobby',
      'dollar tree',
      'michaels',
      'depop',
      'hollister',
      'swarovski',
      'dsw',
      'etsy',
      'h and m',
      'hm',
      'uniqlo',
      'nordstrom',
      'tj maxx',
      't j maxx',
      'world market',
      'homegoods',
      'at home',
      'new balance',
      'patagonia',
      'amazon',
      'apple',
      'target',
      'walmart',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'tiktok',
      'kingsisle',
      'comedy',
      'defensive driving',
      'smash bros',
      'g2a',
      'eneba',
      'carnival',
      'escape',
      'tickets',
      'concert',
      'cinema',
      'theater',
      'theatre',
    ],
  },
  {
    category: 'Gas & EV Charging',
    keywords: ['tesla supercharger', 'supercharger', 'raceway', 'racetrac', '7 eleven', '7-eleven', 'shell', 'exxon', 'chevron', 'bp', 'gas'],
  },
  {
    category: 'Groceries',
    keywords: [
      'wm supercenter',
      'walmart',
      'green vine market',
      'first choice grocery',
      'plano halal meats',
      'whole foods',
      'trader joe',
      'kroger',
      'aldi',
    ],
  },
  {
    category: 'Insurance',
    keywords: ['geico', 'state farm', 'progressive'],
  },
  {
    category: 'Travel',
    keywords: ['residence inn', 'american airlines', 'frontier airlines', 'nusuk hajj', 'hotel', 'vail resorts', 'snow com', 'delta', 'united', 'airbnb'],
  },
  {
    category: 'Fitness',
    keywords: ['hotworx', 'amped fitness', 'eos', 'gym', 'fitness'],
  },
  {
    category: 'Donations & Charity',
    keywords: ['icna', 'masjid', 'muhsen', 'pure hands', 'zeffy', 'iacc', 'aga khan', 'asha'],
  },
  {
    category: 'Health & Medical',
    keywords: ['softtouch dental', 'dental', 'hospital', 'hosp', 'cvs', 'pharmacy'],
  },
  {
    category: 'Home & Utilities',
    keywords: ['varsity energy', 'frontier', 'ufone', 'ring solo plan', 'comcast', 'xfinity', 'energy'],
  },
  {
    category: 'Transportation',
    keywords: ['uber ride', 'lyft', 'ntta', 'toll', 'driver record', 'txdps', 'parking'],
  },
  {
    category: 'Shipping & Services',
    keywords: ['ups', 'fedex', 'usps'],
  },
]

const NORMALIZATION_VARIANTS: Array<[RegExp, string]> = [
  [/\bbestbuy\b/g, 'best buy'],
  [/\bbest buy\b/g, 'best buy'],
  [/\bwm supercenter\b/g, 'walmart'],
  [/\bt j maxx\b/g, 'tj maxx'],
  [/\bh and m\b/g, 'hm'],
  [/\bebay o\b/g, 'ebay'],
  [/\b7 eleven\b/g, '7-eleven'],
]

export function normalizeCsvMerchantText(value: string): string {
  let normalized = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(sq|pos|tst|paypal|pp|debit|card|purchase|auth|visa|mc)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const [pattern, replacement] of NORMALIZATION_VARIANTS) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized.replace(/\s+/g, ' ').trim()
}

export function suggestCsvMerchantCategory(description: string): string | null {
  const normalized = ` ${normalizeCsvMerchantText(description)} `
  const compact = normalized.replace(/\s+/g, '')
  if (!normalized.trim()) return null

  const keywordRules = CSV_MERCHANT_CATEGORY_RULES.flatMap((rule, ruleIndex) =>
    rule.keywords.map((keyword, keywordIndex) => ({
      category: rule.category,
      keyword,
      ruleIndex,
      keywordIndex,
      normalizedKeyword: normalizeCsvMerchantText(keyword),
    })),
  ).sort((a, b) => {
    const lengthDiff = b.normalizedKeyword.length - a.normalizedKeyword.length
    if (lengthDiff !== 0) return lengthDiff
    if (a.ruleIndex !== b.ruleIndex) return a.ruleIndex - b.ruleIndex
    return a.keywordIndex - b.keywordIndex
  })

  for (const rule of keywordRules) {
    const normalizedKeyword = rule.normalizedKeyword
    if (!normalizedKeyword) continue
    const compactKeyword = normalizedKeyword.replace(/\s+/g, '')
    const boundaryMatch = normalized.includes(` ${normalizedKeyword} `)
    const compactMatch = compactKeyword.length >= 4 && compact.includes(compactKeyword)
    const shortTokenMatch = compactKeyword.length < 4 && boundaryMatch
    if (boundaryMatch || compactMatch || shortTokenMatch) {
      return rule.category
    }
  }

  return null
}

export const CSV_MERCHANT_CATEGORY_EXAMPLES = [
  ['Grubhub Thehalalguysal', 'Dining'],
  ['Bestbuycom807163067770', 'Shopping'],
  ['Einsteinbros Mobile', 'Dining'],
  ['Raceway', 'Gas & EV Charging'],
  ['Residence Inn', 'Travel'],
  ['Hotworx Richardson', 'Fitness'],
  ['ICNA Dallas', 'Donations & Charity'],
  ['Softtouch Dental', 'Health & Medical'],
  ['NTTA Autocharge', 'Transportation'],
  ['UPS', 'Shipping & Services'],
  ['FedEx', 'Shipping & Services'],
] as const

if (import.meta.env.DEV) {
  const failures = CSV_MERCHANT_CATEGORY_EXAMPLES.filter(
    ([description, category]) => suggestCsvMerchantCategory(description) !== category,
  )
  if (failures.length > 0) {
    console.warn('[csvMerchantCategorizer] Example categorization mismatches:', failures)
  }
}
