import { useState } from 'react'
import { User, Plus, Check, X } from 'lucide-react'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import { useAuth } from '@/contexts/AuthContext'
import ColorPicker from '@/components/shared/ColorPicker'
import { CascadeForm, emptyForm, type CardFormData } from '@/components/shared/CascadeCardForm'
import { buildRulesFromPreset, type PresetCardTemplate } from '@/data/presetCards'
import { nextColor } from '@/utils/colors'
import type { ParsedCardholder } from '@/types'

export interface CardholderAssignment {
  cardholderName: string
  lastFour: string
  cardId: string   // '' = create new or skip
  personId: string
}

interface InlinePersonForm {
  name: string
  color: string
}

interface Props {
  cardholders: ParsedCardholder[]
  onAssign: (assignments: CardholderAssignment[]) => void
  onBack: () => void
}

export default function CardAssignment({ cardholders, onAssign, onBack }: Props) {
  const { cards, add: addCard } = useCardStore()
  const { persons, add: addPerson, addCardToPerson } = usePersonStore()
  const { add: addRule } = useCardRewardStore()
  const { add: addCredit } = useCardCreditStore()
  const { householdId } = useAuth()
  const hid = householdId!

  const [assignments, setAssignments] = useState<CardholderAssignment[]>(
    cardholders.map((ch) => {
      const matched = cards.find((c) => c.lastFour === ch.last_four)
      return {
        cardholderName: ch.name,
        lastFour: ch.last_four,
        cardId: matched?.id ?? '',
        personId: matched?.owner ?? (persons[0]?.id ?? ''),
      }
    }),
  )

  const [addingPersonForRow, setAddingPersonForRow] = useState<number | null>(null)
  const [addingCardForRow, setAddingCardForRow] = useState<number | null>(null)

  const [personForm, setPersonForm] = useState<InlinePersonForm>({ name: '', color: '#3b82f6' })
  const [cardForm, setCardForm] = useState<CardFormData>({ ...emptyForm })
  const [cardTemplate, setCardTemplate] = useState<PresetCardTemplate | null>(null)

  const setAssignment = (idx: number, patch: Partial<CardholderAssignment>) => {
    setAssignments((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const openAddPerson = (rowIdx: number) => {
    const usedColors = persons.map((p) => p.color)
    setPersonForm({ name: '', color: nextColor(usedColors) })
    setAddingPersonForRow(rowIdx)
    setAddingCardForRow(null)
  }

  const openAddCard = (rowIdx: number) => {
    const ch = cardholders[rowIdx]
    const personId = assignments[rowIdx]?.personId ?? ''
    const usedColors = cards.map((c) => c.color)
    setCardForm({
      ...emptyForm,
      lastFour: ch.last_four ?? '',
      owner: personId,
      color: nextColor(usedColors),
    })
    setCardTemplate(null)
    setAddingCardForRow(rowIdx)
    setAddingPersonForRow(null)
  }

  const handleSavePerson = async (rowIdx: number) => {
    if (!personForm.name.trim()) return
    const newPerson = await addPerson(hid, personForm.name.trim(), personForm.color)
    setAssignment(rowIdx, { personId: newPerson.id, cardId: '' })
    setAddingPersonForRow(null)
  }

  const handleSaveCard = async (rowIdx: number) => {
    if (!cardForm.lastFour || !cardForm.owner) return
    const issuer = (cardTemplate?.issuer ?? cardForm.issuer) || 'Other'
    const cardType = (cardTemplate?.cardType ?? cardForm.cardType) || 'Other'
    const personName = persons.find((p) => p.id === cardForm.owner)?.name ?? ''
    const autoName = cardForm.name || `${personName}'s ${cardType}`
    const newCard = await addCard(hid, {
      name: autoName,
      issuer,
      cardType,
      lastFour: cardForm.lastFour.slice(-4),
      owner: cardForm.owner,
      color: cardForm.color,
      annualFee: cardForm.isAuthorizedUser ? undefined : (cardForm.annualFee ? parseFloat(cardForm.annualFee) : undefined),
      isAuthorizedUser: cardForm.isAuthorizedUser,
    })
    await addCardToPerson(cardForm.owner, newCard.id)
    if (cardTemplate) {
      const { rules, credits } = buildRulesFromPreset(cardTemplate, newCard.id)
      await Promise.all(rules.map((r) => addRule(hid, r)))
      await Promise.all(credits.map((c) => addCredit(hid, c)))
    }
    setAssignment(rowIdx, { cardId: newCard.id, personId: cardForm.owner })
    setAddingCardForRow(null)
  }

  const handleConfirm = async () => {
    const finalAssignments = [...assignments]
    for (let i = 0; i < finalAssignments.length; i++) {
      const a = finalAssignments[i]
      if (!a.cardId && a.personId) {
        // Auto-create card for unmatched cardholder
        const person = persons.find((p) => p.id === a.personId)
        const newCard = await addCard(hid, {
          name: `${person?.name ?? a.cardholderName}'s Card`,
          issuer: 'Unknown',
          cardType: 'Unknown',
          lastFour: a.lastFour || '0000',
          owner: a.personId,
          color: person?.color ?? '#64748b',
          isAuthorizedUser: false,
        })
        await addCardToPerson(a.personId, newCard.id)
        finalAssignments[i] = { ...a, cardId: newCard.id }
      }
    }
    onAssign(finalAssignments)
  }

  const allAssigned = assignments.every((a) => a.personId)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-800">Assign Cardholders</h3>
        <p className="text-sm text-slate-500 mt-1">
          Match each cardholder from the statement to a person and card in your account.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {cardholders.map((ch, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
            {/* Cardholder header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User size={15} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{ch.name}</p>
                <p className="text-xs text-slate-400">
                  ···{ch.last_four} · {ch.transactions.length} transactions
                </p>
              </div>
            </div>

            {/* Person row */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Person</label>
              <div className="flex gap-2 items-center">
                <select
                  value={assignments[i]?.personId ?? ''}
                  onChange={(e) => setAssignment(i, { personId: e.target.value, cardId: '' })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="">Select person</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {addingPersonForRow !== i && (
                  <button
                    onClick={() => openAddPerson(i)}
                    className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-medium whitespace-nowrap px-2 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors"
                  >
                    <Plus size={12} /> New
                  </button>
                )}
              </div>

              {/* Inline new-person form */}
              {addingPersonForRow === i && (
                <div className="mt-2 p-3 rounded-xl border border-accent-200 bg-accent-50 flex flex-col gap-2">
                  <p className="text-xs font-medium text-slate-600">New Person</p>
                  <input
                    type="text"
                    value={personForm.name}
                    onChange={(e) => setPersonForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePerson(i)}
                    placeholder="Name (e.g., Rayyan)"
                    autoFocus
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Color:</p>
                    <ColorPicker value={personForm.color} onChange={(c) => setPersonForm((f) => ({ ...f, color: c }))} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSavePerson(i)}
                      disabled={!personForm.name.trim()}
                      className="flex items-center gap-1.5 flex-1 justify-center bg-accent-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
                    >
                      <Check size={12} /> Add Person
                    </button>
                    <button
                      onClick={() => setAddingPersonForRow(null)}
                      className="flex items-center gap-1 px-3 text-slate-500 hover:text-slate-700 text-xs"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card row */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Card</label>
              <div className="flex gap-2 items-center">
                <select
                  value={assignments[i]?.cardId ?? ''}
                  onChange={(e) => setAssignment(i, { cardId: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="">Auto-create new card</option>
                  {cards
                    .filter((c) => !c.isPaymentMethod && (!assignments[i]?.personId || c.owner === assignments[i].personId))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (···{c.lastFour})
                      </option>
                    ))}
                </select>
                {addingCardForRow !== i && (
                  <button
                    onClick={() => openAddCard(i)}
                    className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-medium whitespace-nowrap px-2 py-1.5 border border-accent-200 rounded-lg hover:bg-accent-50 transition-colors"
                  >
                    <Plus size={12} /> New
                  </button>
                )}
              </div>

              {/* Inline new-card form using preset cascade picker */}
              {addingCardForRow === i && (
                <div className="mt-2 p-3 rounded-xl border border-accent-200 bg-accent-50">
                  <p className="text-xs font-medium text-slate-600 mb-2">New Card</p>
                  <CascadeForm
                    form={cardForm}
                    setForm={setCardForm}
                    template={cardTemplate}
                    setTemplate={setCardTemplate}
                    submitLabel="Add Card"
                    onSubmit={() => handleSaveCard(i)}
                    onCancel={() => setAddingCardForRow(null)}
                    disableSubmit={!cardForm.lastFour || !cardForm.owner}
                    persons={persons}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!allAssigned}
          className="flex-1 px-5 py-2.5 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}
