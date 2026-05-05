import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { Loader2, AlertCircle, CheckCircle, Plus, Sheet } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/formatters'
import DropZone, { isCsvFile } from '@/components/upload/DropZone'
import CardAssignment, { type CardholderAssignment } from '@/components/upload/CardAssignment'
import ParseReview from '@/components/upload/ParseReview'
import ColumnMapper from '@/components/upload/ColumnMapper'
import AddTransactionModal from '@/components/transactions/AddTransactionModal'
import {
  detectAndParseCSV,
  parseRowsWithFormat,
  parseRowsWithMapping,
  findDuplicates,
} from '@/services/csvParser'
import { categorizeCsvRows } from '@/services/csvCategorizer'
import { matchRefunds } from '@/services/refundMatcher'
import { runRecurringDetector } from '@/services/recurringDetector'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuth } from '@/contexts/AuthContext'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryStore } from '@/stores/categoryStore'
// Statement metadata is no longer persisted separately
import type {
  Transaction,
  CsvParsedRow,
  CsvFieldRole,
} from '@/types'

type Step = 'upload' | 'parsing' | 'mapping' | 'csv-assign' | 'review' | 'done'

interface UploadItem {
  file: File
  status: 'pending' | 'extracting' | 'parsing' | 'done' | 'error'
  error?: string
  csvRows?: CsvParsedRow[]
  duplicateIndices?: Set<number>
}

const BANK_HINTS = [
  { name: 'Chase',          hint: 'Activity → Download → CSV' },
  { name: 'Capital One',    hint: 'Accounts → Download → CSV' },
  { name: 'Amex',           hint: 'Activity → Export → CSV' },
  { name: 'Bank of America', hint: 'Accounts → Download → CSV' },
  { name: 'Discover',       hint: 'Activity → Export Transactions' },
  { name: 'Citi',           hint: 'Account Details → Download' },
]

