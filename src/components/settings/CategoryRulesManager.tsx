import { useState } from 'react'
import { Trash2, Edit2, Check, X, Upload, Download, BookMarked } from 'lucide-react'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/utils/categories'
import { formatDate } from '@/utils/formatters'

export default function CategoryRulesManager() {
  const { rules, update, remove, importRules } = useCategoryRuleStore()
  const { transactions, updateMany } = useTransactionStore()
  const { householdId } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPattern, setEditPattern] = useState('')
  const [editClean, setEditClean] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [applyStatus, setApplyStatus] = useState<Record<string, 'idle' | 'applying' | 'done'>>({})

  const startEdit = (id: string, pattern: string, clean: string, category: string) => {
    setEditingId(id)
    setEditPattern(pattern)
    setEditClean(clean)
    setEditCategory(category)
  }

  const saveEdit = async () => {
    if (!editingId) return
    await update(editingId, {
      merchantPattern: editPattern.toLowerCase().trim(),
      cleanDescription: editClean,
      category: editCategory,
    })
    setEditingId(null)
  }

  const applyToExisting = async (ruleId: string, pattern: string, clean: string, category: string) => {
    setApplyStatus((s) => ({ ...s, [ruleId]: 'applying' }))
    const patternLower = pattern.toLowerCase().trim()
    const matchingIds = transactions
      .filter((t) =>
        t.description.toLowerCase().includes(patternLower) ||
        t.cleanDescription.toLowerCase().includes(patternLower),
      )
      .map((t) => t.id)
    if (matchingIds.length > 0) {
      await updateMany(matchingIds, { category, cleanDescription: clean, ruleMatched: true })
    }
    setApplyStatus((s) => ({ ...s, [ruleId]: 'done' }))
    setTimeout(() => setApplyStatus((s) => ({ ...s, [ruleId]: 'idle' })), 2000)
  }

  const handleExport = () => {
    const json = JSON.stringify(rules, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tribespend-category-rules.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (Array.isArray(data)) {
          await importRules(householdId!, data)
        }
      } catch {
        alert('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Category Rules ({rules.length})
        </h3>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium cursor-pointer">
            <Upload size={12} /> Import
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl">
          <BookMarked size={24} className="mx-auto mb-2 opacity-40" />
          <p>No rules yet. Rules are created when you correct transaction categories.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4 font-medium">Pattern</th>
                <th className="pb-2 pr-4 font-medium">Clean Name</th>
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium">Matches</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  {editingId === rule.id ? (
                    <>
                      <td className="py-2 pr-3">
                        <input value={editPattern} onChange={(e) => setEditPattern(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-accent-500" />
                      </td>
                      <td className="py-2 pr-3">
                        <input value={editClean} onChange={(e) => setEditClean(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-accent-500" />
                      </td>
                      <td className="py-2 pr-3">
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-accent-500">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3 text-slate-400">{rule.matchCount ?? 0}</td>
                      <td className="py-2 flex gap-1">
                        <button onClick={saveEdit} className="text-green-600"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400"><X size={14} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-3">
                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {rule.merchantPattern}
                        </code>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{rule.cleanDescription}</td>
                      <td className="py-2 pr-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {rule.category}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-400">{rule.matchCount ?? 0}</td>
                      <td className="py-2">
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={() => startEdit(rule.id, rule.merchantPattern, rule.cleanDescription, rule.category)}
                            className="text-slate-400 hover:text-slate-600">
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => applyToExisting(rule.id, rule.merchantPattern, rule.cleanDescription, rule.category)}
                            disabled={applyStatus[rule.id] === 'applying'}
                            className="text-xs text-accent-600 hover:text-accent-700 font-medium whitespace-nowrap"
                            title="Apply to existing transactions">
                            {applyStatus[rule.id] === 'applying' ? '...' :
                             applyStatus[rule.id] === 'done' ? '✓' : 'Apply'}
                          </button>
                          <button onClick={() => remove(rule.id)}
                            className="text-slate-400 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
