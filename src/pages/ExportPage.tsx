import { useState } from 'react'
import { Download, FileText, Table, DollarSign } from 'lucide-react'
import { useTransactionStore, applyFilters, defaultFilters } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { exportToCSV, exportToExcel, exportReimbursementReport } from '@/services/exportService'

export default function ExportPage() {
  const { transactions, filters } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [includeHidden, setIncludeHidden] = useState(false)

  const exportTransactions = includeHidden ? transactions : transactions.filter((t) => !t.deleted)
  const filteredTransactions = applyFilters(exportTransactions, {
    ...filters,
    showDeleted: includeHidden || filters.showDeleted,
  })
  const rangeFiltered = exportTransactions.filter((t) => {
    if (dateStart && t.transDate < dateStart) return false
    if (dateEnd && t.transDate > dateEnd) return false
    return true
  })

  const exports = [
    {
      icon: <Table size={20} className="text-accent-600" />,
      title: 'All Transactions (CSV)',
      description: `Export ${exportTransactions.length} transaction${exportTransactions.length !== 1 ? 's' : ''} as a CSV file`,
      action: () => exportToCSV(exportTransactions, cards, persons, 'tribespend-all.csv'),
    },
    {
      icon: <FileText size={20} className="text-blue-600" />,
      title: 'All Transactions (Excel)',
      description: `Export ${exportTransactions.length} transaction${exportTransactions.length !== 1 ? 's' : ''} as an Excel file`,
      action: () => exportToExcel(exportTransactions, cards, persons, 'tribespend-all.xlsx'),
    },
    {
      icon: <Table size={20} className="text-green-600" />,
      title: 'Current Filtered View (CSV)',
      description: `Export the currently filtered view — ${filteredTransactions.length} transactions`,
      action: () => exportToCSV(filteredTransactions, cards, persons, 'tribespend-filtered.csv'),
    },
    {
      icon: <FileText size={20} className="text-purple-600" />,
      title: 'Current Filtered View (Excel)',
      description: `Export the currently filtered view — ${filteredTransactions.length} transactions`,
      action: () => exportToExcel(filteredTransactions, cards, persons, 'tribespend-filtered.xlsx'),
    },
    {
      icon: <DollarSign size={20} className="text-orange-600" />,
      title: 'Reimbursement Report (Excel)',
      description: 'Export a detailed reimbursement report grouped by person',
      action: () => exportReimbursementReport(exportTransactions, cards, persons),
    },
  ]

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Download your transaction data in CSV or Excel format.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={includeHidden}
          onChange={(e) => setIncludeHidden(e.target.checked)}
          className="rounded border-slate-300 text-accent-600"
        />
        Include hidden transactions
      </label>

      {/* Quick exports */}
      <div className="flex flex-col gap-3">
        {exports.map((exp, i) => (
          <button
            key={i}
            onClick={exp.action}
            disabled={exportTransactions.length === 0}
            className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-slate-300 hover:shadow-card transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              {exp.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{exp.title}</p>
              <p className="text-xs text-slate-500">{exp.description}</p>
            </div>
            <Download size={15} className="text-slate-400 shrink-0" />
          </button>
        ))}
      </div>

      {/* Custom date range export */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-700">Export by Date Range</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToCSV(rangeFiltered, cards, persons, 'tribespend-range.csv')}
            disabled={rangeFiltered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            <Download size={14} /> CSV ({rangeFiltered.length})
          </button>
          <button
            onClick={() => exportToExcel(rangeFiltered, cards, persons, 'tribespend-range.xlsx')}
            disabled={rangeFiltered.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Download size={14} /> Excel
          </button>
        </div>
      </div>
    </div>
  )
}
