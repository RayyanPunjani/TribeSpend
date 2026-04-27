import * as XLSX from 'xlsx'
import type { Transaction, CreditCard, Person } from '@/types'
import { formatDate, formatAmount } from '@/utils/formatters'

interface ExportRow {
  Date: string
  'Post Date': string
  Description: string
  Category: string
  Amount: string
  Card: string
  Person: string
  'Reimbursement Status': string
  'Reimbursement Person': string
  'Reimbursable Amount': string
  'Reimbursement Paid': string
  Notes: string
  Recurring: string
}

function buildRows(
  transactions: Transaction[],
  cards: CreditCard[],
  persons: Person[],
): ExportRow[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]))
  const personMap = new Map(persons.map((p) => [p.id, p]))

  return transactions.map((t) => {
    const card = cardMap.get(t.cardId)
    const person = card ? personMap.get(card.owner) : undefined
    return {
      Date: formatDate(t.transDate),
      'Post Date': formatDate(t.postDate),
      Description: t.cleanDescription,
      Category: t.category,
      Amount: formatAmount(t.amount),
      Card: card ? `${card.name} (...${card.lastFour})` : t.cardId,
      Person: person?.name ?? t.cardholderName,
      'Reimbursement Status': t.reimbursementStatus,
      'Reimbursement Person': t.reimbursementPerson ?? '',
      'Reimbursable Amount':
        t.reimbursementStatus === 'full'
          ? formatAmount(t.amount)
          : t.reimbursementAmount
          ? formatAmount(t.reimbursementAmount)
          : '',
      'Reimbursement Paid': t.reimbursementPaid ? 'Yes' : '',
      Notes: t.notes ?? '',
      Recurring: t.isRecurring ? 'Yes' : '',
    }
  })
}

export function exportToCSV(
  transactions: Transaction[],
  cards: CreditCard[],
  persons: Person[],
  filename = 'tribespend-transactions.csv',
): void {
  const rows = buildRows(transactions, cards, persons)
  const headers = Object.keys(rows[0] || {}) as (keyof ExportRow)[]
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => `"${(row[h] ?? '').replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

export function exportToExcel(
  transactions: Transaction[],
  cards: CreditCard[],
  persons: Person[],
  filename = 'tribespend-transactions.xlsx',
): void {
  const rows = buildRows(transactions, cards, persons)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')

  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String((r as any)[key] ?? '').length),
    ),
  }))
  ws['!cols'] = colWidths

  XLSX.writeFile(wb, filename)
}

export function exportReimbursementReport(
  transactions: Transaction[],
  cards: CreditCard[],
  persons: Person[],
  filename = 'tribespend-reimbursements.xlsx',
): void {
  const reimbursable = transactions.filter((t) => t.reimbursementStatus !== 'none')
  const cardMap = new Map(cards.map((c) => [c.id, c]))
  const personMap = new Map(persons.map((p) => [p.id, p]))

  // Group by reimbursement person
  const byPerson = new Map<string, Transaction[]>()
  for (const t of reimbursable) {
    const key = t.reimbursementPerson ?? 'Unknown'
    if (!byPerson.has(key)) byPerson.set(key, [])
    byPerson.get(key)!.push(t)
  }

  const wb = XLSX.utils.book_new()

  for (const [person, txns] of byPerson) {
    const rows = txns.map((t) => {
      const card = cardMap.get(t.cardId)
      const owner = card ? personMap.get(card.owner) : undefined
      const reimb =
        t.reimbursementStatus === 'full'
          ? t.amount
          : t.reimbursementAmount ?? 0
      return {
        Date: formatDate(t.transDate),
        Description: t.cleanDescription,
        'Total Amount': formatAmount(t.amount),
        'Reimbursable Amount': formatAmount(reimb),
        Card: card ? `${card.name} (...${card.lastFour})` : '',
        Owner: owner?.name ?? '',
        Paid: t.reimbursementPaid ? 'Yes' : 'No',
        Notes: t.reimbursementNote ?? '',
      }
    })

    const total = txns.reduce((sum, t) => {
      const amt = t.reimbursementStatus === 'full' ? t.amount : t.reimbursementAmount ?? 0
      return sum + amt
    }, 0)

    rows.push({
      Date: '',
      Description: 'TOTAL',
      'Total Amount': '',
      'Reimbursable Amount': formatAmount(total),
      Card: '',
      Owner: '',
      Paid: '',
      Notes: '',
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, person.slice(0, 31))
  }

  if (wb.SheetNames.length > 0) {
    XLSX.writeFile(wb, filename)
  }
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
