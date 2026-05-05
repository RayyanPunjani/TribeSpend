import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CategoryRule } from '@/types'
import { supabase } from '@/lib/supabase'
import { nullableUuid, sanitizeUuidFields } from '@/utils/uuid'

interface CategoryRuleState {
  rules: CategoryRule[]
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, rule: Omit<CategoryRule, 'id' | 'createdAt' | 'matchCount'>) => Promise<CategoryRule>
  update: (id: string, patch: Partial<CategoryRule>) => Promise<void>
  remove: (id: string) => Promise<void>
  incrementMatchCount: (id: string) => Promise<void>
  importRules: (householdId: string, rules: CategoryRule[]) => Promise<void>
}

function fromRow(r: Record<string, unknown>): CategoryRule {
  return {
    id: r.id as string,
    merchantPattern: r.merchant_pattern as string,
    rawDescriptionExample: (r.raw_description_example as string) || '',
    cleanDescription: (r.clean_description as string) || '',
    category: r.category as string,
    cardId: (r.card_id as string) || undefined,
    personId: (r.person_id as string) || undefined,
    createdAt: r.created_at as string,
    source: (r.source as CategoryRule['source']) || 'user_correction',
    matchCount: (r.match_count as number) || 0,
  }
}

function toRow(rule: Partial<CategoryRule>, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId !== undefined) row.household_id = nullableUuid(householdId)
  if (rule.id !== undefined) row.id = rule.id
  if (rule.merchantPattern !== undefined) row.merchant_pattern = rule.merchantPattern
  if (rule.rawDescriptionExample !== undefined) row.raw_description_example = rule.rawDescriptionExample
  if (rule.cleanDescription !== undefined) row.clean_description = rule.cleanDescription
  if (rule.category !== undefined) row.category = rule.category
  if (rule.cardId !== undefined) row.card_id = nullableUuid(rule.cardId)
  if (rule.personId !== undefined) row.person_id = nullableUuid(rule.personId)
  if (rule.source !== undefined) row.source = rule.source
  if (rule.matchCount !== undefined) row.match_count = rule.matchCount
  return sanitizeUuidFields(row)
}

function isDuplicateRuleError(error: unknown): boolean {
  const err = error as { code?: string; status?: number; message?: string }
  return (
    err.code === '23505' ||
    err.status === 409 ||
    /duplicate key value violates unique constraint/i.test(err.message ?? '')
  )
}

export const useCategoryRuleStore = create<CategoryRuleState>((set, get) => ({
  rules: [],
  loaded: false,

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('category_rules')
      .select('*')
      .eq('household_id', householdId)
    if (error) { console.error('Failed to load category rules:', error); return }
    set({ rules: (data || []).map(fromRow), loaded: true })
  },

  add: async (householdId, ruleData) => {
    const rule: CategoryRule = {
      ...ruleData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      matchCount: 0,
    }
    const { error } = await supabase.from('category_rules').insert(toRow(rule, householdId))
    if (error) {
      if (isDuplicateRuleError(error)) {
        console.warn('[categoryRuleStore] Category rule already exists, continuing import:', {
          merchantPattern: rule.merchantPattern,
          category: rule.category,
          error,
        })
        const existing = get().rules.find(
          (r) => r.merchantPattern === rule.merchantPattern,
        )
        if (existing) {
          const merged = {
            ...existing,
            cleanDescription: rule.cleanDescription,
            category: rule.category,
            cardId: rule.cardId,
            personId: rule.personId,
            source: rule.source,
          }
          const { error: updateError } = await supabase
            .from('category_rules')
            .update(toRow(merged))
            .eq('id', existing.id)
          if (updateError) {
            console.warn('[categoryRuleStore] Could not update duplicate category rule:', updateError)
            return existing
          }
          set((s) => ({
            rules: s.rules.map((r) => (r.id === existing.id ? merged : r)),
          }))
          return merged
        }
        return rule
      }
      console.error('Failed to add category rule:', error)
      throw error
    }
    set((s) => ({ rules: [...s.rules, rule] }))
    return rule
  },

  update: async (id, patch) => {
    const { error } = await supabase.from('category_rules').update(toRow(patch)).eq('id', id)
    if (error) { console.error('Failed to update category rule:', error); return }
    set((s) => ({
      rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('category_rules').delete().eq('id', id)
    if (error) { console.error('Failed to remove category rule:', error); return }
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
  },

  incrementMatchCount: async (id) => {
    const rule = get().rules.find((r) => r.id === id)
    if (!rule) return
    const matchCount = (rule.matchCount || 0) + 1
    const { error } = await supabase.from('category_rules').update({ match_count: matchCount }).eq('id', id)
    if (error) { console.error('Failed to increment match count:', error); return }
    set((s) => ({
      rules: s.rules.map((r) => (r.id === id ? { ...r, matchCount } : r)),
    }))
  },

  importRules: async (householdId, rules) => {
    const rows = rules.map((r) => toRow(r, householdId))
    const { error } = await supabase.from('category_rules').upsert(rows, { onConflict: 'id' })
    if (error) { console.error('Failed to import rules:', error); return }
    await get().load(householdId)
  },
}))
