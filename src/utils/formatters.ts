import { format, parseISO, isValid } from 'date-fns'

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
}

export function formatDate(dateStr: string, fmt = 'MMM d, yyyy'): string {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return dateStr
    return format(d, fmt)
  } catch {
    return dateStr
  }
}

export function formatShortDate(dateStr: string): string {
  return formatDate(dateStr, 'MMM d')
}

export function formatMonthYear(dateStr: string): string {
  return formatDate(dateStr, 'MMM yyyy')
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${abs.toFixed(2)}`
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
