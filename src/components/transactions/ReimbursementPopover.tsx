import { useState, useRef, useEffect } from 'react'
import { AlertCircle, DollarSign, X, Check, Loader2 } from 'lucide-react'
import type { Transaction } from '@/types'
import { useTransactionStore } from '@/stores/transactionStore'
import { usePersonStore } from '@/stores/personStore'

interface Props {
  transaction: Transaction
  onClose: () => void
}

export default function ReimbursementPopover({ transaction: t, onClose }: Props) {
  const { update } = useTransactionStore()
  const { persons } = usePersonStore()

  const [status, setStatus] = useState(t.reimbursementStatus)
  const [amount, setAmount] = useState(t.reimbursementAmount?.toString() ?? '')
  const [person, setPerson] = useState(t.reimbursementPerson ?? '')
  const [paid, setPaid] = useState(t.reimbursementPaid)
  const [note, setNote] = useState(t.reimbursementNote ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const success = await update(t.id, {
        reimbursementStatus: status,
        reimbursementAmount: status === 'partial' ? parseFloat(amount) || undefined : undefined,
        reimbursementPerson: status === 'none' ? undefined : person || undefined,
        reimbursementPaid: status === 'none' ? false : paid,
        reimbursementNote: status === 'none' ? undefined : note || undefined,
      })
      if (!success) {
        setError('Unable to save reimbursement. Please try again.')
        return
      }
      onClose()
    } catch {
      setError('Unable to save reimbursement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    setError(null)
    try {
      const success = await update(t.id, {
        reimbursementStatus: 'none',
        reimbursementAmount: undefined,
        reimbursementPerson: undefined,
        reimbursementPaid: false,
        reimbursementNote: undefined,
      })
      if (!success) {
        setError('Unable to clear reimbursement. Please try again.')
        return
      }
      onClose()
    } catch {
      setError('Unable to clear reimbursement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={ref}
      className="bg-white border border-slate-200 rounded-xl shadow-card-md p-4 pb-6 w-64 max-h-[80vh] overflow-y-auto animate-slide-in"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <DollarSign size={14} className="text-accent-600" />
          Reimbursement
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Status */}
        <div className="flex gap-2">
          {(['none', 'settled', 'partial'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                status === s
                  ? 'bg-accent-600 text-white border-accent-600'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {s === 'settled' ? 'Full' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {status !== 'none' && (
          <>
            {status === 'partial' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Reimbursable amount ($)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(t.amount.toFixed(2))}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1">Who owes you?</label>
              <select
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
              >
                <option value="">Select person</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., dinner with team"
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="rounded border-slate-300 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-xs text-slate-600">Already paid back</span>
            </label>
          </>
        )}

        <div className="flex gap-2 pt-1">
          {t.reimbursementStatus !== 'none' && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-accent-600 text-white rounded-lg text-xs font-medium hover:bg-accent-700 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
