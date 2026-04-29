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

const PARENT_CATEGORIES = CATEGORIES.filter(
  (category) => !['Needs Review', 'Refunds & Credits'].includes(category),
)

export default function CategoriesManager() {
  const { householdId } = useAuth()
  const { categories, add, update, archive, archiveName } = useCategoryStore()
  const { transactions } = useTransactionStore()
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState('')
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0])
  const [editing, setEditing] = useState<HouseholdCategory | null>(null)
  const [editingDefault, setEditingDefault] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editParent, setEditParent] = useState('')
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

  const customRows = categories.filter(
    (category) => !category.archived && !CATEGORIES.some((defaultName) => defaultName.toLowerCase() === category.name.toLowerCase()),
  )
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
    if (!name || !newParent) return
    if (isDuplicate(name)) {
      setError('That category already exists.')
      return
    }
    try {
      await add(householdId!, { name, parentCategory: newParent, color: newColor })
      setNewName('')
      setNewParent('')
      setNewColor(COLOR_SWATCHES[0])
    } catch {
      setError('Unable to add category. Please try again.')
    }
  }

  const startEdit = (category: HouseholdCategory) => {
    setEditing(category)
    setEditName(category.name)
    setEditParent(category.parentCategory || '')
    setEditColor(category.color || '#94a3b8')
    setError(null)
  }

  const saveEdit = async () => {
    if (!editing) return
    const name = editName.trim()
    setError(null)
    if (!name || !editParent) return
    if (isDuplicate(name, editing.id)) {
      setError('That category already exists.')
      return
    }
    const ok = await update(editing.id, { name, parentCategory: editParent, color: editColor })
    if (!ok) {
      setError('Unable to update category. Please try again.')
      return
    }
    setEditing(null)
  }

  const startEditDefault = (name: string, color: string) => {
    setEditingDefault(name)
    setEditName(name)
    setEditParent(name)
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
      await add(householdId!, { name, parentCategory: editingDefault, color: editColor })
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
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <ParentCategorySelect value={newParent} onChange={setNewParent} />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newParent}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            Parent category controls reward behavior. For example, Takeout can inherit Dining rewards.
          </p>
          <ColorPicker value={newColor} onChange={setNewColor} />
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
                <CategoryEditForm
                  name={editName}
                  parent={editParent}
                  color={editColor}
                  showParent
                  onNameChange={setEditName}
                  onParentChange={setEditParent}
                  onColorChange={setEditColor}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <CategoryRow
                  name={category.name}
                  parent={category.parentCategory}
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
                <CategoryEditForm
                  name={editName}
                  parent={editParent}
                  color={editColor}
                  onNameChange={setEditName}
                  onParentChange={setEditParent}
                  onColorChange={setEditColor}
                  onSave={saveDefaultRename}
                  onCancel={() => setEditingDefault(null)}
                />
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
                        Hide
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
              <span>
                {category.name}
                {CATEGORIES.some((defaultName) => defaultName.toLowerCase() === category.name.toLowerCase()) && (
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-slate-300">Hidden default</span>
                )}
              </span>
              <button
                onClick={() => update(category.id, { archived: false })}
                className="text-xs font-medium text-accent-700 hover:text-accent-800"
              >
                {CATEGORIES.some((defaultName) => defaultName.toLowerCase() === category.name.toLowerCase()) ? 'Unhide' : 'Restore'}
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
  parent,
  color,
  count,
  tag,
  actions,
}: {
  name: string
  parent?: string
  color: string
  count: number
  tag: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
          <p className="text-xs text-slate-400">
            {tag} · {count} transaction{count === 1 ? '' : 's'}
            {parent && ` · inherits ${parent}`}
          </p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 text-xs font-medium shrink-0">{actions}</div>}
    </div>
  )
}

function CategoryEditForm({
  name,
  parent,
  color,
  showParent = false,
  onNameChange,
  onParentChange,
  onColorChange,
  onSave,
  onCancel,
}: {
  name: string
  parent: string
  color: string
  showParent?: boolean
  onNameChange: (value: string) => void
  onParentChange: (value: string) => void
  onColorChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className={`grid grid-cols-1 ${showParent ? 'md:grid-cols-2' : ''} gap-2`}>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
        {showParent && <ParentCategorySelect value={parent} onChange={onParentChange} />}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <ColorPicker value={color} onChange={onColorChange} />
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onSave}
            disabled={!name.trim() || (showParent && !parent)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 hover:text-green-700 disabled:opacity-40"
            aria-label="Save category"
          >
            <Check size={16} />
          </button>
          <button
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cancel category edit"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ParentCategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
    >
      <option value="">Parent reward category</option>
      {PARENT_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
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
