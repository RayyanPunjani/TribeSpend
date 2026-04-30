import { useState } from 'react'
import {
  Target, Plus, Pencil, Trash2, AlertTriangle, Check, X, ChevronDown, Mail, Loader2,
} from 'lucide-react'
import { BUDGET_LIMIT_ERROR, MAX_BUDGETS_PER_HOUSEHOLD, useBudgetStore } from '@/stores/budgetStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useAuth } from '@/contexts/AuthContext'
import { useBudgetStatus, type BudgetStatus } from '@/hooks/useBudgetStatus'
import { formatCurrency } from '@/utils/formatters'

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  annual: 'This Year',
}

const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

const DEFAULT_THRESHOLD_CHIPS = [50, 80, 100]
const BUDGET_ALERTS_URL = 'https://okqniovbcybhtfjexnay.functions.supabase.co/budget-alerts'

type TestEmailStatus = 'sending' | 'success' | 'error'

interface TestEmailState {
  status: TestEmailStatus
  message: string
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

async function sendBudgetTestEmail(budgetId: string): Promise<void> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!anonKey) throw new Error('Missing Supabase anon key')

  const response = await fetch(BUDGET_ALERTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ test: true, budgetId }),
  })

  let payload: { sent?: number; error?: string; details?: string } | null = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.details || 'Failed to send test email')
  }

  if (!payload?.sent) {
    throw new Error('No test email was sent')
  }
}

interface BudgetForm {
  label: string
  personId: string           // '' = household
  category: string           // '' = all spending
  amount: string
  period: 'weekly' | 'monthly' | 'annual'
  notifyEmail: string        // '' = no notifications
  notifyThresholds: number[]
}

const emptyForm: BudgetForm = {
  label: '', personId: '', category: '', amount: '', period: 'monthly',
  notifyEmail: '', notifyThresholds: [80, 100],
}

// ── Progress bar with threshold tick marks ────────────────────────────────────

