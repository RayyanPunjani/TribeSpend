import { useState } from 'react'
import { Check, X, UserPlus } from 'lucide-react'
import { usePersonStore } from '@/stores/personStore'
import { useAuth } from '@/contexts/AuthContext'
import ColorPicker from '@/components/shared/ColorPicker'
import {
  PRESETS_BY_BRAND,
  BRANDS_BY_GROUP,
  type PresetCardTemplate,
} from '@/data/presetCards'

export const CUSTOM = 'Custom / Not Listed'

export interface CardFormData {
  name: string
  brand: string
  cardName: string
  issuer: string
  cardType: string
  lastFour: string
  owner: string
  color: string
  annualFee: string
  isAuthorizedUser: boolean
  isCustomName: boolean
}

export const emptyForm: CardFormData = {
  name: '', brand: '', cardName: '',
  issuer: '', cardType: '',
  lastFour: '', owner: '',
  color: '#3b82f6', annualFee: '',
  isAuthorizedUser: false,
  isCustomName: false,
}

export interface CascadeFormProps {
  form: CardFormData
  setForm: React.Dispatch<React.SetStateAction<CardFormData>>
  template: PresetCardTemplate | null
  setTemplate: (t: PresetCardTemplate | null) => void
  existingRuleCount?: number
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
  disableSubmit?: boolean
  persons: { id: string; name: string }[]
  autoFocusFirstField?: boolean
}

