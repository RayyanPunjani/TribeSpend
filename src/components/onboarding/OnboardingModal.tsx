import { useState } from 'react'
import {
  BarChart3,
  CreditCard,
  Crown,
  PieChart,
  ReceiptText,
  Repeat2,
  RotateCcw,
  Target,
  Trophy,
  Upload,
  X,
} from 'lucide-react'

type OnboardingStep = {
  title: string
  copy: string
  path?: string
  cta?: string
  icon: typeof BarChart3
  example?: {
    label: string
    rows: Array<{ name: string; detail: string; value?: string }>
  }
}

const STEPS: OnboardingStep[] = [
  {
    title: 'See what TribeSpend can do',
    copy: 'Use example spending to explore tracking, budgeting, reimbursements, recurring charges, and card optimization.',
    path: '/app',
    cta: 'View Dashboard',
    icon: Trophy,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Last 6 months', detail: 'Dining, groceries, rent, and entertainment', value: '$6.1k' },
        { name: 'Potential rewards', detail: 'Best-card suggestions from sample transactions', value: '$82' },
      ],
    },
  },
  {
    title: 'Transactions',
    copy: 'See every purchase in one place, with categories and spending visibility that make statements easier to understand.',
    path: '/app/transactions',
    cta: 'View Transactions',
    icon: ReceiptText,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Fresh Market', detail: 'Groceries · Example Card', value: '$289.64' },
        { name: 'Urban Cafe', detail: 'Dining · Example Card', value: '$84.20' },
      ],
    },
  },
  {
    title: 'Returns & Reimbursements',
    copy: 'Track money owed back, expected returns, and matched refunds so credits do not get lost in the shuffle.',
    path: '/app/returns',
    cta: 'View Returns',
    icon: RotateCcw,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Headphones return', detail: 'Expected refund', value: '$129.00' },
        { name: 'Dinner split', detail: 'Reimbursement pending', value: '$42.50' },
      ],
    },
  },
  {
    title: 'Recurring',
    copy: 'Spot subscriptions and repeating charges so you can review what keeps coming back every month.',
    path: '/app/recurring',
    cta: 'View Recurring',
    icon: Repeat2,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Streaming Bundle', detail: 'Monthly · Entertainment', value: '$46.99' },
        { name: 'Gym Membership', detail: 'Monthly · Health', value: '$39.00' },
      ],
    },
  },
  {
    title: 'Analytics',
    copy: 'Use charts, trends, and category or person filters to understand where spending is changing.',
    path: '/app/analytics',
    cta: 'Open Analytics',
    icon: PieChart,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Dining', detail: 'Top category trend', value: '24%' },
        { name: 'Groceries', detail: 'Second-highest category', value: '21%' },
      ],
    },
  },
  {
    title: 'Budgets',
    copy: 'Set spending limits for categories or people and get alerts before a budget gets away from you.',
    path: '/app/budgets',
    cta: 'View Budgets',
    icon: Target,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Dining budget', detail: '$420 of $500 used', value: '84%' },
        { name: 'Groceries budget', detail: '$610 of $750 used', value: '81%' },
      ],
    },
  },
  {
    title: 'Optimize',
    copy: 'Find missed rewards and best-card recommendations so each purchase can work a little harder.',
    path: '/app/optimize',
    cta: 'View Optimize',
    icon: CreditCard,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Amazon purchase', detail: 'Use Amazon card for 5%', value: '+$7.35' },
        { name: 'Restaurant spend', detail: 'Use dining bonus card', value: '+$3.10' },
      ],
    },
  },
  {
    title: 'Use your own data',
    copy: 'Upload CSV for free, or upgrade to Premium to automatically sync transactions through Plaid.',
    icon: Upload,
  },
]

interface OnboardingModalProps {
  onDismiss: (path?: string) => void
  onFinish: () => Promise<void> | void
  showExampleData: boolean
}

export default function OnboardingModal({ onDismiss, onFinish, showExampleData }: OnboardingModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const step = STEPS[stepIndex]
  const Icon = step.icon
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  const finish = async () => {
    setSaving(true)
    try {
      await onFinish()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Guided demo</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Explore TribeSpend</h2>
          </div>
          <button
            type="button"
            onClick={() => onDismiss()}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close onboarding"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-5 flex items-center gap-1.5">
            {STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setStepIndex(index)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= stepIndex ? 'bg-accent-500' : 'bg-slate-200'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Icon size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Step {stepIndex + 1} of {STEPS.length}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{step.copy}</p>
            </div>
          </div>

          {step.example && showExampleData && (
            <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">{step.example.label}</p>
              <div className="space-y-1.5">
                {step.example.rows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{row.name}</p>
                      <p className="truncate text-xs text-slate-400">{row.detail}</p>
                    </div>
                    {row.value && <span className="shrink-0 text-sm font-semibold text-slate-700">{row.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.example && !showExampleData && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Your real transaction data is available now, so example cards are hidden.
            </div>
          )}

          {isLast ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onDismiss('/app/upload')}
                disabled={saving}
                className="rounded-xl border border-accent-200 bg-white px-4 py-3 text-left hover:bg-accent-50 disabled:opacity-50"
              >
                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Free</span>
                <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Upload size={16} /> Upload CSV
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Import statements manually at no cost.</span>
              </button>
              <button
                type="button"
                onClick={() => onDismiss('/app/wallet?tab=linkedAccounts')}
                disabled={saving}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100/70 disabled:opacity-50"
              >
                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Premium</span>
                <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Crown size={16} /> Connect bank automatically
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">Automatically sync transactions through Plaid.</span>
              </button>
            </div>
          ) : (
            step.path && step.cta && (
              <button
                type="button"
                onClick={() => onDismiss(step.path)}
                disabled={saving}
                className="mt-6 w-full rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
              >
                {step.cta}
              </button>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-3 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={() => onDismiss()}
            disabled={saving}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={isFirst || saving}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40"
            >
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Finish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))}
                disabled={saving}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
