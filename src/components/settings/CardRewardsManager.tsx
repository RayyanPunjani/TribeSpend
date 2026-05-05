import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { useCardStore } from '@/stores/cardStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/utils/formatters'
import { useCategoryStore } from '@/stores/categoryStore'
import type { CardRewardRule, CardCredit } from '@/types'

type RewardForm = {
  category: string
  merchantKeywords: string
  rewardType: 'cashback' | 'points'
  rewardRate: string
  isRotating: boolean
  activeStartDate: string
  activeEndDate: string
  notes: string
}

type CreditForm = {
  name: string
  amount: string
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
  creditType: 'statement' | 'portal' | 'in-app'
  category: string
  merchantMatch: string
  notes: string
}

const EMPTY_REWARD_FORM: RewardForm = {
  category: 'base',
  merchantKeywords: '',
  rewardType: 'cashback',
  rewardRate: '',
  isRotating: false,
  activeStartDate: '',
  activeEndDate: '',
  notes: '',
}

const EMPTY_CREDIT_FORM: CreditForm = {
  name: '',
  amount: '',
  frequency: 'monthly',
  creditType: 'statement',
  category: '',
  merchantMatch: '',
  notes: '',
}

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'semi-annual': 'Semi-Annual',
  annual: 'Annual',
}

function formatMerchantKeywords(keywords: string[]): string {
  const labels = keywords.map((keyword) => {
    const normalized = keyword.toUpperCase()
    if (['AMAZON', 'AMAZON.COM', 'AMZN'].includes(normalized)) return 'Amazon'
    if (['WHOLE FOODS', 'WHOLEFOODS', 'WHOLEFDS'].includes(normalized)) return 'Whole Foods'
    return keyword
      .toLowerCase()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  })
  return Array.from(new Set(labels)).join(' / ')
}

