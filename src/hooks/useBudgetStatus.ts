import { useMemo } from 'react'
import { useBudgetStore, type Budget } from '@/stores/budgetStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { EXCLUDED_FROM_SPEND } from '@/lib/constants'

export type BudgetStatusLevel = 'ok' | 'warning' | 'over'

export interface BudgetStatus {
  budget: Budget
  spent: number
  remaining: number
  percentUsed: number
  status: BudgetStatusLevel
  crossedThresholds: number[]   // notifyThresholds the current spend has reached or passed
  nextThreshold: number | null  // lowest notifyThreshold not yet crossed
}

function getPeriodStart(period: Budget['period']): string {
  const now = new Date()
  if (period === 'weekly') {
    const day = now.getDay() // 0=Sun … 6=Sat
    const daysToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + daysToMonday)
    return monday.toISOString().slice(0, 10)
  }
  if (period === 'monthly') {
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${m}-01`
  }
  return `${now.getFullYear()}-01-01`
}

export function useBudgetStatus(): BudgetStatus[] {
  const { budgets } = useBudgetStore()
  const { transactions } = useTransactionStore()
  const { cards } = useCardStore()

  return useMemo(() => {
    return budgets.map((budget) => {
      const periodStart = getPeriodStart(budget.period)

      // Card IDs belonging to the target person (for per-person budgets)
      const personCardIds = budget.personId
        ? new Set(cards.filter((c) => c.owner === budget.personId).map((c) => c.id))
        : null

      const spent = transactions.reduce((sum, t) => {
        // Exclude soft-deleted, payments, credits, balance payments, fully reimbursed, and excluded categories
        if (t.deleted) return sum
        if (t.isPayment || t.isCredit || t.isBalancePayment) return sum
        if (EXCLUDED_FROM_SPEND.includes(t.category)) return sum
        if (t.reimbursementStatus === 'full') return sum
        // Period filter
        if (t.transDate < periodStart) return sum
        // Person filter
        if (personCardIds && !personCardIds.has(t.cardId)) return sum
        // Category filter
        if (budget.category && t.category !== budget.category) return sum
        return sum + t.amount
      }, 0)

      const remaining = budget.amount - spent
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
      const status: BudgetStatusLevel =
        percentUsed >= 100 ? 'over' : percentUsed >= 80 ? 'warning' : 'ok'

      const thresholds = budget.notifyThresholds ?? []
      const crossedThresholds = thresholds.filter((t) => percentUsed >= t)
      const nextThreshold =
        thresholds.filter((t) => percentUsed < t).sort((a, b) => a - b)[0] ?? null

      return { budget, spent, remaining, percentUsed, status, crossedThresholds, nextThreshold }
    })
  }, [budgets, transactions, cards])
}
