import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getItems, syncTransactions } from '@/api/plaid'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import DashboardPage from '@/pages/DashboardPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import TransactionsPage from '@/pages/TransactionsPage'
import UploadPage from '@/pages/UploadPage'
import RecurringPage from '@/pages/RecurringPage'
import ReimbursementsPage from '@/pages/ReimbursementsPage'
import ReturnsPage from '@/pages/ReturnsPage'
import SettingsPage from '@/pages/SettingsPage'
import WalletPage from '@/pages/WalletPage'
import OptimizePage from '@/pages/OptimizePage'
import BudgetsPage from '@/pages/BudgetsPage'
import HelpSupportPage from '@/pages/HelpSupportPage'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import { useSettingsStore } from '@/stores/settingsStore'
import { useBudgetStore } from '@/stores/budgetStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'

const STORE_LOAD_TIMEOUT_MS = 8000
const PLAID_AUTO_SYNC_THROTTLE_MS = 15 * 60 * 1000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[AppShell] ${label} load timed out after ${ms}ms`)
      resolve(null)
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

export default function AppShell() {
  const { householdId, profile, refreshProfile } = useAuth()
  const [dataLoaded, setDataLoaded] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const autoSyncStartedRef = useRef(false)
  const navigate = useNavigate()

  const { load: loadSettings } = useSettingsStore()
  const { load: loadTransactions } = useTransactionStore()
  const { load: loadCards } = useCardStore()
  const { load: loadPersons } = usePersonStore()
  const { load: loadRules } = useCategoryRuleStore()
  const { load: loadCategories } = useCategoryStore()
  const { load: loadRewards } = useCardRewardStore()
  const { load: loadCredits } = useCardCreditStore()
  const { load: loadBudgets } = useBudgetStore()

  useEffect(() => {
    setOnboardingDismissed(false)
  }, [profile?.id])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false

    setDataLoaded(false)
    const loaders = [
      ['settings', () => loadSettings()],
      ['transactions', () => loadTransactions(householdId)],
      ['cards', () => loadCards(householdId)],
      ['people', () => loadPersons(householdId)],
      ['categories', () => loadCategories(householdId)],
      ['category rules', () => loadRules(householdId)],
      ['reward rules', () => loadRewards(householdId)],
      ['card credits', () => loadCredits(householdId)],
      ['budgets', () => loadBudgets(householdId)],
    ] as const

    Promise.allSettled(
      loaders.map(([name, load]) =>
        withTimeout(
          Promise.resolve().then(load),
          STORE_LOAD_TIMEOUT_MS,
          name,
        ),
      ),
    )
      .then((results) => {
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.warn(`[AppShell] Failed to load ${loaders[i][0]}:`, result.reason)
          }
        })
      })
      .finally(() => {
        if (!cancelled) setDataLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [householdId])

  useEffect(() => {
    if (!householdId || !dataLoaded || profile?.plaid_access_enabled !== true || autoSyncStartedRef.current) return
    autoSyncStartedRef.current = true

    const storageKey = `tribespend_plaid_auto_sync_at_${householdId}`
    const now = Date.now()
    const lastSyncAt = Number(localStorage.getItem(storageKey) || 0)
    if (lastSyncAt && now - lastSyncAt < PLAID_AUTO_SYNC_THROTTLE_MS) return

    void (async () => {
      try {
        const items = await getItems()
        if (items.length === 0) return

        localStorage.setItem(storageKey, String(Date.now()))
        const result = await syncTransactions()
        if (result.transactions.length > 0) {
          await loadTransactions(householdId)
        }
      } catch (error) {
        console.warn('[AppShell] Plaid auto-sync failed:', error)
      }
    })()
  }, [householdId, dataLoaded, profile?.plaid_access_enabled, loadTransactions])

  const completeOnboarding = useCallback(async (path?: string) => {
    const profileId = profile?.id
    const storageKey = profileId ? `tribespend_onboarding_completed_${profileId}` : null

    setOnboardingDismissed(true)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'true')
      } catch (error) {
        console.warn('[Onboarding] Unable to save local completion flag:', error)
      }
    }

    if (profileId) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', profileId)

        if (error) {
          console.warn('[Onboarding] Failed to save profile completion flag; using local fallback:', error.message)
        } else {
          await refreshProfile()
        }
      } catch (error) {
        console.warn('[Onboarding] Failed to save profile completion flag; using local fallback:', error)
      }
    }

    if (path) navigate(path)
  }, [navigate, profile?.id, refreshProfile])

  const onboardingStorageKey = profile?.id ? `tribespend_onboarding_completed_${profile.id}` : null
  const onboardingCompletedLocally = (() => {
    if (!onboardingStorageKey) return false
    try {
      return localStorage.getItem(onboardingStorageKey) === 'true'
    } catch {
      return false
    }
  })()
  const shouldShowOnboarding =
    !!profile &&
    profile.onboarding_completed !== true &&
    !onboardingDismissed &&
    !onboardingCompletedLocally

  if (!householdId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-500 max-w-md px-6">
          <p className="text-lg font-medium text-slate-700 mb-2">Unable to load your profile</p>
          <p className="text-sm mb-4">This could be a temporary issue. Try signing out and back in.</p>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login' }}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
          >
            Sign Out & Retry
          </button>
        </div>
      </div>
    )
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin mx-auto mb-3" />
          <span className="text-sm">Loading your data…</span>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      {shouldShowOnboarding && <OnboardingModal onComplete={completeOnboarding} />}
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="insights" element={<Navigate to="/app/analytics" replace />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="reimbursements" element={<ReimbursementsPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="optimize" element={<OptimizePage />} />
        <Route path="export" element={<Navigate to="/app/settings?tab=export" replace />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="accounts" element={<Navigate to="/app/wallet" replace />} />
        <Route path="cards" element={<Navigate to="/app/wallet" replace />} />
        <Route path="billing" element={<Navigate to="/app/settings?tab=billing" replace />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpSupportPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Layout>
  )
}
