import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Palette, Plus, Tag, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCategoryStore, type HouseholdCategory } from '@/stores/categoryStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { CATEGORIES, CATEGORY_COLORS } from '@/utils/categories'

const COLOR_SWATCHES = [
  '#0d9488', '#22c55e', '#f97316', '#eab308', '#06b6d4',
  '#8b5cf6', '#ec4899', '#f43f5e', '#64748b', '#94a3b8',
]

export default function CategoriesManager() {
  const { householdId } = useAuth()
  const { categories, add, update, archive, archiveName } = useCategoryStore()
  const { transactions } = useTransactionStore()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0])
  const [editing, setEditing] = useState<HouseholdCategory | null>(null)
  const [editingDefault, setEditingDefault] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(COLOR_SWATCHES[0])
  const [error, setError] = useState<string | null>(null)

  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const transaction of transactions) {
      counts.set(transaction.category, (counts.get(transaction.category) ?? 0) + 1)
    }
    return counts
  }, [transactions])

  const archivedDefaultNames = new Set(
    categories
      .filter((category) => category.archived)
      .map((category) => category.name.toLowerCase()),
  )

  const defaultRows = CATEGORIES
    .filter((name) => !archivedDefaultNames.has(name.toLowerCase()))
    .map((name) => ({
    name,
    color: CATEGORY_COLORS[name] ?? '#94a3b8',
    count: usage.get(name) ?? 0,
  }))

  const customRows = categories.filter((category) => !category.archived)
  const archivedRows = categories.filter((category) => category.archived)

  const isDuplicate = (name: string, ignoreId?: string) => {
    const key = name.trim().toLowerCase()
    if (!key) return false
    if (CATEGORIES.some((category) => category.toLowerCase() === key)) return true
    return categories.some((category) => category.id !== ignoreId && category.name.toLowerCase() === key)
  }

  const handleAdd = async () => {
    const name = newName.trim()
    setError(null)
    if (!name) return
    if (isDuplicate(name)) {
      setError('That category already exists.')
      return
    }
    try {
      await add(householdId!, { name, color: newColor })
      setNewName('')
      setNewColor(COLOR_SWATCHES[0])
    } catch {
      setError('Unable to add category. Please try again.')
    }
  }

  const startEdit = (category: HouseholdCategory) => {
    setEditing(category)
    setEditName(category.name)
    setEditColor(category.color || '#94a3b8')
    setError(null)
  }

  const saveEdit = async () => {
    if (!editing) return
    const name = editName.trim()
    setError(null)
    if (!name) return
    if (isDuplicate(name, editing.id)) {
      setError('That category already exists.')
      return
    }
    const ok = await update(editing.id, { name, color: editColor })
    if (!ok) {
      setError('Unable to update category. Please try again.')
      return
    }
    setEditing(null)
  }

  const startEditDefault = (name: string, color: string) => {
    setEditingDefault(name)
    setEditName(name)
    setEditColor(color)
    setError(null)
  }

  const saveDefaultRename = async () => {
    if (!editingDefault) return
    const name = editName.trim()
    setError(null)
    if (!name) return
    if (isDuplicate(name) && name.toLowerCase() !== editingDefault.toLowerCase()) {
      setError('That category already exists.')
      return
    }
    if (name.toLowerCase() === editingDefault.toLowerCase()) {
      setEditingDefault(null)
      return
    }
    const archived = await archiveName(householdId!, editingDefault)
    if (!archived) {
      setError('Unable to rename category. Please try again.')
      return
    }
    try {
      await add(householdId!, { name, color: editColor })
      setEditingDefault(null)
    } catch {
      setError('Unable to rename category. Please try again.')
    }
  }

  const handleArchive = async (category: HouseholdCategory) => {
    const count = usage.get(category.name) ?? 0
    if (count > 0) {
      const confirmed = window.confirm(
        `"${category.name}" is used by ${count} transaction${count === 1 ? '' : 's'}. Archiving hides it from new category menus but keeps existing transactions unchanged. Continue?`,
      )
      if (!confirmed) return
    }
    await archive(category.id)
  }

  const handleArchiveDefault = async (name: string) => {
    const count = usage.get(name) ?? 0
    if (count > 0) {
      const confirmed = window.confirm(
        `"${name}" is used by ${count} transaction${count === 1 ? '' : 's'}. Archiving hides it from new category menus but keeps existing transactions unchanged. Continue?`,
      )
      if (!confirmed) return
    }
    await archiveName(householdId!, name)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Categories</h3>
        <p className="text-sm text-slate-500 mt-1">
          Add household categories for transactions, budgets, filters, and import review.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Categories</p>
        {customRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            <Tag size={22} className="mx-auto mb-2 opacity-40" />
            No custom categories yet.
          </div>
        ) : (
          customRows.map((category) => (
            <div key={category.id} className="rounded-xl border border-slate-200 px-4 py-3">
              {editing?.id === category.id ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <button onClick={saveEdit} className="text-green-600 hover:text-green-700">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <CategoryRow
                  name={category.name}
                  color={category.color || '#94a3b8'}
                  count={usage.get(category.name) ?? 0}
                  tag="Custom"
                  actions={
                    <>
                      <button onClick={() => startEdit(category)} className="text-slate-400 hover:text-slate-600">
                        Rename
                      </button>
                      <button onClick={() => handleArchive(category)} className="text-slate-400 hover:text-red-600">
                        Archive
                      </button>
                    </>
                  }
                />
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default Categories</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {defaultRows.map((category) => (
            <div key={category.name} className="rounded-xl border border-slate-100 px-3 py-2">
              {editingDefault === category.name ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <button onClick={saveDefaultRename} className="text-green-600 hover:text-green-700">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditingDefault(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <CategoryRow
                  name={category.name}
                  color={category.color}
                  count={category.count}
                  tag="Default"
                  actions={
                    <>
                      <button onClick={() => startEditDefault(category.name, category.color)} className="text-slate-400 hover:text-slate-600">
                        Rename
                      </button>
                      <button onClick={() => handleArchiveDefault(category.name)} className="text-slate-400 hover:text-red-600">
                        Archive
                      </button>
                    </>
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {archivedRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Archived</p>
          {archivedRows.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-400">
              <span>{category.name}</span>
              <button
                onClick={() => update(category.id, { archived: false })}
                className="text-xs font-medium text-accent-700 hover:text-accent-800"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  name,
  color,
  count,
  tag,
  actions,
}: {
  name: string
  color: string
  count: number
  tag: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
          <p className="text-xs text-slate-400">
            {tag} · {count} transaction{count === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 text-xs font-medium shrink-0">{actions}</div>}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
      <Palette size={13} className="text-slate-400" />
      {COLOR_SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-4 h-4 rounded-full border ${value === color ? 'border-slate-800' : 'border-white'}`}
          style={{ backgroundColor: color }}
          aria-label={`Use ${color}`}
        />
      ))}
    </div>
  )
}