export function CascadeForm({
  form, setForm, template, setTemplate,
  existingRuleCount, submitLabel, onSubmit, onCancel, disableSubmit, persons, autoFocusFirstField,
}: CascadeFormProps) {
  const { add: addPerson } = usePersonStore()
  const { householdId } = useAuth()
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonColor, setNewPersonColor] = useState('#3b82f6')

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return
    const p = await addPerson(householdId!, newPersonName.trim(), newPersonColor)
    setForm((prev) => ({ ...prev, owner: p.id }))
    setNewPersonName('')
    setNewPersonColor('#3b82f6')
    setShowAddPerson(false)
  }

  const sf = (k: keyof CardFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, name: e.target.value, isCustomName: true }))

  const handleBrandChange = (brand: string) => {
    setForm((prev) => ({ ...prev, brand, cardName: '', issuer: '', cardType: '', annualFee: '' }))
    setTemplate(null)
  }

  const handleCardNameChange = (cardName: string) => {
    if (!cardName || cardName === CUSTOM) {
      setForm((prev) => ({ ...prev, cardName }))
      setTemplate(null)
      return
    }
    const t = (PRESETS_BY_BRAND[form.brand] ?? []).find((p) => p.cardName === cardName) ?? null
    if (t) {
      setTemplate(t)
      setForm((prev) => ({
        ...prev,
        cardName,
        issuer: t.issuer,
        cardType: t.cardType,
        annualFee: prev.isAuthorizedUser ? '0' : String(t.annualFee),
      }))
    } else {
      setForm((prev) => ({ ...prev, cardName }))
      setTemplate(null)
    }
  }

  const handleAUChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setForm((prev) => ({
      ...prev,
      isAuthorizedUser: checked,
      annualFee: checked ? '0' : prev.annualFee,
    }))
  }

  const showManualIssuer = form.brand === CUSTOM || form.cardName === CUSTOM
  const cardsForBrand = form.brand && form.brand !== CUSTOM ? (PRESETS_BY_BRAND[form.brand] ?? []) : []

  const inputCls = 'w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-500'
  const labelCls = 'block text-xs text-slate-500 mb-1'

  return (
    <div className="flex flex-col gap-3">
      {/* Step 1: Brand */}
      <div>
        <label className={labelCls}>Brand / Issuer</label>
        <select
          value={form.brand}
          onChange={(e) => handleBrandChange(e.target.value)}
          className={inputCls}
          autoFocus={autoFocusFirstField}
        >
          <option value="">— Select brand —</option>
          {BRANDS_BY_GROUP.banks.length > 0 && (
            <optgroup label="Banks">
              {BRANDS_BY_GROUP.banks.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          )}
          {BRANDS_BY_GROUP.airlines.length > 0 && (
            <optgroup label="Airlines">
              {BRANDS_BY_GROUP.airlines.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          )}
          {BRANDS_BY_GROUP.hotels.length > 0 && (
            <optgroup label="Hotels">
              {BRANDS_BY_GROUP.hotels.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          )}
          {BRANDS_BY_GROUP.fintech.length > 0 && (
            <optgroup label="Fintech">
              {BRANDS_BY_GROUP.fintech.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          )}
          <option value={CUSTOM}>{CUSTOM}</option>
        </select>
      </div>

      {/* Step 2: Card (only when a brand is selected) */}
      {form.brand && form.brand !== CUSTOM && (
        <div>
          <label className={labelCls}>Card</label>
          <select value={form.cardName} onChange={(e) => handleCardNameChange(e.target.value)} className={inputCls}>
            <option value="">— Select card —</option>
            {cardsForBrand.map((t) => (
              <option key={t.cardName} value={t.cardName}>
                {t.cardName}{t.annualFee > 0 ? ` ($${t.annualFee}/yr)` : ' (no annual fee)'}
              </option>
            ))}
            <option value={CUSTOM}>{CUSTOM}</option>
          </select>
        </div>
      )}

      {/* Reward summary chip */}
      {template && (
        <p className="text-xs text-accent-600 bg-accent-50 rounded-lg px-3 py-2">
          <span className="font-medium">{template.rewards.length} reward rule{template.rewards.length !== 1 ? 's' : ''}</span>
          {template.credits?.length
            ? ` + ${template.credits.length} credit${template.credits.length !== 1 ? 's' : ''}`
            : ''}
          {' '}will be {existingRuleCount !== undefined && existingRuleCount > 0 ? 'added' : 'applied'} on save.
          {existingRuleCount !== undefined && existingRuleCount > 0 && (
            <> Existing {existingRuleCount} rule{existingRuleCount !== 1 ? 's' : ''} are kept (manage in Card Rewards tab).</>
          )}
        </p>
      )}

      {/* Manual issuer + card type fields (CUSTOM path) */}
      {showManualIssuer && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Issuer (Bank)</label>
            <input type="text" value={form.issuer} onChange={sf('issuer')} placeholder="e.g., Chase" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Card Type</label>
            <input type="text" value={form.cardType} onChange={sf('cardType')} placeholder="e.g., Freedom Flex" className={inputCls} />
          </div>
        </div>
      )}

      <div className="border-t border-accent-100" />

      {/* Card details grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Last 4 Digits *</label>
          <input type="text" value={form.lastFour} onChange={sf('lastFour')} maxLength={4} placeholder="1234" className={inputCls} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls.replace('mb-1', '')}>Owner *</label>
            <button
              type="button"
              onClick={() => setShowAddPerson((v) => !v)}
              className="flex items-center gap-0.5 text-[11px] text-accent-600 hover:text-accent-700"
            >
              <UserPlus size={11} /> Add Person
            </button>
          </div>
          <select value={form.owner} onChange={sf('owner')} className={inputCls}>
            <option value="">Select person</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {showAddPerson && (
            <div className="mt-1.5 p-2 border border-slate-200 rounded-lg bg-white flex flex-col gap-2">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                placeholder="Name (e.g., Alex)"
                autoFocus
                className={inputCls}
              />
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Color:</p>
                <ColorPicker value={newPersonColor} onChange={setNewPersonColor} />
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleAddPerson} className="flex-1 text-xs bg-accent-600 text-white rounded-lg py-1.5 hover:bg-accent-700">
                  Create
                </button>
                <button onClick={() => setShowAddPerson(false)} className="text-xs text-slate-400 px-2 hover:text-slate-600">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Authorized user checkbox — full row */}
        <div className="col-span-2">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isAuthorizedUser}
              onChange={handleAUChange}
              className="mt-0.5 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
            />
            <span className="text-xs text-slate-600">
              Authorized user card{' '}
              <span className="text-slate-400">(no separate annual fee or credits — skipped in Optimize)</span>
            </span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Nickname (optional)</label>
          <input type="text" value={form.name} onChange={handleNameChange} placeholder="e.g., Rayyan's Venture X" className={inputCls} />
        </div>
        <div>
          <label className={`${labelCls} ${form.isAuthorizedUser ? 'opacity-40' : ''}`}>Annual Fee ($)</label>
          <input
            type="number"
            value={form.annualFee}
            onChange={sf('annualFee')}
            placeholder="0"
            min="0"
            disabled={form.isAuthorizedUser}
            className={`${inputCls} ${form.isAuthorizedUser ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
          />
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">Card color:</p>
        <ColorPicker value={form.color} onChange={(c) => setForm((p) => ({ ...p, color: c }))} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onSubmit}
          disabled={disableSubmit}
          className="flex items-center gap-1.5 flex-1 justify-center bg-accent-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
        >
          <Check size={14} /> {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 text-slate-500 hover:text-slate-700 text-sm"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}
