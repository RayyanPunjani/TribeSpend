import { useState } from 'react'
import {
  BarChart3,
  CreditCard,
  Crown,
  DollarSign,
  EyeOff,
  HandCoins,
  PackageOpen,
  PieChart,
  Plus,
  ReceiptText,
  Repeat2,
  RotateCcw,
  StickyNote,
  Target,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useSampleTransactionStore } from '@/stores/sampleTransactionStore'
import { formatCurrency } from '@/utils/formatters'

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

type TransactionGuideIcon = 'recurring' | 'reimbursement' | 'return' | 'hide' | 'notes'
type WalletGuideSection = 'people' | 'cards' | 'linked'

const TRANSACTION_ICON_GUIDE: Array<{
  id: TransactionGuideIcon
  label: string
  tooltip: string
  icon: typeof Repeat2
  colorClass: string
}> = [
  {
    id: 'recurring',
    label: 'Recurring',
    tooltip: 'Mark subscriptions and repeating charges',
    icon: Repeat2,
    colorClass: 'text-blue-600 bg-blue-50 ring-blue-200',
  },
  {
    id: 'reimbursement',
    label: 'Reimbursement',
    tooltip: 'Track money others owe you',
    icon: DollarSign,
    colorClass: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
  },
  {
    id: 'return',
    label: 'Return',
    tooltip: 'Track refunds or expected returns',
    icon: PackageOpen,
    colorClass: 'text-amber-600 bg-amber-50 ring-amber-200',
  },
  {
    id: 'hide',
    label: 'Hide',
    tooltip: "Hide transactions you don't want counted in totals.",
    icon: EyeOff,
    colorClass: 'text-slate-600 bg-slate-100 ring-slate-300',
  },
  {
    id: 'notes',
    label: 'Notes',
    tooltip: 'Add notes so you remember context later.',
    icon: StickyNote,
    colorClass: 'text-purple-600 bg-purple-50 ring-purple-200',
  },
]

