import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CardCredit } from '@/types'
import { supabase } from '@/lib/supabase'
import { nullableUuid, sanitizeUuidFields } from '@/utils/uuid'

interface CardCreditState {
  credits: CardCredit[]
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, credit: Omit<CardCredit, 'id'>) => Promise<CardCredit>
  update: (id: string, patch: Partial<CardCredit>) => Promise<void>
  remove: (id: string) => Promise<void>
  getByCard: (cardId: string) => CardCredit[]
}

function fromRow(r: Record<string, unknown>): CardCredit {
  return {
    id: r.id as string,
    cardId: r.card_id as string,
    name: r.name as string,
    amount: Number(r.amount),
    frequency: r.frequency as CardCredit['frequency'],
    creditType: r.credit_type as CardCredit['creditType'],
    category: r.category as string | undefined,
    merchantMatch: r.merchant_match as string | undefined,
    notes: r.notes as string | undefined,
    cardAnniversaryBased: (r.card_anniversary_based as boolean) || false,
  }
}

function toRow(c: Partial<CardCredit>, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId !== undefined) row.household_id = nullableUuid(householdId)
  if (c.id !== undefined) row.id = c.id
  if (c.cardId !== undefined) row.card_id = nullableUuid(c.cardId)
  if (c.name !== undefined) row.name = c.name
  if (c.amount !== undefined) row.amount = c.amount
  if (c.frequency !== undefined) row.frequency = c.frequency
  if (c.creditType !== undefined) row.credit_type = c.creditType
  if (c.category !== undefined) row.category = c.category
  if (c.merchantMatch !== undefined) row.merchant_match = c.merchantMatch
  if (c.notes !== undefined) row.notes = c.notes
  if (c.cardAnniversaryBased !== undefined) row.card_anniversary_based = c.cardAnniversaryBased
  return sanitizeUuidFields(row)
}

export const useCardCreditStore = create<CardCreditState>((set, get) => ({
  credits: [],
  loaded: false,

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('card_credits')
      .select('*')
      .eq('household_id', householdId)
    if (error) { console.error('Failed to load card credits:', error); return }
    set({ credits: (data || []).map(fromRow), loaded: true })
  },

  add: async (householdId, credit) => {
    const newCredit: CardCredit = { ...credit, id: uuidv4() }
    const { error } = await supabase.from('card_credits').insert(toRow(newCredit, householdId))
    if (error) { console.error('Failed to add card credit:', error); throw error }
    set((s) => ({ credits: [...s.credits, newCredit] }))
    return newCredit
  },

  update: async (id, patch) => {
    const { error } = await supabase.from('card_credits').update(toRow(patch)).eq('id', id)
    if (error) { console.error('Failed to update card credit:', error); return }
    set((s) => ({ credits: s.credits.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('card_credits').delete().eq('id', id)
    if (error) { console.error('Failed to remove card credit:', error); return }
    set((s) => ({ credits: s.credits.filter((c) => c.id !== id) }))
  },

  getByCard: (cardId) => get().credits.filter((c) => c.cardId === cardId),
}))
