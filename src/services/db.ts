/**
 * db.ts — Supabase replacement for Dexie
 *
 * The Dexie database class is removed. This file now provides:
 *   - exportAllData(householdId) — downloads all household data as JSON
 *   - importAllData(householdId, json) — bulk-upserts data into Supabase
 *   - Settings helpers (kept for backward compat, now use localStorage)
 */

import { supabase } from '@/lib/supabase'
import type { AppSettings } from '@/types'

// ─── Settings helpers (localStorage — no Supabase needed) ─────────────────

const SETTINGS_KEY = 'tribespend_settings'

export const defaultSettings: AppSettings = {
  anthropicApiKey: '',
  anthropicModel: 'claude-sonnet-4-20250514',
  onboardingComplete: false,
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
}

// ─── Export / Import (Supabase) ───────────────────────────────────────────

export async function exportAllData(householdId: string): Promise<string> {
  const tables = [
    'transactions', 'cards', 'people', 'card_reward_rules',
    'card_credits', 'category_rules',
  ] as const

  const results: Record<string, unknown[]> = {}

  await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('household_id', householdId)
      if (error) console.error(`Export error for ${table}:`, error)
      results[table] = data || []
    }),
  )

  return JSON.stringify(
    { ...results, exportDate: new Date().toISOString() },
    null,
    2,
  )
}

export async function importAllData(householdId: string, jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString)

  const tableMap: Record<string, string> = {
    transactions: 'transactions',
    cards: 'cards',
    people: 'people',
    persons: 'people', // backward compat with old Dexie exports
    card_reward_rules: 'card_reward_rules',
    cardRewardRules: 'card_reward_rules',
    card_credits: 'card_credits',
    cardCredits: 'card_credits',
    category_rules: 'category_rules',
    categoryRules: 'category_rules',
  }

  for (const [jsonKey, tableName] of Object.entries(tableMap)) {
    const rows = data[jsonKey]
    if (!Array.isArray(rows) || rows.length === 0) continue

    // Ensure every row has the correct household_id
    const withHousehold = rows.map((r: Record<string, unknown>) => ({
      ...r,
      household_id: householdId,
    }))

    const { error } = await supabase
      .from(tableName)
      .upsert(withHousehold, { onConflict: 'id' })

    if (error) {
      console.error(`Import error for ${tableName}:`, error)
    }
  }
}