export default function UploadPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [items, setItems] = useState<UploadItem[]>([])
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [returnMatches, setReturnMatches] = useState<Array<{ pending: Transaction; credit: Transaction }>>([])
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [importedCardId, setImportedCardId] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [summaryToasts, setSummaryToasts] = useState<Array<{ id: string; message: string }>>([])

  const [pendingCsvDetect, setPendingCsvDetect] = useState<{
    file: File
    index: number
    headers: string[]
    rows: Record<string, string>[]
  } | null>(null)

  const [csvCardholderGroups, setCsvCardholderGroups] = useState<
    Array<{ cardholderName: string; lastFour?: string; rows: CsvParsedRow[] }>
  >([])

  const { settings } = useSettingsStore()
  const { rules } = useCategoryRuleStore()
  const { addMany: addTransactions, transactions: existingTransactions, update: updateTransaction, updateMany } = useTransactionStore()
  const { householdId } = useAuth()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const categoryNames = useCategoryStore((s) => s.categoryNames)

  const addSummaryToast = (message: string) => {
    const id = Math.random().toString(36).slice(2)
    setSummaryToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setSummaryToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFiles = (files: File[]) => {
    const csvFiles = files.filter(isCsvFile)
    if (!csvFiles.length) return
    const newItems: UploadItem[] = csvFiles.map((file) => ({ file, status: 'pending' }))
    setItems(newItems)
    setStep('parsing')
    processFiles(csvFiles, newItems).catch((err) => {
      setParseError(String(err))
    })
  }

  const setItemStatus = (i: number, status: UploadItem['status'], extra?: Partial<UploadItem>) => {
    setItems((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], status, ...extra }
      return next
    })
  }

  const processFiles = async (files: File[], initialItems: UploadItem[]) => {
    setParseError(null)
    for (let i = 0; i < files.length; i++) {
      await processCsvFile(files[i], i, initialItems)
    }
  }

  const processCsvFile = async (file: File, i: number, _items: UploadItem[]) => {
    setItemStatus(i, 'extracting')
    try {
      const detected = await detectAndParseCSV(file)

      if (detected.confidence === 'low' && !detected.savedMapping) {
        setPendingCsvDetect({ file, index: i, headers: detected.headers, rows: detected.rows })
        setStep('mapping')
        return
      }

      await finalizeCsvParsing(i, file, detected.rows, detected.format, detected.savedMapping?.mapping)
    } catch (err) {
      const msg = String(err)
      setItemStatus(i, 'error', { error: msg })
      setParseError(msg)
    }
  }

  const finalizeCsvParsing = async (
    i: number,
    file: File,
    rows: Record<string, string>[],
    format: string,
    customMapping?: Record<string, CsvFieldRole>,
  ) => {
    setItemStatus(i, 'parsing')
    let csvRows: CsvParsedRow[]

    if (customMapping) {
      csvRows = parseRowsWithMapping(rows, customMapping)
    } else {
      csvRows = parseRowsWithFormat(format as any, rows)
    }

    csvRows = await categorizeCsvRows(
      csvRows,
      rules,
      settings.anthropicApiKey,
      settings.anthropicModel || 'claude-sonnet-4-20250514',
      categoryNames,
    )

    const dupeIndices = findDuplicates(
      csvRows,
      existingTransactions.map((t) => ({
        transDate: t.transDate,
        amount: t.amount,
        description: t.description,
      })),
    )

    setItemStatus(i, 'done', { csvRows, duplicateIndices: dupeIndices })

    const groups = new Map<string, CsvParsedRow[]>()
    for (const row of csvRows) {
      const key = row.cardholderName
        ? `${row.cardholderName}|${row.cardLastFour ?? ''}`
        : `default|${row.cardLastFour ?? ''}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    }

    const groupArr = Array.from(groups.entries()).map(([key, groupRows]) => {
      const [name, lastFour] = key.split('|')
      return {
        cardholderName: name === 'default' ? '' : name,
        lastFour: lastFour || undefined,
        rows: groupRows,
      }
    })

    setCsvCardholderGroups(groupArr)
    setStep('csv-assign')
  }

  const handleColumnMappingDone = async (mapping: Record<string, CsvFieldRole>) => {
    if (!pendingCsvDetect) return
    const { file, index, rows } = pendingCsvDetect
    setPendingCsvDetect(null)
    setStep('parsing')
    await finalizeCsvParsing(index, file, rows, 'unknown', mapping)
  }

  // ── Card assignment ────────────────────────────────────────────────────────

  const handleCsvAssign = (assignments: CardholderAssignment[]) => {
    const allTransactions: Transaction[] = []
    const statementId = uuidv4()

    for (const assignment of assignments) {
      const group = csvCardholderGroups.find((g) => {
        const matchName = !g.cardholderName || g.cardholderName === assignment.cardholderName
        const matchFour = !g.lastFour || g.lastFour === assignment.lastFour
        return matchName && matchFour
      })
      if (!group) continue

      for (const row of group.rows) {
        allTransactions.push({
          id: uuidv4(),
          transDate: row.transDate,
          postDate: row.postDate,
          description: row.description,
          cleanDescription: row.cleanDescription,
          amount: row.amount,
          category: row.category,
          cardId: row.cardId || assignment.cardId,
          personId: row.personId || assignment.personId || undefined,
          cardholderName: persons.find((p) => p.id === (row.personId || assignment.personId))?.name || assignment.cardholderName || persons[0]?.name || '',
          isPayment: row.isPayment,
          isCredit: row.isCredit,
          isBalancePayment: row.isBalancePayment,
          statementId,
          reimbursementStatus: 'none',
          reimbursementPaid: false,
          notes: row.notes,
          source: 'csv',
          refundForId: null,
          hasRefund: false,
          refundReviewPending: row.isBalancePayment ? false : row.refundReviewPending === true,
        })
      }
    }

    const csvItem = items[0]
    if (csvItem) {
      const dates = allTransactions.map((t) => t.transDate).sort()
      // Statement metadata logged for reference but not persisted separately
      console.log('CSV import:', {
        fileName: csvItem.file.name,
        statementId,
        transactionCount: allTransactions.length,
      })
    }

    setImportedCardId(assignments[0]?.cardId ?? null)
    setPendingTransactions(allTransactions)
    setStep('review')
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleConfirm = async (transactions: Transaction[]) => {
    await addTransactions(householdId!, transactions)
    setImportedCount(transactions.length)

    const refundMatches = matchRefunds(transactions, existingTransactions)
    try {
      await Promise.all([
        ...refundMatches.updatedRefunds.map((refund) =>
          updateTransaction(refund.id, {
            refundForId: refund.refundForId,
            refundReviewPending: refund.refundReviewPending,
          }),
        ),
        ...refundMatches.updatedOriginals.map((original) =>
          updateTransaction(original.id, { hasRefund: true }),
        ),
      ])
    } catch (err) {
      console.warn('[UploadPage] Non-critical refund matching updates failed:', err)
    }

    if (refundMatches.autoMatched > 0 || refundMatches.pendingReview > 0) {
      addSummaryToast(`${refundMatches.autoMatched} refunds auto-matched, ${refundMatches.pendingReview} need review`)
    }

    // Auto-detect recurring charges across all transactions (including newly added)
    const { transactions: allTxns } = useTransactionStore.getState()
    runRecurringDetector(allTxns, updateMany).catch(() => {/* non-blocking */})

    const pendingReturns = existingTransactions.filter(
      (t) => t.expectingReturn && t.returnStatus === 'pending' && !t.deleted,
    )
    const newCredits = transactions.filter((t) => t.isCredit && !t.isBalancePayment)

    if (pendingReturns.length > 0 && newCredits.length > 0) {
      const matches: Array<{ pending: Transaction; credit: Transaction }> = []
      for (const pending of pendingReturns) {
        const expectedAmt = pending.expectedReturnAmount ?? pending.amount
        const pendingMerchant = pending.cleanDescription.toLowerCase()
        for (const credit of newCredits) {
          const creditMerchant = credit.cleanDescription.toLowerCase()
          const amountClose = Math.abs(Math.abs(credit.amount) - expectedAmt) / Math.max(expectedAmt, 0.01) < 0.25
          const merchantMatch =
            pendingMerchant.includes(creditMerchant) ||
            creditMerchant.includes(pendingMerchant) ||
            pendingMerchant.split(' ').some((w) => w.length > 3 && creditMerchant.includes(w))
          if (amountClose && merchantMatch) matches.push({ pending, credit })
        }
      }
      setReturnMatches(matches)
    }

    setStep('done')
    navigate('/app/transactions')
  }

  const handleConfirmReturnMatch = async (pendingId: string, creditId: string) => {
    await updateTransaction(pendingId, {
      returnStatus: 'completed',
      returnMatchedTransactionId: creditId,
    })
    setDismissedMatches((s) => new Set(s).add(pendingId))
  }

  const resetUpload = () => {
    setStep('upload')
    setItems([])
    setReturnMatches([])
    setSummaryToasts([])
    setCsvCardholderGroups([])
    setPendingCsvDetect(null)
    setParseError(null)
    setImportedCardId(null)
  }

  // ── Done screen ────────────────────────────────────────────────────────────

  if (step === 'done') {
    const importedCard = importedCardId ? cards.find((c) => c.id === importedCardId) : null
    const activeMatches = returnMatches.filter((m) => !dismissedMatches.has(m.pending.id))

    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
          {summaryToasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2"
            >
              <CheckCircle size={14} className="text-green-400 shrink-0" />
              {toast.message}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-5 py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={36} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Import complete</h2>
            <p className="text-slate-500 mt-1.5">
              {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported
              {importedCard && (
                <span className="text-slate-400">
                  {' '}from {importedCard.name}
                  {importedCard.lastFour && <span className="font-mono"> ···{importedCard.lastFour}</span>}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetUpload}
              className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              Upload More
            </button>
            <Link
              to="/app/transactions"
              className="px-5 py-2.5 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors"
            >
              View Transactions
            </Link>
          </div>
        </div>

        {activeMatches.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-purple-700">Possible return matches found</p>
            {activeMatches.map(({ pending, credit }) => (
              <div key={pending.id} className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-sm text-purple-800">
                  A refund of <strong>{formatCurrency(Math.abs(credit.amount))}</strong> from{' '}
                  <strong>{credit.cleanDescription}</strong> might match your expected return for{' '}
                  <strong>{pending.cleanDescription}</strong> ({formatDate(pending.transDate, 'MMM d')}).
                </p>
                {pending.expectedReturnNote && (
                  <p className="text-xs text-purple-600 italic">"{pending.expectedReturnNote}"</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmReturnMatch(pending.id, credit.id)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
                  >
                    Yes, mark as received
                  </button>
                  <button
                    onClick={() => setDismissedMatches((s) => new Set(s).add(pending.id))}
                    className="px-3 py-1.5 text-purple-500 hover:text-purple-700 text-xs"
                  >
                    Not a match
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (step === 'mapping' && pendingCsvDetect) {
    return (
      <div className="max-w-4xl mx-auto">
        <ColumnMapper
          headers={pendingCsvDetect.headers}
          previewRows={pendingCsvDetect.rows.slice(0, 5)}
          onConfirm={handleColumnMappingDone}
          onCancel={resetUpload}
        />
      </div>
    )
  }

  if (step === 'csv-assign') {
    const pseudoCardholders = csvCardholderGroups.map((g) => ({
      name: g.cardholderName || 'Cardholder',
      last_four: g.lastFour ?? '0000',
      transactions: g.rows as any,
    }))
    return (
      <div className="max-w-2xl mx-auto">
        <CardAssignment
          cardholders={pseudoCardholders}
          onAssign={handleCsvAssign}
          onBack={resetUpload}
        />
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="max-w-5xl mx-auto">
        <ParseReview
          transactions={pendingTransactions}
          onConfirm={handleConfirm}
          onBack={() => setStep('csv-assign')}
        />
      </div>
    )
  }

  if (step === 'parsing') {
    const statuses: Record<UploadItem['status'], string> = {
      pending: 'Waiting…',
      extracting: 'Reading file…',
      parsing: 'Categorizing transactions…',
      done: '',
      error: '',
    }

    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <h2 className="text-xl font-bold text-slate-800">Processing</h2>

        {parseError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Could not read file</p>
              <p className="text-xs text-red-500 mt-1">{parseError}</p>
            </div>
          </div>
        )}

        {items.map((item, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Sheet size={18} className="text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.file.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {item.status === 'done'
                  ? `Ready — ${item.csvRows?.length ?? 0} transactions${item.duplicateIndices?.size ? ` · ${item.duplicateIndices.size} possible duplicates` : ''}`
                  : item.status === 'error'
                  ? <span className="text-red-500">{item.error}</span>
                  : statuses[item.status]}
              </p>
            </div>
            <div className="shrink-0">
              {(item.status === 'extracting' || item.status === 'parsing') && (
                <Loader2 size={18} className="text-accent-500 animate-spin" />
              )}
              {item.status === 'done' && <CheckCircle size={18} className="text-green-500" />}
              {item.status === 'error' && <AlertCircle size={18} className="text-red-500" />}
            </div>
          </div>
        ))}

        {parseError && (
          <button
            onClick={resetUpload}
            className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 self-start"
          >
            Try Again
          </button>
        )}
      </div>
    )
  }

  // ── Upload screen ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Upload Statement</h1>
          <p className="text-sm text-slate-500 mt-1">Import a CSV from your bank or credit card.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Plus size={15} /> Add Manually
        </button>
      </div>

      <DropZone onFiles={handleFiles} />

      {/* Bank helpers */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          Download your CSV from
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {BANK_HINTS.map(({ name, hint }) => (
            <div
              key={name}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
            >
              <p className="text-xs font-semibold text-slate-700">{name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddTransactionModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}
