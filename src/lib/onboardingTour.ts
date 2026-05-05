export interface OnboardingTourStep {
  id: string
  route: string
  selector: string
  title: string
  description: string
  details?: string[]
  example?: {
    label: string
    rows: Array<{ name: string; detail: string; value?: string }>
  }
}

export const TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: 'intro',
    route: '/app',
    selector: "[data-tour='dashboard-overview']",
    title: 'See what TribeSpend can do',
    description: 'Preview the app with example spending. See how tracking, budgets, returns, and rewards fit together.',
    example: {
      label: 'Example data',
      rows: [
        { name: 'Spending overview', detail: 'Dining, groceries, rent, and entertainment', value: '$6.1k' },
        { name: 'Potential rewards', detail: 'Best-card suggestions from sample transactions', value: '$82' },
      ],
    },
  },
  {
    id: 'transactions',
    route: '/app/transactions',
    selector: "[data-tour='transactions-actions']",
    title: 'Transactions',
    description: 'Keep every purchase in one clear list. Fix categories, cards, and people as you review spending.',
    details: [
      'Change the category, card, or person for any transaction inline.',
      'Use row icons to mark recurring charges, reimbursements, returns, notes, or hidden transactions.',
    ],
  },
  {
    id: 'wallet',
    route: '/app/wallet',
    selector: "[data-tour='wallet-section']",
    title: 'Wallet Overview',
    description: 'Set up people, cards, and linked accounts. This makes each transaction easier to understand.',
    details: [
      'People track who is spending and who owes money.',
      'Payment methods power card attribution and rewards.',
      'Linked Accounts are a Premium way to sync automatically through Plaid.',
    ],
  },
  {
    id: 'returns',
    route: '/app/returns',
    selector: "[data-tour='returns-section']",
    title: 'Returns',
    description: 'Track refunds from expected to complete. Review suggested matches so credits do not get lost.',
    details: ['Credits and refunds can be automatically suggested for return review.'],
  },
  {
    id: 'reimbursements',
    route: '/app/reimbursements',
    selector: "[data-tour='reimbursements-section']",
    title: 'Reimbursements',
    description: 'Track money others owe you. Settle shared spending without digging through old statements.',
  },
  {
    id: 'recurring',
    route: '/app/recurring',
    selector: "[data-tour='recurring-section']",
    title: 'Recurring',
    description: 'Spot subscriptions and repeating charges. Catch recurring spend before it fades into the background.',
    details: ['Recurring transactions can be detected automatically, or marked manually from Transactions.'],
  },
  {
    id: 'analytics',
    route: '/app/analytics',
    selector: "[data-tour='analytics-chart']",
    title: 'Analytics',
    description: 'See where your money is going. Track trends and spot changes over time.',
    example: {
      label: 'Example data',
      rows: [
        { name: 'Total Spend', detail: 'Last 6 months trend', value: '$6,420' },
        { name: 'Spending by Category', detail: 'Dining, groceries, subscriptions, and more' },
      ],
    },
  },
  {
    id: 'budgets',
    route: '/app/budgets',
    selector: "[data-tour='budgets-section']",
    title: 'Budgets',
    description: 'Set simple spending limits. Get a heads-up before a category runs hot.',
    example: {
      label: 'Example budgets',
      rows: [
        { name: 'Dining', detail: '$210 of $300 used', value: '70%' },
        { name: 'Groceries', detail: '$300 of $500 used', value: '60%' },
        { name: 'Subscriptions', detail: '$90 of $100 used', value: '90%' },
      ],
    },
  },
  {
    id: 'optimize',
    route: '/app/optimize',
    selector: "[data-tour='optimize-card']",
    title: 'Optimize',
    description: 'Find missed rewards. See which card would have worked harder for each purchase.',
    example: {
      label: 'Example recommendations',
      rows: [
        { name: 'Urban Cafe', detail: 'Use Sapphire Preferred for dining', value: '$38/yr' },
        { name: 'Fresh Market', detail: 'Use Blue Cash Preferred for groceries', value: '$96/yr' },
      ],
    },
  },
  {
    id: 'use-data',
    route: '/app/transactions',
    selector: "[data-tour='transactions-actions']",
    title: 'Use your own data',
    description: 'Upload CSV for free or add transactions manually. Upgrade when you want automatic bank syncing.',
    details: [
      'Sample examples are UI-only and never inserted into Supabase.',
      'Examples remain available in the guide even after real data exists.',
    ],
  },
  {
    id: 'help-support',
    route: '/app/help',
    selector: "[data-tour='help-support']",
    title: 'Help & Support',
    description: 'Come back here when you need help. Restart the tour, send feedback, or report a bug.',
  },
]

export const TOUR_HAS_SEEN_KEY = 'tribespend_hasSeenTour'
export const TOUR_CURRENT_STEP_KEY = 'tribespend_currentStep'
export const TOUR_DISMISSED_KEY = 'onboarding_dismissed'