const WALLET_GUIDE: Array<{
  id: WalletGuideSection
  label: string
  tooltip: string
  icon: typeof Users
  premium?: boolean
}> = [
  {
    id: 'people',
    label: 'People',
    tooltip: 'Add people to track who is spending and who owes money.',
    icon: Users,
  },
  {
    id: 'cards',
    label: 'Payment Methods',
    tooltip: 'Add cards to track spending and optimize rewards.',
    icon: CreditCard,
  },
  {
    id: 'linked',
    label: 'Linked Accounts',
    tooltip: 'Connect your bank to automatically import transactions.',
    icon: Crown,
    premium: true,
  },
]

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
    title: 'Wallet Overview',
    copy: 'Set up the people, cards, and linked accounts that give each transaction useful context.',
    path: '/app/wallet',
    cta: 'View Wallet',
    icon: CreditCard,
  },
  {
    title: 'Returns',
    copy: 'Track expected returns, review suggested refund matches, and confirm completed returns so credits do not get lost.',
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
    title: 'Reimbursements',
    copy: 'Track money others owe you and settle shared spending without digging through old transactions.',
    path: '/app/reimbursements',
    cta: 'View Reimbursements',
    icon: HandCoins,
    example: {
      label: 'Example data',
      rows: [
        { name: 'Nada', detail: '2 unpaid reimbursements', value: '$74.50' },
        { name: 'Dinner split', detail: 'Marked reimbursable', value: '$42.50' },
      ],
    },
  },
  {
    title: 'Recurring',
    copy: 'Spot subscriptions and repeating charges. TribeSpend can detect recurring transactions automatically as your history grows.',
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
  const [activeTransactionIcon, setActiveTransactionIcon] = useState<TransactionGuideIcon>('recurring')
  const [activeWalletSection, setActiveWalletSection] = useState<WalletGuideSection>('people')
  const sampleTransactions = useSampleTransactionStore((state) => state.transactions)
  const sampleFlags = useSampleTransactionStore((state) => state.flags)
  const sampleReimbursements = useSampleTransactionStore((state) => state.reimbursements)
  const sampleReturnDetails = useSampleTransactionStore((state) => state.returns)
  const step = STEPS[stepIndex]
  const Icon = step.icon
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1
  const isTransactionsStep = step.title === 'Transactions'
  const isWalletStep = step.title === 'Wallet Overview'
  const isReturnsStep = step.title === 'Returns'
  const isReimbursementsStep = step.title === 'Reimbursements'
  const isRecurringStep = step.title === 'Recurring'
  const visibleSampleTransactions = sampleTransactions.filter((transaction) => !sampleFlags[transaction.id]?.hidden)
  const sampleReturns = visibleSampleTransactions.filter((transaction) => sampleFlags[transaction.id]?.return)
  const sampleReimbursementRows = visibleSampleTransactions.filter((transaction) => sampleFlags[transaction.id]?.reimbursement)
  const sampleRecurring = visibleSampleTransactions.filter((transaction) => sampleFlags[transaction.id]?.recurring)
  const returnsPreview = sampleReturns.length > 0 ? sampleReturns : [sampleTransactions[2]]
  const reimbursementsPreview = sampleReimbursementRows.length > 0 ? sampleReimbursementRows : [sampleTransactions[1]]
  const recurringPreview = sampleRecurring.length > 0 ? sampleRecurring : [sampleTransactions[0]]
  const recurringMonthlyTotal = recurringPreview.reduce((sum, transaction) => sum + transaction.amount, 0)

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

          {isTransactionsStep && (
            <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">Example data</p>
              <div className="relative overflow-visible rounded-xl bg-white p-3 shadow-sm">
                <div className="absolute inset-0 rounded-xl bg-slate-900/5 pointer-events-none" />
                <div className="relative flex items-center gap-3">
                  <div className={`min-w-0 flex-1 transition-opacity ${activeTransactionIcon ? 'opacity-45' : ''}`}>
                    <p className="truncate text-sm font-semibold text-slate-800">Streaming Bundle</p>
                    <p className="truncate text-xs text-slate-400">Entertainment · Example Card · $46.99</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {TRANSACTION_ICON_GUIDE.map(({ id, label, tooltip, icon: GuideIcon, colorClass }) => {
                      const active = activeTransactionIcon === id
                      return (
                        <div key={id} className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveTransactionIcon(id)}
                            className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-all ${
                              active
                                ? `${colorClass} scale-105 shadow-lg opacity-100`
                                : 'bg-white text-slate-400 ring-slate-200 opacity-35 hover:opacity-80'
                            }`}
                            aria-label={label}
                          >
                            <GuideIcon size={16} />
                          </button>
                          {active && (
                            <div className="absolute right-0 top-11 z-20 w-44 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white shadow-xl">
                              {tooltip}
                              <span className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 bg-slate-900" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-12 flex flex-wrap gap-1.5">
                {TRANSACTION_ICON_GUIDE.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTransactionIcon(id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      activeTransactionIcon === id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isWalletStep && (
            <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">Wallet structure</p>
              <div className="relative overflow-visible rounded-xl bg-white p-3 shadow-sm">
                <div className="absolute inset-0 rounded-xl bg-slate-900/5 pointer-events-none" />
                <div className="relative grid gap-2 sm:grid-cols-3">
                  {WALLET_GUIDE.map(({ id, label, tooltip, icon: SectionIcon, premium }) => {
                    const active = activeWalletSection === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveWalletSection(id)}
                        className={`relative rounded-xl border p-3 text-left transition-all ${
                          active
                            ? 'z-10 scale-[1.02] border-accent-300 bg-white shadow-lg opacity-100'
                            : 'border-slate-200 bg-white opacity-35 hover:opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                            <SectionIcon size={17} />
                          </div>
                          {premium && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Premium
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {id === 'people' && 'Rayyan, Nada'}
                          {id === 'cards' && 'Example Card, Rewards Card'}
                          {id === 'linked' && 'Automatic imports'}
                        </p>
                        {active && (
                          <div className="absolute left-2 right-2 top-[calc(100%+8px)] z-20 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white shadow-xl sm:left-0 sm:right-auto sm:w-48">
                            {tooltip}
                            <span className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 bg-slate-900" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="mt-14 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm">
                Transactions are linked to people and cards to track spending and rewards.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {WALLET_GUIDE.map(({ id, label, premium }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveWalletSection(id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      activeWalletSection === id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {label}{premium ? ' · Premium' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isReturnsStep && showExampleData && (
            <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">Example data</p>
              <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 text-[11px] font-semibold text-slate-500">
                  <div className="rounded-lg bg-white px-2 py-1.5 text-center text-slate-800 shadow-sm">Expected</div>
                  <div className="px-2 py-1.5 text-center">Review</div>
                  <div className="px-2 py-1.5 text-center">Completed</div>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-600">Expected</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">{returnsPreview.find((transaction) => (sampleReturnDetails[transaction.id]?.status ?? 'expected') === 'expected')?.merchant ?? returnsPreview[0]?.merchant ?? 'Return item'}</p>
                    <p className="text-xs text-slate-400">Pending refund</p>
                    <p className="mt-1 text-sm font-semibold text-purple-600">{formatCurrency(sampleReturnDetails[returnsPreview[0]?.id]?.amount ?? returnsPreview[0]?.amount ?? 129)}</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Review</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">Refund credit</p>
                    <p className="text-xs text-slate-400">Needs match review</p>
                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Match</span>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Completed</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">{returnsPreview.find((transaction) => sampleReturnDetails[transaction.id]?.status === 'completed')?.merchant ?? returnsPreview[0]?.merchant ?? 'Matched refund'}</p>
                    <p className="text-xs text-slate-400">Refund received</p>
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Completed</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isReimbursementsStep && showExampleData && (
            <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">Example data</p>
              <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Nada</p>
                    <p className="text-xs text-slate-400">Outstanding: $74.50 · Paid: $0.00</p>
                  </div>
                  <span className="rounded-lg bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white">Settle Up</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {reimbursementsPreview.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{transaction.merchant}</p>
                        <p className="text-xs text-slate-400">{sampleReimbursements[transaction.id]?.note || transaction.description}</p>
                      </div>
                      <span className="text-sm font-semibold text-orange-600">{formatCurrency(sampleReimbursements[transaction.id]?.amount ?? transaction.amount / 2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isRecurringStep && showExampleData && (
            <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">Example data</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-xs text-slate-400">Monthly total</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(recurringMonthlyTotal)}</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-xs text-slate-400">Annual estimate</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(recurringMonthlyTotal * 12)}</p>
                </div>
              </div>
              <div className="mt-2 divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
                {recurringPreview.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{transaction.merchant}</p>
                      <p className="text-xs text-slate-400">Monthly · {transaction.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{formatCurrency(transaction.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(isReturnsStep || isReimbursementsStep || isRecurringStep) && !showExampleData && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Your real transaction data is available now, so example cards are hidden.
            </div>
          )}

          {step.example && showExampleData && !isTransactionsStep && !isWalletStep && !isReturnsStep && !isReimbursementsStep && !isRecurringStep && (
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

          {step.example && !showExampleData && !isTransactionsStep && !isWalletStep && !isReturnsStep && !isReimbursementsStep && !isRecurringStep && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              Your real transaction data is available now, so example cards are hidden.
            </div>
          )}

          {isLast ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => onDismiss('/app/transactions?action=add')}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Manual</span>
                  <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Plus size={16} /> Add transactions manually
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">Enter purchases one at a time when you need to.</span>
                </button>
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
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                You can revisit this guide anytime in{' '}
                <button
                  type="button"
                  onClick={() => onDismiss('/app/help')}
                  disabled={saving}
                  className="font-semibold text-accent-700 hover:text-accent-800 disabled:opacity-50"
                >
                  Help &amp; Support
                </button>
                .
              </p>
            </>
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
