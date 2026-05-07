import { TOUR_CURRENT_STEP_KEY, TOUR_DISMISSED_KEY, TOUR_HAS_SEEN_KEY } from '@/lib/onboardingTour'

export type OnboardingTourState = 'NOT_STARTED' | 'ACTIVE' | 'DISMISSED' | 'COMPLETED'

const TOUR_STATE_PREFIX = 'tribespend_onboarding_state'
const LOCAL_COMPLETION_PREFIX = 'tribespend_onboarding_completed'

export function getTourStateKey(profileId: string) {
  return `${TOUR_STATE_PREFIX}_${profileId}`
}

export function getLocalCompletionKey(profileId: string) {
  return `${LOCAL_COMPLETION_PREFIX}_${profileId}`
}

export function getStoredTourState(profileId: string): OnboardingTourState {
  const value = safeGetLocal(getTourStateKey(profileId))
  if (value === 'ACTIVE' || value === 'DISMISSED' || value === 'COMPLETED') return value
  return 'NOT_STARTED'
}

export function setStoredTourState(profileId: string, state: OnboardingTourState) {
  safeSetLocal(getTourStateKey(profileId), state)
}

export function clearOnboardingRuntimeState(profileId?: string) {
  safeRemoveLocal(TOUR_CURRENT_STEP_KEY)
  safeRemoveLocal(TOUR_DISMISSED_KEY)
  safeRemoveLocal(TOUR_HAS_SEEN_KEY)
  if (profileId) {
    safeRemoveLocal(getTourStateKey(profileId))
    safeRemoveLocal(getLocalCompletionKey(profileId))
  }
  safeRemoveSession(TOUR_CURRENT_STEP_KEY)
  safeRemoveSession(TOUR_DISMISSED_KEY)
  safeRemoveSession(TOUR_HAS_SEEN_KEY)
}

export function markOnboardingCompletedLocally(profileId: string) {
  safeSetLocal(getLocalCompletionKey(profileId), 'true')
  setStoredTourState(profileId, 'COMPLETED')
}

export function isTourResumable(state: OnboardingTourState) {
  return state === 'ACTIVE' || state === 'DISMISSED'
}

function safeGetLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures; Supabase profile state remains authoritative.
  }
}

function safeRemoveLocal(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage failures; Supabase profile state remains authoritative.
  }
}

function safeRemoveSession(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Ignore storage failures; Supabase profile state remains authoritative.
  }
}
