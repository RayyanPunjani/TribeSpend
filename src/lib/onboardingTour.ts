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
    description: 'Use example spending to explore tracking, budgeting, reimbursements, recurring charges, and card optimization.',
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
    description: 'See every purchase in one place, with categories and spending visibility that make statements easier to understand.',
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
    description: 'Set up the people, cards, and linked accounts that give each transaction useful context.',
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
    description: 'Track expected returns, review suggested refund matches, and confirm completed returns so credits do not get lost.',
    details: ['Credits and refunds can be automatically suggested for return review.'],
  },
  {
    id: 'reimbursements',
    route: '/app/reimbursements',
    selector: "[data-tour='reimbursements-section']",
    title: 'Reimbursements',
    description: 'Track money others owe you and settle shared spending without digging through old transactions.',
  },
  {
    id: 'recurring',
    route: '/app/recurring',
    selector: "[data-tour='recurring-section']",
    title: 'Recurring',
    description: 'Spot subscriptions and repeating charges as your transaction history grows.',
    details: ['Recurring transactions can be detected automatically, or marked manually from Transactions.'],
  },
  {
    id: 'analytics',
    route: '/app/analytics',
    selector: "[data-tour='analytics-chart']",
    title: 'Analytics',
    description: 'Use charts, trends, and category or person filters to understand where spending is changing.',
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
    description: 'Set spending limits for categories or people and get alerts before a budget gets away from you.',
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
    description: 'Find missed rewards and best-card recommendations so each purchase can work a little harder.',
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
    description: 'Upload CSV for free, add transactions manually, or upgrade to Premium to automatically sync transactions through Plaid.',
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
    description: 'You can reopen the guided tour, contact support, send feedback, or report bugs here.',
  },
]

export const TOUR_HAS_SEEN_KEY = 'tribespend_hasSeenTour'
export const TOUR_CURRENT_STEP_KEY = 'tribespend_currentStep'
