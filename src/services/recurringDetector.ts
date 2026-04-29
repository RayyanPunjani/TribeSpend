import type { Transaction } from '@/types'

// ── Known subscription merchant patterns ──────────────────────────────────────
// Matched case-insensitively as substrings of cleanDescription or description.

const SUBSCRIPTION_PATTERNS = [
  'NETFLIX', 'SPOTIFY', 'DISNEY+', 'DISNEYPLUS', 'HULU',
  'YOUTUBE PREMIUM', 'YOUTUBE TV',
  'APPLE.COM/BILL', 'APPLE ONE', 'ICLOUD',
  'GOOGLE ONE', 'GOOGLE STORAGE',
  'AMAZON PRIME', 'PRIME VIDEO', 'AUDIBLE', 'KINDLE UNLIMITED',
  'MICROSOFT 365', 'OFFICE 365', 'ADOBE', 'DROPBOX', 'GITHUB',
  'CLAUDE.AI', 'ANTHROPIC', 'CHATGPT', 'OPENAI',
  'HBO MAX', 'MAX.COM', 'PEACOCK', 'PARAMOUNT+', 'DISCOVERY+', 'ESPN+',
  'CRUNCHYROLL', 'FUNIMATION',
  'DUOLINGO', 'CALM', 'HEADSPACE', 'STRAVA', 'PELOTON',
  'NYTIMES', 'NY TIMES', 'WASHINGTON POST', 'WALL STREET JOURNAL', 'WSJ',
  'GEICO', 'STATE FARM', 'ALLSTATE', 'PROGRESSIVE',
  'AT&T', 'T-MOBILE', 'TMOBILE', 'VERIZON WIRELESS',
  'XFINITY', 'COMCAST', 'SPECTRUM', 'COX COMM',
  'PLANET FITNESS', 'LA FITNESS', 'LIFETIME FITNESS', 'ANYTIME FITNESS', 'YMCA',
  'GOOGLE FI', 'MINT MOBILE', 'VISIBLE WIRELESS',
  'NORDVPN', 'EXPRESSVPN', '1PASSWORD', 'LASTPASS', 'BITWARDEN',
  'SIRIUS XM', 'SIRIUSXM',
  'GRAMMARLY', 'CANVA', 'NOTION', 'FIGMA', 'SLACK',
  'RING.COM', 'ADT SECURITY', 'SIMPLISAFE',
  'DOORDASH DASHPASS', 'WALMART+', 'COSTCO MEMB', 'SAMS CLUB MEM',
]

// Transactions in these categories are always considered recurring
const RECURRING_CATEGORIES = ['Subscriptions', 'Insurance']

function isKnownSubscription(t: Transaction): boolean {
  if (RECURRING_CATEGORIES.includes(t.category)) return true
  const search = `${t.cleanDescription} ${t.description}`.toUpperCase()
  return SUBSCRIPTION_PATTERNS.some((p) => search.includes(p))
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / 86_400_000,
  )
}

// ── Core detection ─────────────────────────────────────────────────────────────

/**
 * Scans `allTransactions` and returns the IDs of transactions that should be
 * flagged as recurring. Respects `recurringDismissed` (user explicitly un-flagged)
 * and never removes an existing `isRecurring: true` flag.
 */
export function detectRecurring(allTransactions: Transaction[]): string[] {
  // Work set: exclude payments, credits, deleted, and user-dismissed
  const eligible = allTransactions.filter(
    (t) => !t.isPayment && !t.isCredit && !t.deleted && !t.recurringDismissed,
  )

  const toFlag = new Set<string>()

  // ── Approach 1: Known merchant patterns ──────────────────────────────────
  for (const t of eligible) {
    if (!t.isRecurring && isKnownSubscription(t)) {
      toFlag.add(t.id)
    }
  }

  // ── Approach 2: Frequency pattern detection ───────────────────────────────
  // Group eligible transactions by normalized cleanDescription
  const groups = new Map<string, Transaction[]>()
  for (const t of eligible) {
    const key = t.cleanDescription.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  for (const [, txns] of groups) {
    if (txns.length < 2) continue

    // Sort ascending by date
    const sorted = [...txns].sort((a, b) => a.transDate.localeCompare(b.transDate))
    const amounts = sorted.map((t) => t.amount)

    // Amount consistency: all within 15% of the average
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const amountsConsistent = amounts.every(
      (a) => Math.abs(a - avgAmount) / Math.max(avgAmount, 0.01) <= 0.15,
    )
    if (!amountsConsistent) continue

    // Gap consistency: compute gaps between consecutive charges
    const dates = sorted.map((t) => t.transDate)
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) {
      gaps.push(daysBetween(dates[i - 1], dates[i]))
    }

    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length

    // Only flag recognised frequencies
    const isMonthly   = avgGap >= 25  && avgGap <= 35
    const isQuarterly = avgGap >= 80  && avgGap <= 100
    const isAnnual    = avgGap >= 350 && avgGap <= 380
    if (!isMonthly && !isQuarterly && !isAnnual) continue

    // All gaps must be within 30% of the average (no wild outliers)
    const gapsEven = gaps.every(
      (g) => Math.abs(g - avgGap) / Math.max(avgGap, 1) <= 0.30,
    )
    if (!gapsEven) continue

    // Flag any in this group that aren't already recurring
    for (const t of sorted) {
      if (!t.isRecurring) toFlag.add(t.id)
    }
  }

  return Array.from(toFlag)
}

/**
 * Runs the detector and applies the recurring flags to the DB + in-memory store.
 * Returns the number of newly flagged transactions.
 */
export async function runRecurringDetector(
  allTransactions: Transaction[],
  updateMany: (ids: string[], patch: Partial<Transaction>) => Promise<unknown>,
): Promise<number> {
  const ids = detectRecurring(allTransactions)
  if (ids.length === 0) return 0
  await updateMany(ids, { isRecurring: true, recurringAutoDetected: true })
  return ids.length
}
