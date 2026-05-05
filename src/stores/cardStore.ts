import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CreditCard } from '@/types'
import { supabase } from '@/lib/supabase'
import { nextColor } from '@/utils/colors'
import { nullableUuid, sanitizeUuidFields } from '@/utils/uuid'

interface CardState {
  cards: CreditCard[]
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, card: Omit<CreditCard, 'id'>) => Promise<CreditCard>
  update: (id: string, patch: Partial<CreditCard>) => Promise<void>
  remove: (id: string) => Promise<void>
  getById: (id: string) => CreditCard | undefined
}

function fromRow(r: Record<string, unknown>): CreditCard {
  return {
    id: r.id as string,
    name: r.name as string,
    issuer: (r.issuer as string) || '',
    cardType: (r.card_type as string) || '',
    lastFour: (r.last_four as string) || '',
    owner: (r.person_id as string) || '',
    color: (r.color as string) || '#3b82f6',
    isPaymentMethod: (r.is_payment_method as boolean) || false,
    annualFee: r.annual_fee as number | undefined,
    isAuthorizedUser: (r.is_authorized_user as boolean) || false,
    isCustomName: (r.is_custom_name as boolean) || false,
  }
}

function toRow(c: Partial<CreditCard>, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId !== undefined) row.household_id = nullableUuid(householdId)
  if (c.id !== undefined) row.id = c.id
  if (c.name !== undefined) row.name = c.name
  if (c.issuer !== undefined) row.issuer = c.issuer
  if (c.cardType !== undefined) row.card_type = c.cardType
  if (c.lastFour !== undefined) row.last_four = c.lastFour
  if (c.owner !== undefined) row.person_id = nullableUuid(c.owner)
  if (c.color !== undefined) row.color = c.color
  if (c.isPaymentMethod !== undefined) row.is_payment_method = c.isPaymentMethod
  if (c.annualFee !== undefined) row.annual_fee = c.annualFee
  if (c.isAuthorizedUser !== undefined) row.is_authorized_user = c.isAuthorizedUser
  if (c.isCustomName !== undefined) row.is_custom_name = c.isCustomName
  return sanitizeUuidFields(row)
}

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  loaded: false,

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
    if (error) { console.error('Failed to load cards:', error); return }
    set({ cards: (data || []).map(fromRow), loaded: true })
  },

  add: async (householdId, card) => {
    const usedColors = get().cards.map((c) => c.color)
    const newCard: CreditCard = {
      ...card,
      id: uuidv4(),
      color: card.color || nextColor(usedColors),
      isCustomName: card.isCustomName ?? false,
    }
    const { error } = await supabase.from('cards').insert(toRow(newCard, householdId))
    if (error) { console.error('Failed to add card:', error); throw error }
    set((s) => ({ cards: [newCard, ...s.cards] }))
    return newCard
  },

  update: async (id, patch) => {
    const { error } = await supabase.from('cards').update(toRow(patch)).eq('id', id)
    if (error) { console.error('Failed to update card:', error); return }
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) { console.error('Failed to remove card:', error); return }
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }))
  },

  getById: (id) => get().cards.find((c) => c.id === id),
}))
