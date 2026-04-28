const COMMON_SUFFIXES = new Set(['llc', 'inc', 'co', 'corp', 'corporation', 'ltd', 'limited'])

const KNOWN_MERCHANTS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\b(?:amazon|amzn)\b|\bamazon\s*com\b|\bamazon\s*(?:mktplace|marketplace)\b|\bamzn\s*mktp\b/, canonical: 'Amazon' },
  { pattern: /\bwal\s*mart\b|\bwalmart\b|\bwalmart\s*com\b/, canonical: 'Walmart' },
]

const PAYMENT_PREFIXES = [
  /^(?:tst)\s+(.+)$/,
  /^(?:sq|square)\s+(.+)$/,
  /^(?:paypal\s+inst\s+xfer|paypal|pp)\s+(.+)$/,
  /^(?:venmo)\s+(.+)$/,
]

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function stripNoiseTokens(value: string): string {
  const tokens = value.split(/\s+/).filter(Boolean)

  while (tokens.length > 1) {
    const token = tokens[tokens.length - 1]
    const isSuffix = COMMON_SUFFIXES.has(token)
    const isLongCode = token.length >= 5 && /[a-z]/.test(token) && /\d/.test(token)
    const isNumericCode = token.length >= 4 && /^\d+$/.test(token)
    const isHashLike = /^x{2,}\d+$/i.test(token)

    if (!isSuffix && !isLongCode && !isNumericCode && !isHashLike) break
    tokens.pop()
  }

  return tokens.join(' ')
}

function cleanMerchantText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:pos|debit|credit|card|purchase|auth|authorization|online|payment|pmts)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeMerchantKey(value: string): string {
  const cleaned = stripNoiseTokens(cleanMerchantText(value))

  for (const prefix of PAYMENT_PREFIXES) {
    const match = cleaned.match(prefix)
    if (match?.[1] && match[1].trim().length > 2) {
      return normalizeMerchantKey(match[1])
    }
  }

  for (const merchant of KNOWN_MERCHANTS) {
    if (merchant.pattern.test(cleaned)) return merchant.canonical.toLowerCase()
  }

  return cleaned
}

export function normalizeMerchantName(value: string): string {
  const key = normalizeMerchantKey(value)
  if (!key) return 'Unknown Merchant'

  for (const merchant of KNOWN_MERCHANTS) {
    if (key === merchant.canonical.toLowerCase()) return merchant.canonical
  }

  return titleCase(key)
}

export function merchantSearchText(...values: Array<string | undefined | null>): string {
  return values
    .flatMap((value) => {
      if (!value) return []
      return [value, normalizeMerchantName(value), normalizeMerchantKey(value)]
    })
    .join(' ')
    .toLowerCase()
}
