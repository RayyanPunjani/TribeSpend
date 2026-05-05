import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { CATEGORIES, CATEGORY_COLORS } from '@/utils/categories'
import { supabase } from '@/lib/supabase'
import { nullableUuid, sanitizeUuidFields } from '@/utils/uuid'

export interface HouseholdCategory {
  id: string
  householdId: string
  name: string
  parentCategory?: string
  color?: string
  icon?: string
  archived: boolean
  createdAt: string
}

interface CategoryState {
  categories: HouseholdCategory[]
  categoryNames: string[]
  categoryColors: Record<string, string>
  categoryParentMap: Record<string, string>
  loaded: boolean
  load: (householdId: string) => Promise<void>
  add: (householdId: string, category: { name: string; parentCategory?: string; color?: string; icon?: string }) => Promise<HouseholdCategory>
  update: (id: string, patch: Partial<Pick<HouseholdCategory, 'name' | 'parentCategory' | 'color' | 'icon' | 'archived'>>) => Promise<boolean>
  archive: (id: string) => Promise<boolean>
  archiveName: (householdId: string, name: string) => Promise<boolean>
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  return names.filter((name) => {
    const key = name.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildCategoryNames(categories: HouseholdCategory[]): string[] {
  const archivedDefaults = new Set(
    categories
      .filter((category) => category.archived)
      .map((category) => category.name.toLowerCase()),
  )
  return uniqueNames([
    ...CATEGORIES.filter((category) => !archivedDefaults.has(category.toLowerCase())),
    ...categories
      .filter((category) => !category.archived)
      .map((category) => category.name),
  ]).sort((a, b) => a.localeCompare(b))
}

function buildCategoryColors(categories: HouseholdCategory[]): Record<string, string> {
  const colors: Record<string, string> = { ...CATEGORY_COLORS }
  for (const category of categories) {
    if (category.archived) continue
    colors[category.name] = category.color || colors[category.name] || '#94a3b8'
  }
  return colors
}

function buildCategoryParentMap(categories: HouseholdCategory[]): Record<string, string> {
  const parentMap: Record<string, string> = {}
  for (const category of CATEGORIES) parentMap[category] = category
  for (const category of categories) {
    if (category.parentCategory) parentMap[category.name] = category.parentCategory
  }
  return parentMap
}

export function resolveRewardCategory(category: string, parentMap: Record<string, string>): string {
  return parentMap[category] || category
}

function fromRow(row: Record<string, unknown>): HouseholdCategory {
  return {
    id: row.id as string,
    householdId: row.household_id as string,
    name: row.name as string,
    parentCategory: row.parent_category as string | undefined,
    color: row.color as string | undefined,
    icon: row.icon as string | undefined,
    archived: (row.archived as boolean) || false,
    createdAt: row.created_at as string,
  }
}

function toRow(category: Partial<HouseholdCategory>, householdId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (householdId !== undefined) row.household_id = nullableUuid(householdId)
  if (category.id !== undefined) row.id = category.id
  if (category.name !== undefined) row.name = category.name
  if (category.parentCategory !== undefined) row.parent_category = category.parentCategory || null
  if (category.color !== undefined) row.color = category.color || null
  if (category.icon !== undefined) row.icon = category.icon || null
  if (category.archived !== undefined) row.archived = category.archived
  if (category.createdAt !== undefined) row.created_at = category.createdAt
  row.updated_at = new Date().toISOString()
  return sanitizeUuidFields(row)
}

function nextState(categories: HouseholdCategory[]) {
  return {
    categories,
    categoryNames: buildCategoryNames(categories),
    categoryColors: buildCategoryColors(categories),
    categoryParentMap: buildCategoryParentMap(categories),
    loaded: true,
  }
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  categoryNames: buildCategoryNames([]),
  categoryColors: buildCategoryColors([]),
  categoryParentMap: buildCategoryParentMap([]),
  loaded: false,

  load: async (householdId) => {
    const { data, error } = await supabase
      .from('household_categories')
      .select('*')
      .eq('household_id', householdId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to load household categories:', error)
      set({ loaded: true })
      return
    }

    set(nextState((data || []).map(fromRow)))
  },

  add: async (householdId, category) => {
    const name = category.name.trim()
    if (!name) throw new Error('Category name is required')

    const newCategory: HouseholdCategory = {
      id: uuidv4(),
      householdId,
      name,
      parentCategory: category.parentCategory || undefined,
      color: category.color || '#94a3b8',
      icon: category.icon || undefined,
      archived: false,
      createdAt: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('household_categories')
      .insert(toRow(newCategory, householdId))

    if (error) {
      console.error('Failed to add household category:', error)
      throw error
    }

    const categories = [...get().categories, newCategory].sort((a, b) => a.name.localeCompare(b.name))
    set(nextState(categories))
    return newCategory
  },

  update: async (id, patch) => {
    const row = toRow({
      ...patch,
      name: patch.name?.trim(),
    })
    const { error } = await supabase.from('household_categories').update(row).eq('id', id)
    if (error) {
      console.error('Failed to update household category:', error)
      return false
    }
    const categories = get().categories
      .map((category) => (category.id === id ? { ...category, ...patch, name: patch.name?.trim() ?? category.name } : category))
      .sort((a, b) => a.name.localeCompare(b.name))
    set(nextState(categories))
    return true
  },

  archive: async (id) => get().update(id, { archived: true }),

  archiveName: async (householdId, name) => {
    const existing = get().categories.find((category) => category.name.toLowerCase() === name.toLowerCase())
    if (existing) return get().update(existing.id, { archived: true })

    const category: HouseholdCategory = {
      id: uuidv4(),
      householdId,
      name,
      parentCategory: CATEGORIES.includes(name as (typeof CATEGORIES)[number]) ? name : undefined,
      color: CATEGORY_COLORS[name] || '#94a3b8',
      archived: true,
      createdAt: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('household_categories')
      .insert(toRow(category, householdId))

    if (error) {
      console.error('Failed to archive default category:', error)
      return false
    }

    const categories = [...get().categories, category].sort((a, b) => a.name.localeCompare(b.name))
    set(nextState(categories))
    return true
  },
}))
