/**
 * Manual column mapping UI — shown when auto-detection confidence is low.
 * Lets the user assign a role to each CSV column.
 */
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Save } from 'lucide-react'
import type { CsvFieldRole, CsvColumnMapping } from '@/types'
import { fuzzyDetectRoles } from '@/services/csvParser'
// CSV mappings stored in localStorage (lightweight, no Supabase table needed)
const CSV_MAPPINGS_KEY = 'tribespend_csv_mappings'

const ROLE_LABELS: Record<CsvFieldRole, string> = {
  date: 'Transaction Date',
  postDate: 'Post Date',
  description: 'Description / Merchant',
  amount: 'Amount (single column)',
  debit: 'Debit (purchases)',
  credit: 'Credit (payments/refunds)',
  category: 'Category',
  cardNumber: 'Card Number',
  cardholder: 'Cardholder Name',
  status: 'Status',
  skip: 'Skip this column',
}

interface Props {
  headers: string[]
  previewRows: Record<string, string>[]
  onConfirm: (mapping: Record<string, CsvFieldRole>) => void
  onCancel: () => void
}

export default function ColumnMapper({ headers, previewRows, onConfirm, onCancel }: Props) {
  const initialRoles = fuzzyDetectRoles(headers)
  const [roles, setRoles] = useState<Record<string, CsvFieldRole>>(initialRoles)
  const [saveMapping, setSaveMapping] = useState(true)
  const [bankName, setBankName] = useState('')

  const setRole = (header: string, role: CsvFieldRole) =>
    setRoles((r) => ({ ...r, [header]: role }))

  const hasDate = Object.values(roles).includes('date')
  const hasDesc = Object.values(roles).includes('description')
  const hasAmount =
    Object.values(roles).includes('amount') ||
    (Object.values(roles).includes('debit') && Object.values(roles).includes('credit'))

  const canConfirm = hasDate && hasDesc && hasAmount

  const handleConfirm = async () => {
    if (saveMapping && bankName) {
      const fingerprint = [...headers].sort().join('|').toLowerCase()
      const mapping: CsvColumnMapping = {
        id: uuidv4(),
        headerFingerprint: fingerprint,
        bankHint: bankName,
        mapping: roles,
        createdAt: new Date().toISOString(),
      }
      try {
        const existing = JSON.parse(localStorage.getItem(CSV_MAPPINGS_KEY) || '[]')
        existing.push(mapping)
        localStorage.setItem(CSV_MAPPINGS_KEY, JSON.stringify(existing))
      } catch { /* ignore */ }
    }
    onConfirm(roles)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-800">Map CSV Columns</h3>
        <p className="text-sm text-slate-500 mt-1">
          We couldn't automatically detect your bank's format. Tell us what each column contains.
        </p>
      </div>

      {/* Column mapping table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-40">Column</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-48">This column contains…</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Preview (first 3 rows)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {headers.map((h) => (
              <tr key={h} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{h}</span>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={roles[h] ?? 'skip'}
                    onChange={(e) => setRole(h, e.target.value as CsvFieldRole)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  >
                    {(Object.entries(ROLE_LABELS) as [CsvFieldRole, string][]).map(([role, label]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {previewRows.slice(0, 3).map((row, i) => (
                    <span key={i} className="mr-3 text-slate-400">
                      {row[h] ?? '—'}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Validation hint */}
      {!canConfirm && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Please assign at least: <strong>Transaction Date</strong>, <strong>Description</strong>, and <strong>Amount</strong> (or Debit + Credit).
        </p>
      )}

      {/* Save mapping option */}
      <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={saveMapping}
            onChange={(e) => setSaveMapping(e.target.checked)}
            className="rounded border-slate-300 text-accent-600"
          />
          Save this mapping for future imports
        </label>
        {saveMapping && (
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank or account name (e.g., My Credit Union)"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex items-center gap-2 flex-1 px-5 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors justify-center"
        >
          <Save size={14} /> Apply Mapping
        </button>
      </div>
    </div>
  )
}
