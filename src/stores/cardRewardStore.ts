import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CardRewardRule } from '@/types'
import { supabase } from '@/lib/supabase'
import { nullableUuid, sanitizeUuidFields } from '@/utils/uuid'

interface CardRewardState {
  rules: CardRewardRule[]
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, rule: Omit<CardRewardRule, 'id'>) => Promise<CardRewardRule>
  update: (id: string, patch: Partial<CardRewardRule>) => Promise<void>
  remove: (id: string) => Promise<void>
  getByCard: (cardId: string) => CardRewardRule[]
}

function fromRow(r: Record<string, unknown>): CardRewardRule {
  const rawKeywords = r.merchant_keywords
  const merchantKeywords = Array.isArray(rawKeywords)
    ? rawKeywords.map(String)
    : typeof rawKeywords === 'string'
      ? rawKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined

  return {
    id: r.id as string,
    cardId: r.card_id as string,
    category: r.category as string,
    merchantKeywords,
    rewardType: r.reward_type as 'cashback' | 'points',
    rewardRate: Number(r.reward_rate),
    isRotating: (r.is_rotating as boolean) || false,
    activeStartDate: r.active_start_date as string | undefined,
    activeEndDate: r.active_end_date as string | undefined,
    notes: r.notes as string | undefined,
  }
}

function toRow(rule: Partial<CardRewardRule>, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId !== undefined) row.household_id = nullableUuid(householdId)
  if (rule.id !== undefined) row.id = rule.id
  if (rule.cardId !== undefined) row.card_id = nullableUuid(rule.cardId)
  if (rule.category !== undefined) row.category = rule.category
  if (rule.merchantKeywords !== undefined) row.merchant_keywords = rule.merchantKeywords.length > 0 ? rule.merchantKeywords : null
  if (rule.rewardType !== undefined) row.reward_type = rule.rewardType
  if (rule.rewardRate !== undefined) row.reward_rate = rule.rewardRate
  if (rule.isRotating !== undefined) row.is_rotating = rule.isRotating
  if (rule.activeStartDate !== undefined) row.active_start_date = rule.activeStartDate
  if (rule.activeEndDate !== undefined) row.active_end_date = rule.activeEndDate
  if (rule.notes !== undefined) row.notes = rule.notes
  return sanitizeUuidFields(row)
}

export const useCardRewardStore = create<CardRewardState>((set, get) => ({
  rules: [],
  loaded: false,

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('card_reward_rules')
      .select('*')
      .eq('household_id', householdId)
    if (error) { console.error('Failed to load reward rules:', error); return }
    set({ rules: (data || []).map(fromRow), loaded: true })
  },

  add: async (householdId, rule) => {
    const newRule: CardRewardRule = { ...rule, id: uuidv4() }
    const { error } = await supabase.from('card_reward_rules').insert(toRow(newRule, householdId))
    if (error) { console.error('Failed to add reward rule:', error); throw error }
    set((s) => ({ rules: [...s.rules, newRule] }))
    return newRule
  },

  update: async (id, patch) => {
    const { error } = await supabase.from('card_reward_rules').update(toRow(patch)).eq('id', id)
    if (error) { console.error('Failed to update reward rule:', error); return }
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('card_reward_rules').delete().eq('id', id)
    if (error) { console.error('Failed to remove reward rule:', error); return }
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
  },

  getByCard: (cardId) => get().rules.filter((r) => r.cardId === cardId),
}))
