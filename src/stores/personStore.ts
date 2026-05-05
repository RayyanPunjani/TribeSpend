import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Person } from '@/types'
import { supabase } from '@/lib/supabase'
import { nextColor } from '@/utils/colors'
import { nullableUuid } from '@/utils/uuid'

interface PersonState {
  persons: Person[]
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, name: string, color?: string) => Promise<Person>
  update: (id: string, patch: Partial<Person>) => Promise<void>
  remove: (id: string) => Promise<void>
  addCardToPerson: (personId: string, cardId: string) => Promise<void>
  removeCardFromPerson: (personId: string, cardId: string) => Promise<void>
}

/*
  The Dexie Person model stores a `cards: string[]` array inline.
  Supabase `people` table doesn't have that column — the card→person
  relationship lives in cards.person_id. But the rest of the app expects
  person.cards to exist, so we hydrate it at load time by querying cards.
*/

export const usePersonStore = create<PersonState>((set, get) => ({
  persons: [],
  loaded: false,

  load: async (householdId) => {
    const [{ data: people, error: pErr }, { data: cards, error: cErr }] = await Promise.all([
      supabase.from('people').select('*').eq('household_id', householdId),
      supabase.from('cards').select('id, person_id').eq('household_id', householdId),
    ])
    if (pErr) { console.error('Failed to load people:', pErr); return }
    if (cErr) { console.error('Failed to load cards for people:', cErr); return }

    // Build person_id → card_id[] map
    const cardsByPerson: Record<string, string[]> = {}
    for (const c of cards || []) {
      const pid = c.person_id as string
      if (pid) {
        if (!cardsByPerson[pid]) cardsByPerson[pid] = []
        cardsByPerson[pid].push(c.id as string)
      }
    }

    const persons: Person[] = (people || []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      color: (r.color as string) || '#14b8a6',
      cards: cardsByPerson[r.id as string] || [],
    }))

    set({ persons, loaded: true })
  },

  add: async (householdId, name, color) => {
    const usedColors = get().persons.map((p) => p.color)
    const newPerson: Person = {
      id: uuidv4(),
      name,
      color: color || nextColor(usedColors),
      cards: [],
    }
    const { error } = await supabase.from('people').insert({
      id: newPerson.id,
      household_id: nullableUuid(householdId),
      name: newPerson.name,
      color: newPerson.color,
    })
    if (error) { console.error('Failed to add person:', error); throw error }
    set((s) => ({ persons: [...s.persons, newPerson] }))
    return newPerson
  },

  update: async (id, patch) => {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.color !== undefined) row.color = patch.color
    if (Object.keys(row).length > 0) {
      const { error } = await supabase.from('people').update(row).eq('id', id)
      if (error) { console.error('Failed to update person:', error); return }
    }
    set((s) => ({
      persons: s.persons.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('people').delete().eq('id', id)
    if (error) { console.error('Failed to remove person:', error); return }
    set((s) => ({ persons: s.persons.filter((p) => p.id !== id) }))
  },

  addCardToPerson: async (personId, cardId) => {
    // Update the card's person_id in the cards table
    const { error } = await supabase.from('cards').update({ person_id: nullableUuid(personId) }).eq('id', cardId)
    if (error) { console.error('Failed to assign card to person:', error); return }
    set((s) => ({
      persons: s.persons.map((p) =>
        p.id === personId ? { ...p, cards: [...new Set([...p.cards, cardId])] } : p,
      ),
    }))
  },

  removeCardFromPerson: async (personId, cardId) => {
    const { error } = await supabase.from('cards').update({ person_id: null }).eq('id', cardId)
    if (error) { console.error('Failed to unassign card from person:', error); return }
    set((s) => ({
      persons: s.persons.map((p) =>
        p.id === personId ? { ...p, cards: p.cards.filter((c) => c !== cardId) } : p,
      ),
    }))
  },
}))
