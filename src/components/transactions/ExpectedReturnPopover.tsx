import { useState, useRef, useEffect } from 'react'
import type { Transaction } from '@/types'
import { useTransactionStore } from '@/stores/transactionStore'

interface Props {
  transaction: Transaction
  onClose: () => void
}

export default function ExpectedReturnPopover({ transaction: t, onClose }: Props) {
  const { update } = useTransactionStore()
  const [amount, setAmount] = useState(
    String(t.expectedReturnAmount ?? Math.abs(t.amount)),
  )
  const [note, setNote] = useState(t.expectedReturnNote ?? '')
  const [saving, setSaving] = useState(false)

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const isAlreadySet = t.expectingReturn

  const handleSave = async () => {
    setSaving(true)
    await update(t.id, {
      expectingReturn: true,
      expectedReturnAmount: parseFloat(amount) || Math.abs(t.amount),
      expectedReturnNote: note || undefined,
      returnStatus: 'pending',
    })
    setSaving(false)
    onClose()
  }

  const handleRemove = async () => {
    setSaving(true)
    await update(t.id, {
      expectingReturn: false,
      expectedReturnAmount: undefined,
      expectedReturnNote: undefined,
      returnStatus: undefined,
      returnMatchedTransactionId: undefined,
    })
    setSaving(false)
    onClose()
  }

  const handleMarkCompleted = async () => {
    setSaving(true)
    await update(t.id, { returnStatus: 'completed' })
    setSaving(false)
    onClose()
  }

  return (
    <div ref={ref} className="bg-white border border-slate-200 rounded-xl shadow-card-md p-3 w-64 animate-slide-in">
      <p className="text-xs font-semibold text-purple-700 mb-2">
        {isAlreadySet ? 'Expected Return' : 'Mark as Expecting Return'}
      </p>

      {isAlreadySet && t.returnStatus === 'pending' && (
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleMarkCompleted}
            disabled={saving}
            className="flex-1 text-xs bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700 disabled:opacity-50"
          >
            Mark Completed
          </button>
          <button
            onClick={handleRemove}
            disabled={saving}
            className="text-xs text-red-500 hover:text-red-700 px-2 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}

      {isAlreadySet && t.returnStatus === 'completed' && (
        <div className="text-xs text-green-600 bg-green-50 rounded-lg px-2 py-1 mb-2">
          Return received
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Expected refund amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0"
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Returned shoes, 5-7 days"
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-xs bg-purple-600 text-white rounded-lg py-1.5 hover:bg-purple-700 disabled:opacity-50"
          >
            {isAlreadySet ? 'Update' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