export default function CardRewardsManager() {
  const { cards, update: updateCard } = useCardStore()
  const { rules, add: addRule, update: updateRule, remove: removeRule } = useCardRewardStore()
  const { credits, add: addCredit, update: updateCredit, remove: removeCredit } = useCardCreditStore()
  const { householdId } = useAuth()

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [addingRuleFor, setAddingRuleFor] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [rewardForm, setRewardForm] = useState<RewardForm>(EMPTY_REWARD_FORM)
  const [addingCreditFor, setAddingCreditFor] = useState<string | null>(null)
  const [editingCredit, setEditingCredit] = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState<CreditForm>(EMPTY_CREDIT_FORM)
  const [annualFeeEdit, setAnnualFeeEdit] = useState<Record<string, string>>({})

  const creditCards = cards.filter((c) => !c.isPaymentMethod)

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  const cardRules = (cardId: string) => rules.filter((r) => r.cardId === cardId)
  const cardCredits = (cardId: string) => credits.filter((c) => c.cardId === cardId)

  const startAddRule = (cardId: string) => {
    setAddingRuleFor(cardId)
    setEditingRule(null)
    setRewardForm(EMPTY_REWARD_FORM)
  }

  const startEditRule = (rule: CardRewardRule) => {
    setEditingRule(rule.id)
    setAddingRuleFor(null)
    setRewardForm({
      category: rule.category,
      merchantKeywords: rule.merchantKeywords?.join(', ') ?? '',
      rewardType: rule.rewardType,
      rewardRate: String(rule.rewardRate),
      isRotating: rule.isRotating ?? false,
      activeStartDate: rule.activeStartDate ?? '',
      activeEndDate: rule.activeEndDate ?? '',
      notes: rule.notes ?? '',
    })
  }

  const cancelRuleForm = () => {
    setAddingRuleFor(null)
    setEditingRule(null)
    setRewardForm(EMPTY_REWARD_FORM)
  }

  const saveRule = async (cardId: string) => {
    const rate = parseFloat(rewardForm.rewardRate)
    if (isNaN(rate) || rate <= 0) return
    const data: Omit<CardRewardRule, 'id'> = {
      cardId,
      category: rewardForm.category,
      merchantKeywords: rewardForm.merchantKeywords
        .split(',')
        .map((keyword) => keyword.trim().toUpperCase())
        .filter(Boolean),
      rewardType: rewardForm.rewardType,
      rewardRate: rate,
      isRotating: rewardForm.isRotating,
      activeStartDate: rewardForm.activeStartDate || undefined,
      activeEndDate: rewardForm.activeEndDate || undefined,
      notes: rewardForm.notes || undefined,
    }
    if (editingRule) await updateRule(editingRule, data)
    else await addRule(householdId!, data)
    cancelRuleForm()
  }

  const startAddCredit = (cardId: string) => {
    setAddingCreditFor(cardId)
    setEditingCredit(null)
    setCreditForm(EMPTY_CREDIT_FORM)
  }

  const startEditCredit = (credit: CardCredit) => {
    setEditingCredit(credit.id)
    setAddingCreditFor(null)
    setCreditForm({
      name: credit.name,
      amount: String(credit.amount),
      frequency: credit.frequency,
      creditType: credit.creditType,
      category: credit.category ?? '',
      merchantMatch: credit.merchantMatch ?? '',
      notes: credit.notes ?? '',
    })
  }

  const cancelCreditForm = () => {
    setAddingCreditFor(null)
    setEditingCredit(null)
    setCreditForm(EMPTY_CREDIT_FORM)
  }

  const saveCredit = async (cardId: string) => {
    const amt = parseFloat(creditForm.amount)
    if (isNaN(amt) || amt <= 0 || !creditForm.name.trim()) return
    const data: Omit<CardCredit, 'id'> = {
      cardId,
      name: creditForm.name.trim(),
      amount: amt,
      frequency: creditForm.frequency,
      creditType: creditForm.creditType,
      category: creditForm.category || undefined,
      merchantMatch: creditForm.creditType === 'statement' ? (creditForm.merchantMatch.trim().toUpperCase() || undefined) : undefined,
      notes: creditForm.notes || undefined,
    }
    if (editingCredit) await updateCredit(editingCredit, data)
    else await addCredit(householdId!, data)
    cancelCreditForm()
  }

  const saveAnnualFee = async (cardId: string) => {
    const val = annualFeeEdit[cardId]
    if (val === undefined) return
    const fee = parseFloat(val)
    await updateCard(cardId, { annualFee: isNaN(fee) ? undefined : fee })
    setAnnualFeeEdit((prev) => { const next = { ...prev }; delete next[cardId]; return next })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Card Rewards & Credits</h3>
        <p className="text-xs text-slate-500">
          Configure reward rates and credits per card to unlock spending optimization insights.
        </p>
      </div>

      {creditCards.length === 0 && (
        <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500">
          No credit cards configured. Add cards in Wallet first.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {creditCards.map((card) => {
          const isExpanded = expandedCards.has(card.id)
          const ruleCount = cardRules(card.id).length
          const creditCount = cardCredits(card.id).length

          return (
            <div key={card.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCard(card.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
                  <span className="font-medium text-slate-800 text-sm">{card.name}</span>
                  <span className="text-xs text-slate-400">···{card.lastFour}</span>
                  <span className="text-xs text-slate-400">
                    {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
                    {creditCount > 0 && `, ${creditCount} credit${creditCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 px-4 py-4 flex flex-col gap-5">
                  {/* Annual Fee */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Annual Fee</p>
                    <div className="flex items-center gap-2">
                      {annualFeeEdit[card.id] !== undefined ? (
                        <>
                          <span className="text-sm text-slate-600">$</span>
                          <input
                            type="number"
                            value={annualFeeEdit[card.id]}
                            onChange={(e) => setAnnualFeeEdit((prev) => ({ ...prev, [card.id]: e.target.value }))}
                            placeholder="0"
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-accent-500"
                          />
                          <button onClick={() => saveAnnualFee(card.id)} className="text-accent-600 hover:text-accent-700"><Check size={14} /></button>
                          <button onClick={() => setAnnualFeeEdit((prev) => { const n = { ...prev }; delete n[card.id]; return n })} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-slate-700">{card.annualFee != null ? formatCurrency(card.annualFee) : 'Not set'}</span>
                          <button onClick={() => setAnnualFeeEdit((prev) => ({ ...prev, [card.id]: String(card.annualFee ?? '') }))} className="text-slate-400 hover:text-slate-600"><Edit2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reward Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-500">Reward Rules</p>
                      <button onClick={() => startAddRule(card.id)} className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700">
                        <Plus size={12} /> Add Rule
                      </button>
                    </div>
                    {cardRules(card.id).length === 0 && addingRuleFor !== card.id && (
                      <p className="text-xs text-slate-400 italic">No rules yet. Add a base rate to get started.</p>
                    )}
                    <div className="flex flex-col gap-2">
                      {cardRules(card.id).map((rule) => (
                        <div key={rule.id}>
                          {editingRule === rule.id ? (
                            <RuleForm form={rewardForm} onChange={setRewardForm} onSave={() => saveRule(card.id)} onCancel={cancelRuleForm} />
                          ) : (
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                              <div>
                                <span className="text-xs font-medium text-slate-700">{rule.category === 'base' ? 'Base Rate' : rule.category}</span>
                                <span className="text-xs text-slate-500 ml-2">
                                  {rule.rewardType === 'cashback'
                                    ? `${(rule.rewardRate * 100).toFixed(1)}% cash back`
                                    : `${rule.rewardRate}x points`}
                                </span>
                                {rule.isRotating && <span className="text-xs text-blue-500 ml-2">Rotating</span>}
                                {rule.merchantKeywords && rule.merchantKeywords.length > 0 && (
                                  <span className="text-xs text-amber-600 ml-2">
                                    {formatMerchantKeywords(rule.merchantKeywords)} only
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => startEditRule(rule)} className="text-slate-400 hover:text-slate-600"><Edit2 size={12} /></button>
                                <button onClick={() => removeRule(rule.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {addingRuleFor === card.id && (
                        <RuleForm form={rewardForm} onChange={setRewardForm} onSave={() => saveRule(card.id)} onCancel={cancelRuleForm} />
                      )}
                    </div>
                  </div>

                  {/* Credits */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-500">Credits</p>
                      <button onClick={() => startAddCredit(card.id)} className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700">
                        <Plus size={12} /> Add Credit
                      </button>
                    </div>
                    {cardCredits(card.id).length === 0 && addingCreditFor !== card.id && (
                      <p className="text-xs text-slate-400 italic">No credits yet.</p>
                    )}
                    <div className="flex flex-col gap-2">
                      {cardCredits(card.id).map((credit) => (
                        <div key={credit.id}>
                          {editingCredit === credit.id ? (
                            <CreditFormComp form={creditForm} onChange={setCreditForm} onSave={() => saveCredit(card.id)} onCancel={cancelCreditForm} />
                          ) : (
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-700">{credit.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    credit.creditType === 'portal' ? 'bg-blue-100 text-blue-600'
                                    : credit.creditType === 'in-app' ? 'bg-purple-100 text-purple-600'
                                    : 'bg-green-100 text-green-600'
                                  }`}>
                                    {credit.creditType}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500">
                                  {formatCurrency(credit.amount)} · {FREQ_LABELS[credit.frequency]}
                                  {credit.category && ` · ${credit.category}`}
                                  {credit.merchantMatch && ` · matches "${credit.merchantMatch}"`}
                                </span>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => startEditCredit(credit)} className="text-slate-400 hover:text-slate-600"><Edit2 size={12} /></button>
                                <button onClick={() => removeCredit(credit.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {addingCreditFor === card.id && (
                        <CreditFormComp form={creditForm} onChange={setCreditForm} onSave={() => saveCredit(card.id)} onCancel={cancelCreditForm} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RuleForm({ form, onChange, onSave, onCancel }: {
  form: RewardForm; onChange: (f: RewardForm) => void; onSave: () => void; onCancel: () => void
}) {
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const rewardCategories = categoryNames.filter(
    (category) => !['Needs Review', 'Refunds & Credits'].includes(category),
  ).slice().sort((a, b) => a.localeCompare(b))
  const categoryOptions = [
    { value: 'base', label: 'Everything Else (Base Rate)' },
    ...rewardCategories.map((category) => ({ value: category, label: category })),
  ]
  const options = form.category && !categoryOptions.some((option) => option.value === form.category)
    ? [{ value: form.category, label: form.category }, ...categoryOptions]
    : categoryOptions

  return (
    <div className="border border-accent-200 bg-accent-50 rounded-xl p-3 flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Category</label>
          <select value={form.category} onChange={(e) => onChange({ ...form, category: e.target.value })}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-accent-500">
            {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Reward Type</label>
          <div className="flex gap-2 items-center pt-1">
            {(['cashback', 'points'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={form.rewardType === t} onChange={() => onChange({ ...form, rewardType: t })} />
                {t === 'cashback' ? 'Cash Back' : 'Points'}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">
            {form.rewardType === 'cashback' ? 'Rate (e.g. 0.03 for 3%)' : 'Multiplier (e.g. 3 for 3x)'}
          </label>
          <input type="number" step="0.01" value={form.rewardRate}
            onChange={(e) => onChange({ ...form, rewardRate: e.target.value })}
            placeholder={form.rewardType === 'cashback' ? '0.03' : '3'}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Merchant Keywords (optional)</label>
          <input type="text" value={form.merchantKeywords}
            onChange={(e) => onChange({ ...form, merchantKeywords: e.target.value.toUpperCase() })}
            placeholder="AMAZON, WHOLE FOODS"
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
          <p className="text-[10px] text-slate-400">Leave blank for category-wide rewards</p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={form.isRotating} onChange={(e) => onChange({ ...form, isRotating: e.target.checked })} className="rounded border-slate-300 text-accent-600" />
        Rotating category (seasonal / quarterly)
      </label>
      {form.isRotating && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Active From</label>
            <input type="date" value={form.activeStartDate} onChange={(e) => onChange({ ...form, activeStartDate: e.target.value })}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Active Until</label>
            <input type="date" value={form.activeEndDate} onChange={(e) => onChange({ ...form, activeEndDate: e.target.value })}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Notes (optional)</label>
        <input type="text" value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })}
          placeholder="e.g. 'Q1 2025 rotating category'"
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg">Cancel</button>
        <button onClick={onSave} className="px-3 py-1.5 text-xs bg-accent-600 text-white rounded-lg hover:bg-accent-700">Save Rule</button>
      </div>
    </div>
  )
}

function CreditFormComp({ form, onChange, onSave, onCancel }: {
  form: CreditForm; onChange: (f: CreditForm) => void; onSave: () => void; onCancel: () => void
}) {
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const categoryOptions = form.category && !categoryNames.includes(form.category)
    ? [form.category, ...categoryNames]
    : categoryNames
  const sortedCategoryOptions = [...categoryOptions].sort((a, b) => a.localeCompare(b))

  return (
    <div className="border border-green-200 bg-green-50 rounded-xl p-3 flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Credit Name</label>
          <input type="text" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Uber Credit"
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Amount ($)</label>
          <input type="number" step="0.01" value={form.amount} onChange={(e) => onChange({ ...form, amount: e.target.value })}
            placeholder="e.g. 15 (monthly) or 300 (annual)"
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Frequency</label>
          <select value={form.frequency} onChange={(e) => onChange({ ...form, frequency: e.target.value as CreditForm['frequency'] })}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-accent-500">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi-annual">Semi-Annual</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Type</label>
          <div className="flex gap-3 items-center pt-1 flex-wrap">
            {(['statement', 'portal', 'in-app'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={form.creditType === t} onChange={() => onChange({ ...form, creditType: t })} />
                {t === 'statement' ? 'Statement' : t === 'portal' ? 'Portal' : 'In-App'}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {form.creditType === 'statement' ? 'Auto-applied to matching purchases on your card statement'
            : form.creditType === 'portal' ? 'Must book/spend through the issuer\'s own portal'
            : 'Loaded into a third-party app (e.g. Uber Cash) — not visible on card statement'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Category (optional)</label>
          <select value={form.category} onChange={(e) => onChange({ ...form, category: e.target.value })}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-accent-500">
            <option value="">Any category</option>
            {sortedCategoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        {form.creditType === 'statement' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Merchant Match (optional)</label>
            <input type="text" value={form.merchantMatch} onChange={(e) => onChange({ ...form, merchantMatch: e.target.value.toUpperCase() })}
              placeholder="e.g. DUNKIN"
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
            <p className="text-[10px] text-slate-400">Uppercase keyword matched in transaction descriptions</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Notes (optional)</label>
        <input type="text" value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })}
          placeholder="e.g. 'Must book through Capital One Travel portal'"
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg">Cancel</button>
        <button onClick={onSave} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Save Credit</button>
      </div>
    </div>
  )
}
