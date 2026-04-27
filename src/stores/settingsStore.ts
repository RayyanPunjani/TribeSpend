import { create } from 'zustand'
import type { AppSettings } from '@/types'

/*
  Settings are now lightweight — the Anthropic API key and model fields
  are kept for backward compatibility but the AI categorization is disabled
  in the UI. The onboarding flag can live in local state or the profile.

  Since settings are simple and don't need server persistence (no sensitive
  data, no multi-device sync needed), we use localStorage as a simple
  key-value store. This avoids needing a separate Supabase table.
*/

const STORAGE_KEY = 'tribespend_settings'

export const defaultSettings: AppSettings = {
  anthropicApiKey: '',
  anthropicModel: 'claude-sonnet-4-20250514',
  onboardingComplete: false,
}

function readLocal(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

function writeLocal(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  completeOnboarding: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...defaultSettings },
  loaded: false,

  load: async () => {
    const settings = readLocal()
    set({ settings, loaded: true })
  },

  update: async (patch) => {
    const current = get().settings
    const updated = { ...current, ...patch }
    set({ settings: updated })
    writeLocal(updated)
  },

  completeOnboarding: async () => {
    await get().update({ onboardingComplete: true })
  },
}))
