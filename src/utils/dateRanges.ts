import {
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subYears, format,
} from 'date-fns'

export type DatePreset =
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'thisYear'
  | 'lastYear'
  | 'allTime'
  | 'custom'

export interface DateRange {
  start: string   // YYYY-MM-DD, '' = no bound
  end: string
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

export function getPresetRange(preset: Exclude<DatePreset, 'custom'>): DateRange {
  const now = new Date()
  switch (preset) {
    case 'thisMonth':
      return { start: fmt(startOfMonth(now)), end: fmt(now) }
    case 'lastMonth': {
      const last = subMonths(now, 1)
      return { start: fmt(startOfMonth(last)), end: fmt(endOfMonth(last)) }
    }
    case 'last3Months':
      return { start: fmt(startOfMonth(subMonths(now, 2))), end: fmt(now) }
    case 'last6Months':
      return { start: fmt(startOfMonth(subMonths(now, 5))), end: fmt(now) }
    case 'thisYear':
      return { start: fmt(startOfYear(now)), end: fmt(now) }
    case 'lastYear': {
      const ly = subYears(now, 1)
      return { start: fmt(startOfYear(ly)), end: fmt(endOfYear(ly)) }
    }
    case 'allTime':
      return { start: '', end: '' }
  }
}

export function getPreviousPeriodRange(
  preset: DatePreset,
): DateRange | null {
  const now = new Date()
  switch (preset) {
    case 'thisMonth':
      return getPresetRange('lastMonth')
    case 'lastMonth': {
      const d = subMonths(now, 2)
      return { start: fmt(startOfMonth(d)), end: fmt(endOfMonth(d)) }
    }
    case 'last3Months': {
      const end = subMonths(now, 3)
      const start = subMonths(now, 5)
      return { start: fmt(startOfMonth(start)), end: fmt(endOfMonth(end)) }
    }
    case 'last6Months': {
      const end = subMonths(now, 6)
      const start = subMonths(now, 11)
      return { start: fmt(startOfMonth(start)), end: fmt(endOfMonth(end)) }
    }
    case 'thisYear':
      return getPresetRange('lastYear')
    case 'lastYear': {
      const d = subYears(now, 2)
      return { start: fmt(startOfYear(d)), end: fmt(endOfYear(d)) }
    }
    default:
      return null
  }
}

export const PRESET_LABELS: Array<[DatePreset, string]> = [
  ['thisMonth',   'This Month'],
  ['lastMonth',   'Last Month'],
  ['last3Months', 'Last 3 Mo.'],
  ['last6Months', 'Last 6 Mo.'],
  ['thisYear',    'This Year'],
  ['lastYear',    'Last Year'],
  ['allTime',     'All Time'],
  ['custom',      'Custom…'],
]
