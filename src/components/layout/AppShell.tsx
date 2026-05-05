import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import GuidedTour from '@/components/onboarding/GuidedTour'
import { TOUR_CURRENT_STEP_KEY, TOUR_DISMISSED_KEY } from '@/lib/onboardingTour'
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
  const [, setOnboardingDismissed] = useState(false)
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false)
  const [showGuidedTour, setShowGuidedTour] = useState(false)
  const [guidedTourDismissed, setGuidedTourDismissed] = useState(false)
  const [tourNotice, setTourNotice] = useState<'skip' | 'finish' | null>(null)
  const autoSyncStartedRef = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()

  const { load: loadSettings } = useSettingsStore()
  const { transactions, load: loadTransactions } = useTransactionStore()
  const { load: loadCards } = useCardStore()
  const { load: loadPersons } = usePersonStore()
  const { load: loadRules } = useCategoryRuleStore()
  const { load: loadCategories } = useCategoryStore()
  const { load: loadRewards } = useCardRewardStore()
  const { load: loadCredits } = useCardCreditStore()
  const { load: loadBudgets } = useBudgetStore()

  useEffect(() => {
    setOnboardingDismissed(false)
    setShowOnboardingGuide(false)
    setShowGuidedTour(false)
    setGuidedTourDismissed(false)
    setTourNotice(null)
  }, [profile?.id])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('onboarding') === '1') {
      setOnboardingDismissed(false)
      setShowOnboardingGuide(true)
    }
    if (params.get('tour') === '1') {
      try {
        localStorage.setItem(TOUR_CURRENT_STEP_KEY, '0')
        localStorage.setItem(TOUR_DISMISSED_KEY, 'false')
      } catch (error) {
        console.warn('[GuidedTour] Unable to save tour step:', error)
      }
      setTourNotice(null)
      setShowOnboardingGuide(false)
      setGuidedTourDismissed(false)
      setShowGuidedTour(true)
      const next = new URLSearchParams(params)
      next.delete('tour')
      navigate(`${location.pathname}${next.toString() ? `?${next.toString()}` : ''}`, { replace: true })
    }
    if (params.get('tour') === 'resume') {
      try {
        localStorage.setItem(TOUR_DISMISSED_KEY, 'false')
      } catch (error) {
        console.warn('[GuidedTour] Unable to resume tour:', error)
      }
      setTourNotice(null)
      setShowOnboardingGuide(false)
      setGuidedTourDismissed(false)
      setShowGuidedTour(true)
      const next = new URLSearchParams(params)
      next.delete('tour')
      navigate(`${location.pathname}${next.toString() ? `?${next.toString()}` : ''}`, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

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

  const dismissOnboarding = useCallback((path?: string) => {
    setOnboardingDismissed(true)
    setShowOnboardingGuide(false)
    setShowGuidedTour(false)
    setGuidedTourDismissed(false)
    if (path) navigate(path)
    else if (location.search.includes('onboarding=1')) navigate(location.pathname, { replace: true })
  }, [location.pathname, location.search, navigate])

  const finishOnboarding = useCallback(async () => {
    const profileId = profile?.id
    const storageKey = profileId ? `tribespend_onboarding_completed_${profileId}` : null

    setOnboardingDismissed(true)
    setShowOnboardingGuide(false)
    setShowGuidedTour(false)
    setGuidedTourDismissed(false)
    try {
      localStorage.removeItem(TOUR_DISMISSED_KEY)
      localStorage.removeItem(TOUR_CURRENT_STEP_KEY)
    } catch (error) {
      console.warn('[GuidedTour] Unable to clear tour state:', error)
    }
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

    if (location.search.includes('onboarding=1')) {
      navigate(location.pathname, { replace: true })
    }
  }, [location.pathname, location.search, navigate, profile?.id, refreshProfile])

  const handleGuidedTourSkip = useCallback(() => {
    try {
      localStorage.setItem(TOUR_DISMISSED_KEY, 'true')
      localStorage.removeItem(TOUR_CURRENT_STEP_KEY)
    } catch (error) {
      console.warn('[GuidedTour] Unable to save dismissed state:', error)
    }
    setGuidedTourDismissed(true)
    setShowGuidedTour(false)
    setTourNotice('skip')
  }, [])

  const handleGuidedTourFinish = useCallback(async () => {
    try {
      localStorage.removeItem(TOUR_DISMISSED_KEY)
      localStorage.removeItem(TOUR_CURRENT_STEP_KEY)
    } catch (error) {
      console.warn('[GuidedTour] Unable to clear tour state:', error)
    }
    await finishOnboarding()
    setShowGuidedTour(false)
    setTourNotice('finish')
  }, [finishOnboarding])

  const shouldShowOnboarding =
    !!profile &&
    !showGuidedTour &&
    showOnboardingGuide

  useEffect(() => {
    if (!profile || shouldShowOnboarding || showGuidedTour) return
    try {
      const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === 'true'
      const savedStep = localStorage.getItem(TOUR_CURRENT_STEP_KEY)
      const completionKey = `tribespend_onboarding_completed_${profile.id}`
      const completedLocally = localStorage.getItem(completionKey) === 'true'
      const completed = profile.onboarding_completed === true || (profile.onboarding_completed !== false && completedLocally)
      if (!dismissed && (savedStep !== null || (!completed && !guidedTourDismissed))) {
        setShowGuidedTour(true)
      }
    } catch (error) {
      console.warn('[GuidedTour] Unable to read tour state:', error)
    }
  }, [guidedTourDismissed, profile, shouldShowOnboarding, showGuidedTour])

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
      {shouldShowOnboarding && (
        <OnboardingModal
          onDismiss={dismissOnboarding}
          onFinish={finishOnboarding}
          hasRealTransactions={transactions.length > 0}
        />
      )}
      <GuidedTour
        active={showGuidedTour}
        onSkip={handleGuidedTourSkip}
        onFinish={handleGuidedTourFinish}
      />
      {tourNotice && (
        <TourNoticeModal
          mode={tourNotice}
          onClose={() => setTourNotice(null)}
        />
      )}
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

function TourNoticeModal({
  mode,
  onClose,
}: {
  mode: 'skip' | 'finish'
  onClose: () => void
}) {
  const isSkip = mode === 'skip'

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
          {isSkip ? 'Guide paused' : 'Guide complete'}
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          {isSkip ? 'You can come back anytime' : 'You are all set'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {isSkip
            ? 'You can restart this guide anytime from Help & Support.'
            : 'You can review this guide anytime from Help & Support.'}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
          >
            {isSkip ? 'Got it' : 'Done'}
          </button>
        </div>
      </section>
    </div>
  )
}
