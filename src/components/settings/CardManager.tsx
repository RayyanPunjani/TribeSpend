import { useState } from 'react'
import { Plus, Trash2, CreditCard, Wallet, Pencil, Info } from 'lucide-react'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useAuth } from '@/contexts/AuthContext'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import {
  PRESET_CARDS,
  getPresetBrand,
  buildRulesFromPreset,
  type PresetCardTemplate,
} from '@/data/presetCards'
import { CascadeForm, emptyForm, CUSTOM, type CardFormData } from '@/components/shared/CascadeCardForm'
import ColorPicker from '@/components/shared/ColorPicker'

const PAYMENT_METHOD_PRESETS = ['Cash', 'Zelle', 'Venmo', 'PayPal', 'Check', 'Wire Transfer', 'Other']

/** Reverse-lookup a preset by stored issuer + cardType */
function findPreset(issuer: string, cardType: string): PresetCardTemplate | null {
  return PRESET_CARDS.find((p) => p.issuer === issuer && p.cardType === cardType) ?? null
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CardManager() {
  const { cards, add: addCard, remove: removeCard, update: updateCard } = useCardStore()
  const { persons, addCardToPerson, removeCardFromPerson } = usePersonStore()
  const { add: addRule, getByCard } = useCardRewardStore()
  const { add: addCredit } = useCardCreditStore()
  const { householdId } = useAuth()
  const hid = householdId!

  // Add card
  const [showing, setShowing] = useState(false)
  const [form, setForm] = useState<CardFormData>({ ...emptyForm })
  const [selectedTemplate, setSelectedTemplate] = useState<PresetCardTemplate | null>(null)

  // Edit card
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CardFormData>({ ...emptyForm })
  const [editOriginalOwner, setEditOriginalOwner] = useState('')
  const [editSelectedTemplate, setEditSelectedTemplate] = useState<PresetCardTemplate | null>(null)

  // Payment method
  const [showingPaymentMethod, setShowingPaymentMethod] = useState(false)
  const [pmName, setPmName] = useState('')
  const [pmColor, setPmColor] = useState('#6b7280')

  const handleAdd = async () => {
    if (!form.lastFour || !form.owner) return
    const issuer = (selectedTemplate?.issuer ?? form.issuer) || 'Other'
    const cardType = (selectedTemplate?.cardType ?? form.cardType) || 'Other'
    const autoName = form.name || `${persons.find((p) => p.id === form.owner)?.name ?? ''}'s ${cardType}`
    const card = await addCard(hid, {
      name: autoName,
      issuer,
      cardType,
      lastFour: form.lastFour.slice(-4),
      owner: form.owner,
      color: form.color,
      annualFee: form.isAuthorizedUser ? undefined : (form.annualFee ? parseFloat(form.annualFee) : undefined),
      isAuthorizedUser: form.isAuthorizedUser,
    })
    await addCardToPerson(form.owner, card.id)

    if (selectedTemplate) {
      const { rules, credits } = buildRulesFromPreset(selectedTemplate, card.id)
      await Promise.all(rules.map((r) => addRule(hid, r)))
      await Promise.all(credits.map((c) => addCredit(hid, c)))
    }

    setForm({ ...emptyForm })
    setSelectedTemplate(null)
    setShowing(false)
  }

  const startEdit = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    setEditingId(cardId)
    setEditOriginalOwner(card.owner)
    setEditSelectedTemplate(null)

    // Reverse-lookup preset to pre-populate cascading dropdowns
    const preset = findPreset(card.issuer, card.cardType)
    setEditForm({
      name: card.name,
      brand: preset ? getPresetBrand(preset) : CUSTOM,
      cardName: preset ? preset.cardName : CUSTOM,
      issuer: card.issuer,
      cardType: card.cardType,
      lastFour: card.lastFour,
      owner: card.owner,
      color: card.color,
      annualFee: card.annualFee?.toString() ?? '',
      isAuthorizedUser: card.isAuthorizedUser ?? false,
    })
    setShowing(false)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const issuer = (editSelectedTemplate?.issuer ?? editForm.issuer) || 'Other'
    const cardType = (editSelectedTemplate?.cardType ?? editForm.cardType) || 'Other'
    const autoName = editForm.name || `${persons.find((p) => p.id === editForm.owner)?.name ?? ''}'s ${cardType}`
    await updateCard(editingId, {
      name: autoName,
      issuer,
      cardType,
      lastFour: editForm.lastFour.slice(-4),
      owner: editForm.owner,
      color: editForm.color,
      annualFee: editForm.isAuthorizedUser ? undefined : (editForm.annualFee ? parseFloat(editForm.annualFee) : undefined),
      isAuthorizedUser: editForm.isAuthorizedUser,
    })
    if (editForm.owner !== editOriginalOwner) {
      if (editOriginalOwner) await removeCardFromPerson(editOriginalOwner, editingId)
      if (editForm.owner) await addCardToPerson(editForm.owner, editingId)
    }

    if (editSelectedTemplate) {
      const { rules, credits } = buildRulesFromPreset(editSelectedTemplate, editingId)
      await Promise.all(rules.map((r) => addRule(hid, r)))
      await Promise.all(credits.map((c) => addCredit(hid, c)))
    }

    setEditingId(null)
    setEditSelectedTemplate(null)
  }

  const handleRemove = async (cardId: string, ownerId: string) => {
    await removeCard(cardId)
    if (ownerId) await removeCardFromPerson(ownerId, cardId)
  }

  const handleAddPaymentMethod = async () => {
    if (!pmName.trim()) return
    await addCard(hid, {
      name: pmName.trim(),
      issuer: 'Other',
      cardType: 'Payment Method',
      lastFour: '',
      owner: '',
      color: pmColor,
      isPaymentMethod: true,
      isAuthorizedUser: false,
    })
    setPmName('')
    setPmColor('#6b7280')
    setShowingPaymentMethod(false)
  }

  const creditCards = cards.filter((c) => !c.isPaymentMethod)
  const paymentMethods = cards.filter((c) => c.isPaymentMethod)

  return (
    <div>
      {/* ── Credit Cards header ── */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Credit Cards</h3>
        {persons.length > 0 ? (
          <button
            onClick={() => { setShowing(true); setEditingId(null) }}
            className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium"
          >
            <Plus size={14} /> Add Card
          </button>
        ) : null}
      </div>
      {persons.length === 0 && (
        <p className="text-xs text-slate-500 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Add at least one person in the <span className="font-medium">People</span> tab before adding cards.
        </p>
      )}
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          Don&apos;t see your card?{' '}
          <a
            href="mailto:tribespend@gmail.com?subject=Missing%20Card%20Request"
            className="font-medium text-accent-600 hover:text-accent-700"
          >
            Send us a quick email
          </a>{' '}
          and we&apos;ll work on getting it added.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {creditCards.map((card) => {
          const person = persons.find((p) => p.id === card.owner)

          if (editingId === card.id) {
            const existingRuleCount = getByCard(editingId).length
            return (
              <div key={card.id} className="p-4 rounded-xl border border-accent-200 bg-accent-50">
                <p className="text-xs font-semibold text-slate-600 mb-3">Edit Card</p>
                <CascadeForm
                  form={editForm}
                  setForm={setEditForm}
                  template={editSelectedTemplate}
                  setTemplate={setEditSelectedTemplate}
                  existingRuleCount={existingRuleCount}
                  submitLabel="Save"
                  onSubmit={handleSaveEdit}
                  onCancel={() => { setEditingId(null); setEditSelectedTemplate(null) }}
                  disableSubmit={!editForm.lastFour || !editForm.owner}
                  persons={persons}
                />
              </div>
            )
          }

          return (
            <div
              key={card.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white"
              style={{ borderLeftColor: card.color, borderLeftWidth: 3 }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: card.color + '22' }}
              >
                <CreditCard size={16} style={{ color: card.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{card.name}</p>
                  {card.isAuthorizedUser && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">AU</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {card.issuer} · ···{card.lastFour} · {person?.name ?? 'Unknown'}
                </p>
              </div>
              <button
                onClick={() => startEdit(card.id)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleRemove(card.id, card.owner)}
                className="text-slate-400 hover:text-red-500 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}

        {creditCards.length === 0 && !showing && (
          <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl">
            <CreditCard size={24} className="mx-auto mb-2 opacity-40" />
            No cards added yet
          </div>
        )}

        {showing && (
          <div className="p-4 rounded-xl border border-accent-200 bg-accent-50">
            <p className="text-xs font-semibold text-slate-600 mb-3">Add Card</p>
            <CascadeForm
              form={form}
              setForm={setForm}
              template={selectedTemplate}
              setTemplate={setSelectedTemplate}
              submitLabel="Add Card"
              onSubmit={handleAdd}
              onCancel={() => { setShowing(false); setForm({ ...emptyForm }); setSelectedTemplate(null) }}
              disableSubmit={!form.lastFour || !form.owner}
              persons={persons}
            />
          </div>
        )}
      </div>

      {/* ── Other Payment Methods ── */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Other Payment Methods</h3>
            <p className="text-xs text-slate-400 mt-0.5">Cash, Zelle, Venmo, etc. — for manual transactions</p>
          </div>
          <button
            onClick={() => setShowingPaymentMethod(true)}
            className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white"
              style={{ borderLeftColor: pm.color, borderLeftWidth: 3 }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: pm.color + '22' }}
              >
                <Wallet size={16} style={{ color: pm.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{pm.name}</p>
                <p className="text-xs text-slate-400">Payment method</p>
              </div>
              <button
                onClick={() => removeCard(pm.id)}
                className="text-slate-400 hover:text-red-500 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {paymentMethods.length === 0 && !showingPaymentMethod && (
            <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-300 rounded-xl">
              <Wallet size={20} className="mx-auto mb-1.5 opacity-40" />
              No payment methods added
            </div>
          )}

          {showingPaymentMethod && (
            <div className="p-4 rounded-xl border border-accent-200 bg-accent-50 flex flex-col gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name *</label>
                <input
                  type="text"
                  value={pmName}
                  onChange={(e) => setPmName(e.target.value)}
                  placeholder="e.g., Venmo, Cash"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PAYMENT_METHOD_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPmName(p)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        pmName === p
                          ? 'bg-accent-600 text-white border-accent-600'
                          : 'border-slate-300 text-slate-600 hover:border-accent-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">Color:</p>
                <ColorPicker value={pmColor} onChange={setPmColor} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddPaymentMethod}
                  disabled={!pmName.trim()}
                  className="flex-1 bg-accent-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowingPaymentMethod(false); setPmName(''); setPmColor('#6b7280') }}
                  className="px-4 text-slate-500 hover:text-slate-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
