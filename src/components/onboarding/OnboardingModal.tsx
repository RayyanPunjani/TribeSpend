import { useState } from 'react'
import { BarChart3, CreditCard, Link2, Users, X } from 'lucide-react'

type OnboardingStep = {
  title: string
  copy: string
  cta: string
  path: string
  icon: typeof Users
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Add People',
    copy: 'Add the people whose spending you want to track.',
    cta: 'Go to People',
    path: '/app/wallet?tab=people',
    icon: Users,
  },
  {
    title: 'Add Payment Methods',
    copy: 'Add cards so TribeSpend can match transactions to rewards.',
    cta: 'Go to Payment Methods',
    path: '/app/wallet?tab=paymentMethods',
    icon: CreditCard,
  },
  {
    title: 'Link Bank Accounts',
    copy: 'Connect accounts through Plaid to import transactions automatically.',
    cta: 'Go to Linked Accounts',
    path: '/app/wallet?tab=linkedAccounts',
    icon: Link2,
  },
  {
    title: 'Review Insights',
    copy: 'Use your dashboard and analytics to understand spending, rewards, and budgets.',
    cta: 'Go to Dashboard',
    path: '/app',
    icon: BarChart3,
  },
]

interface OnboardingModalProps {
  onComplete: (path?: string) => Promise<void> | void
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const step = STEPS[stepIndex]
  const Icon = step.icon
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  const complete = async (path?: string) => {
    setSaving(true)
    try {
      await onComplete(path)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Welcome to TribeSpend</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Set up your workspace</h2>
          </div>
          <button
            type="button"
            onClick={() => complete()}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close onboarding"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-5 flex items-center gap-2">
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

          <button
            type="button"
            onClick={() => complete(step.path)}
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            {step.cta}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={() => complete()}
            disabled={saving}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            Skip
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
                onClick={() => complete()}
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
