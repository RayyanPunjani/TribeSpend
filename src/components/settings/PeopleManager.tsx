import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, User } from 'lucide-react'
import { usePersonStore } from '@/stores/personStore'
import { useCardStore } from '@/stores/cardStore'
import { useAuth } from '@/contexts/AuthContext'
import ColorPicker from '@/components/shared/ColorPicker'
import { hexToRgba } from '@/utils/colors'
import { buildCardDisplayName } from '@/utils/cardNames'

export default function PeopleManager() {
  const { persons, add, update, remove } = usePersonStore()
  const { cards, update: updateCard } = useCardStore()
  const { householdId } = useAuth()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    await add(householdId!, newName.trim(), newColor)
    setNewName('')
    setNewColor('#3b82f6')
    setAdding(false)
  }

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id)
    setEditName(name)
    setEditColor(color)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const nextName = editName.trim()
    await update(editingId, { name: nextName, color: editColor })
    await Promise.all(
      cards
        .filter((card) => card.owner === editingId && !card.isCustomName && !card.isPaymentMethod)
        .map((card) => updateCard(card.id, { name: buildCardDisplayName(nextName, card.cardType || 'Card') })),
    )
    setEditingId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-700">People</h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium"
        >
          <Plus size={14} /> Add Person
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {persons.map((person) => (
          <div
            key={person.id}
            className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white sm:items-center"
            style={{ borderLeftColor: person.color, borderLeftWidth: 3 }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
              style={{ backgroundColor: person.color }}
            >
              {person.name.charAt(0).toUpperCase()}
            </div>

            {editingId === person.id ? (
              <div className="flex-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  autoFocus
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveEdit} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 hover:text-green-700">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{person.name}</p>
                  <p className="text-xs text-slate-400">{person.cards.length} card(s)</p>
                </div>
                <button
                  onClick={() => startEdit(person.id, person.name, person.color)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => remove(person.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        {persons.length === 0 && !adding && (
          <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl">
            <User size={24} className="mx-auto mb-2 opacity-40" />
            No people added yet
          </div>
        )}

        {adding && (
          <div className="p-3 rounded-xl border border-accent-200 bg-accent-50 flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Name (e.g., Rayyan)"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white"
              autoFocus
            />
            <div>
              <p className="text-xs text-slate-500 mb-2">Pick a color:</p>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-accent-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-accent-700 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setNewName('') }}
                className="px-4 text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
