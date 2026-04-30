import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'

export const MAX_BUDGETS_PER_HOUSEHOLD = 3
export const BUDGET_LIMIT_ERROR = 'You can only create up to 3 budgets.'

export interface Budget {
  id: string
  householdId: string
  personId?: string       // undefined = whole household
  category?: string       // undefined = all spending
  label: string
  amount: number
  period: 'weekly' | 'monthly' | 'annual'
  notifyEmail: string | null   // null = no notifications
  notifyThresholds: number[]   // percentage values, e.g. [50, 80, 100]
  createdAt: string
}

interface BudgetState {
  budgets: Budget[]
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, budget: Omit<Budget, 'id' | 'createdAt' | 'householdId'>) => Promise<Budget>
  update: (id: string, patch: Partial<Omit<Budget, 'id' | 'householdId' | 'createdAt'>>) => Promise<void>
  remove: (id: string) => Promise<void>
}

function parseThresholds(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as number[] } catch { /* fall through */ }
  }
  return [80, 100]
}

function fromRow(r: Record<string, unknown>): Budget {
  return {
    id: r.id as string,
    householdId: r.household_id as string,
    personId: (r.person_id as string) || undefined,
    category: (r.category as string) || undefined,
    label: r.label as string,
    amount: Number(r.amount),
    period: r.period as Budget['period'],
    notifyEmail: (r.notify_email as string) || null,
    notifyThresholds: parseThresholds(r.notify_thresholds),
    createdAt: r.created_at as string,
  }
}

function toRow(b: Partial<Budget> & { id?: string }, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId) row.household_id = householdId
  if (b.id !== undefined) row.id = b.id
  if (b.personId !== undefined) row.person_id = b.personId ?? null
  if (b.category !== undefined) row.category = b.category ?? null
  if (b.label !== undefined) row.label = b.label
  if (b.amount !== undefined) row.amount = b.amount
  if (b.period !== undefined) row.period = b.period
  if (b.notifyEmail !== undefined) row.notify_email = b.notifyEmail
  if (b.notifyThresholds !== undefined) row.notify_thresholds = b.notifyThresholds
  if (b.createdAt !== undefined) row.created_at = b.createdAt
  return row
}

export const useBudgetStore = create<BudgetState>((set) => ({
  budgets: [],
  loaded: false,

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('household_id', householdId)
    if (error) { console.error('Failed to load budgets:', error); return }
    set({ budgets: (data || []).map(fromRow), loaded: true })
  },

  add: async (householdId, budget) => {
    const { count, error: countError } = await supabase
      .from('budgets')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)

    if (countError) {
      console.error('Failed to count budgets:', countError)
      throw countError
    }

    if ((count ?? 0) >= MAX_BUDGETS_PER_HOUSEHOLD) {
      throw new Error(BUDGET_LIMIT_ERROR)
    }

    const newBudget: Budget = {
      ...budget,
      id: uuidv4(),
      householdId,
      createdAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('budgets').insert(toRow(newBudget, householdId))
    if (error) { console.error('Failed to add budget:', error); throw error }
    set((s) => ({ budgets: [...s.budgets, newBudget] }))
    return newBudget
  },

  update: async (id, patch) => {
    const { error } = await supabase.from('budgets').update(toRow(patch)).eq('id', id)
    if (error) { console.error('Failed to update budget:', error); return }
    set((s) => ({
      budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) { console.error('Failed to remove budget:', error); return }
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }))
  },
}))
