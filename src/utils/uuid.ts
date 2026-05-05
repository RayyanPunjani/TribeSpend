const UUID_FIELDS = new Set([
  'household_id',
  'person_id',
  'card_id',
  'card_preset_id',
  'refund_for_id',
])

export function nullableUuid(value?: string | null) {
  return value && value.trim() !== '' ? value : null
}

export function sanitizeUuidFields<T extends Record<string, unknown>>(row: T): T {
  const sanitized = { ...row }

  for (const field of UUID_FIELDS) {
    if (sanitized[field] === '') {
      sanitized[field as keyof T] = null as T[keyof T]
    }
  }

  return sanitized
}
