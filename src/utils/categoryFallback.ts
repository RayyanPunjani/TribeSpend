export const FALLBACK_CATEGORY = 'Other'

export function normalizeCategory(category?: string | null): string {
  const trimmed = (category ?? '').trim()
  return trimmed || FALLBACK_CATEGORY
}

export function isReviewCategory(category?: string | null): boolean {
  const normalized = normalizeCategory(category)
  return normalized === 'Other' || normalized === 'Needs Review'
}