function ProgressBar({
  percent,
  status,
  thresholds = [],
}: {
  percent: number
  status: BudgetStatus['status']
  thresholds?: number[]
}) {
  const fill =
    status === 'over' ? 'bg-red-500' :
    status === 'warning' ? 'bg-amber-400' :
    'bg-accent-500'

  // Only show ticks within 0–100% range (200%+ thresholds are valid but can't be shown)
  const visibleTicks = thresholds.filter((t) => t > 0 && t <= 100)

  return (
    <div className="relative h-2 bg-slate-100 rounded-full">
      <div
        className={`h-full rounded-full transition-all duration-500 ${fill}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
      {visibleTicks.map((t) => (
        <div
          key={t}
          className="absolute top-0 bottom-0 w-px bg-slate-400/60 pointer-events-none"
          style={{ left: `${t}%` }}
        />
      ))}
    </div>
  )
}

// ── Form panel ────────────────────────────────────────────────────────────────

interface BudgetFormPanelProps {
  form: BudgetForm
  setForm: React.Dispatch<React.SetStateAction<BudgetForm>>
  persons: { id: string; name: string }[]
  categoryNames: string[]
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
  disableSubmit?: boolean
}

function BudgetFormPanel({
  form, setForm, persons, categoryNames, submitLabel, onSubmit, onCancel, disableSubmit,
}: BudgetFormPanelProps) {
  const [emailError, setEmailError] = useState('')
  const [customPct, setCustomPct] = useState('')
  const categoryOptions = form.category && !categoryNames.includes(form.category)
    ? [form.category, ...categoryNames]
    : categoryNames

  const sf = (k: keyof Pick<BudgetForm, 'label' | 'personId' | 'category' | 'amount' | 'notifyEmail'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (k === 'notifyEmail') setEmailError('')
      setForm((f) => ({ ...f, [k]: e.target.value }))
    }

  const handleEmailBlur = () => {
    if (form.notifyEmail && !isValidEmail(form.notifyEmail)) {
      setEmailError('Enter a valid email address')
    } else {
      setEmailError('')
    }
  }

  const toggleThreshold = (pct: number) => {
    setForm((f) => ({
      ...f,
      notifyThresholds: f.notifyThresholds.includes(pct)
        ? f.notifyThresholds.filter((t) => t !== pct)
        : [...f.notifyThresholds, pct].sort((a, b) => a - b),
    }))
  }

  const addCustomThreshold = () => {
    const n = parseInt(customPct, 10)
    if (isNaN(n) || n < 1 || n > 200) return
    setForm((f) => ({
      ...f,
      notifyThresholds: f.notifyThresholds.includes(n)
        ? f.notifyThresholds
        : [...f.notifyThresholds, n].sort((a, b) => a - b),
    }))
    setCustomPct('')
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-500'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1'

  // Threshold chips: default set + any custom ones not in the default set
  const customThresholds = form.notifyThresholds.filter(
    (t) => !DEFAULT_THRESHOLD_CHIPS.includes(t),
  )
  const notifyDisabled = !form.notifyEmail.trim()

  return (
    <div className="flex flex-col gap-4">
      {/* Budget Name */}
      <div>
        <label className={labelCls}>Budget Name *</label>
        <input
          type="text"
          value={form.label}
          onChange={sf('label')}
          placeholder="e.g., Monthly Dining"
          className={inputCls}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Amount */}
        <div>
          <label className={labelCls}>Limit ($) *</label>
          <input
            type="number"
            value={form.amount}
            onChange={sf('amount')}
            placeholder="500"
            min="1"
            className={inputCls}
          />
        </div>

        {/* Period */}
        <div>
          <label className={labelCls}>Period</label>
          <div className="relative">
            <select
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as BudgetForm['period'] }))}
              className={`${inputCls} appearance-none pr-8`}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Who */}
        <div>
          <label className={labelCls}>Who</label>
          <div className="relative">
            <select value={form.personId} onChange={sf('personId')} className={`${inputCls} appearance-none pr-8`}>
              <option value="">Entire Household</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className={labelCls}>Category</label>
          <div className="relative">
            <select value={form.category} onChange={sf('category')} className={`${inputCls} appearance-none pr-8`}>
              <option value="">All Spending</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Notifications ─────────────────────────────────────────── */}
      <div className="border-t border-slate-100 pt-4">
        <label className={labelCls}>Notifications</label>

        {/* Email input */}
        <div className="mb-3">
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="email"
              value={form.notifyEmail}
              onChange={sf('notifyEmail')}
              onBlur={handleEmailBlur}
              placeholder="Email for alerts (optional)"
              className={`${inputCls} pl-8 ${emailError ? 'border-red-300 focus:ring-red-400' : ''}`}
            />
          </div>
          {emailError && (
            <p className="text-xs text-red-500 mt-1">{emailError}</p>
          )}
        </div>

        {/* Threshold chips — grayed out when no email */}
        <div className={`transition-opacity ${notifyDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <p className="text-xs text-slate-500 mb-2">Alert at these thresholds:</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Default chips */}
            {DEFAULT_THRESHOLD_CHIPS.map((pct) => {
              const active = form.notifyThresholds.includes(pct)
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => toggleThreshold(pct)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-accent-600 text-white border-accent-600'
                      : 'border-slate-200 text-slate-500 hover:border-accent-400 hover:text-accent-600'
                  }`}
                >
                  {pct}%
                </button>
              )
            })}

            {/* Custom threshold chips */}
            {customThresholds.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => toggleThreshold(pct)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-accent-600 text-white border-accent-600 hover:bg-red-500 hover:border-red-500 transition-colors"
                title="Click to remove"
              >
                {pct}% <X size={9} />
              </button>
            ))}

            {/* Custom % adder */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={customPct}
                onChange={(e) => setCustomPct(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomThreshold()}
                placeholder="Custom %"
                min="1"
                max="200"
                className="w-[78px] border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <button
                type="button"
                onClick={addCustomThreshold}
                disabled={!customPct}
                className="p-1 rounded-lg text-accent-600 hover:bg-accent-50 disabled:opacity-30 transition-colors"
                title="Add threshold"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-2.5">
            Emails are sent when spend reaches these thresholds.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
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

// ── Budget card ───────────────────────────────────────────────────────────────

interface BudgetCardProps {
  status: BudgetStatus
  personName: string
  testEmailState?: TestEmailState
  onEdit: () => void
  onDelete: () => void
  onSendTestEmail: () => void
}

function BudgetCard({
  status,
  personName,
  testEmailState,
  onEdit,
  onDelete,
  onSendTestEmail,
}: BudgetCardProps) {
  const { budget, spent, remaining, percentUsed } = status
  const isOver = status.status === 'over'
  const sendingTest = testEmailState?.status === 'sending'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-800 truncate">{budget.label}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {personName}
            {budget.category ? ` · ${budget.category}` : ' · All Spending'}
            {' · '}{PERIOD_LABELS[budget.period]}
          </p>
        </div>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {/* Mail icon with tooltip when notifications are configured */}
          {budget.notifyEmail && (
            <div className="relative group">
              <Mail
                size={13}
                className="text-slate-300 group-hover:text-accent-500 transition-colors cursor-default"
              />
              <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1 text-xs bg-slate-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                {budget.notifyEmail}
              </span>
            </div>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-accent-600 hover:bg-accent-50 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between text-sm mb-2">
        <span className={`font-semibold ${isOver ? 'text-red-600' : status.status === 'warning' ? 'text-amber-600' : 'text-slate-800'}`}>
          {formatCurrency(spent)}
        </span>
        <span className="text-slate-400 text-xs">
          of {formatCurrency(budget.amount)}
        </span>
      </div>

      <ProgressBar
        percent={percentUsed}
        status={status.status}
        thresholds={budget.notifyThresholds}
      />

      <p className="text-xs mt-1.5 text-slate-400">
        {remaining >= 0
          ? <>{formatCurrency(remaining)} remaining</>
          : <span className="text-red-500">{formatCurrency(-remaining)} over budget</span>
        }
        <span className="ml-1 text-slate-300">({percentUsed.toFixed(0)}%)</span>
      </p>

      {budget.notifyEmail && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSendTestEmail}
            disabled={sendingTest}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:border-accent-300 hover:text-accent-600 hover:bg-accent-50 disabled:opacity-60 transition-colors"
          >
            {sendingTest ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            {sendingTest ? 'Sending…' : 'Send Test Email'}
          </button>
          {testEmailState?.status === 'success' && (
            <span className="text-xs text-emerald-600">Test email sent</span>
          )}
          {testEmailState?.status === 'error' && (
            <span className="text-xs text-red-500">{testEmailState.message}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { householdId } = useAuth()
  const hid = householdId!
  const { budgets, add: addBudget, update: updateBudget, remove: removeBudget } = useBudgetStore()
  const { persons } = usePersonStore()
  const categoryNames = useCategoryStore((s) => s.categoryNames)
  const statuses = useBudgetStatus()

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<BudgetForm>({ ...emptyForm })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<BudgetForm>({ ...emptyForm })
  const [testEmailStates, setTestEmailStates] = useState<Record<string, TestEmailState>>({})
  const [addError, setAddError] = useState('')

  const alerts = statuses.filter((s) => s.status !== 'ok')
  const budgetLimitReached = budgets.length >= MAX_BUDGETS_PER_HOUSEHOLD

  const handleAdd = async () => {
    if (!addForm.label.trim() || !addForm.amount) return
    setAddError('')
    try {
      await addBudget(hid, {
        label: addForm.label.trim(),
        personId: addForm.personId || undefined,
        category: addForm.category || undefined,
        amount: parseFloat(addForm.amount),
        period: addForm.period,
        notifyEmail: addForm.notifyEmail.trim() || null,
        notifyThresholds: addForm.notifyThresholds,
      })
      setAddForm({ ...emptyForm })
      setShowAddForm(false)
    } catch (error) {
      setAddError(error instanceof Error ? error.message : BUDGET_LIMIT_ERROR)
    }
  }

  const startEdit = (s: BudgetStatus) => {
    setEditingId(s.budget.id)
    setEditForm({
      label: s.budget.label,
      personId: s.budget.personId ?? '',
      category: s.budget.category ?? '',
      amount: String(s.budget.amount),
      period: s.budget.period,
      notifyEmail: s.budget.notifyEmail ?? '',
      notifyThresholds: s.budget.notifyThresholds ?? [80, 100],
    })
    setShowAddForm(false)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.label.trim() || !editForm.amount) return
    await updateBudget(editingId, {
      label: editForm.label.trim(),
      personId: editForm.personId || undefined,
      category: editForm.category || undefined,
      amount: parseFloat(editForm.amount),
      period: editForm.period,
      notifyEmail: editForm.notifyEmail.trim() || null,
      notifyThresholds: editForm.notifyThresholds,
    })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await removeBudget(id)
    if (editingId === id) setEditingId(null)
  }

  const handleSendTestEmail = async (budgetId: string) => {
    setTestEmailStates((s) => ({
      ...s,
      [budgetId]: { status: 'sending', message: 'Sending test email…' },
    }))

    try {
      await sendBudgetTestEmail(budgetId)
      setTestEmailStates((s) => ({
        ...s,
        [budgetId]: { status: 'success', message: 'Test email sent' },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test email'
      setTestEmailStates((s) => ({
        ...s,
        [budgetId]: { status: 'error', message },
      }))
    }
  }

  const personName = (personId?: string) =>
    personId ? (persons.find((p) => p.id === personId)?.name ?? 'Unknown') : 'Household'

  const addFormInvalid = !addForm.label.trim() || !addForm.amount
  const editFormInvalid = !editForm.label.trim() || !editForm.amount

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
            <Target size={20} className="text-accent-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Budgets</h1>
            <p className="text-sm text-slate-400">Track spend against category and person thresholds</p>
          </div>
        </div>
        {!showAddForm && (
          budgetLimitReached ? (
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
              Limit of {MAX_BUDGETS_PER_HOUSEHOLD} budgets reached
            </span>
          ) : (
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); setAddError('') }}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
            >
              <Plus size={15} /> Add Budget
            </button>
          )
        )}
      </div>

      {budgetLimitReached && !showAddForm && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Limit of {MAX_BUDGETS_PER_HOUSEHOLD} budgets reached.
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {alerts.map((s) => {
            const isOver = s.status === 'over'
            return (
              <div
                key={s.budget.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                  isOver
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  <span className="font-semibold">{s.budget.label}</span>
                  {isOver
                    ? ` is over budget — ${formatCurrency(s.spent)} of ${formatCurrency(s.budget.amount)}`
                    : ` is at ${s.percentUsed.toFixed(0)}% — ${formatCurrency(s.remaining)} remaining`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white border border-accent-200 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">New Budget</p>
          {addError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {addError}
            </div>
          )}
          <BudgetFormPanel
            form={addForm}
            setForm={setAddForm}
            persons={persons}
            categoryNames={categoryNames}
            submitLabel="Create Budget"
            onSubmit={handleAdd}
            onCancel={() => { setShowAddForm(false); setAddForm({ ...emptyForm }); setAddError('') }}
            disableSubmit={addFormInvalid || budgetLimitReached}
          />
        </div>
      )}

      {/* Budget list */}
      {statuses.length === 0 && !showAddForm ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <Target size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No budgets yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Create a budget to track spending by category or person.
          </p>
          <button
            onClick={() => { setShowAddForm(true); setAddError('') }}
            disabled={budgetLimitReached}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Add your first budget
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {statuses.map((s) => {
            if (editingId === s.budget.id) {
              return (
                <div key={s.budget.id} className="bg-white border border-accent-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Edit Budget</p>
                  <BudgetFormPanel
                    form={editForm}
                    setForm={setEditForm}
                    persons={persons}
                    categoryNames={categoryNames}
                    submitLabel="Save"
                    onSubmit={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                    disableSubmit={editFormInvalid}
                  />
                </div>
              )
            }
            return (
              <BudgetCard
                key={s.budget.id}
                status={s}
                personName={personName(s.budget.personId)}
                testEmailState={testEmailStates[s.budget.id]}
                onEdit={() => startEdit(s)}
                onDelete={() => handleDelete(s.budget.id)}
                onSendTestEmail={() => handleSendTestEmail(s.budget.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
