import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/layout/Layout'
import DashboardPage from '@/pages/DashboardPage'
import TransactionsPage from '@/pages/TransactionsPage'
import UploadPage from '@/pages/UploadPage'
import RecurringPage from '@/pages/RecurringPage'
import ReimbursementsPage from '@/pages/ReimbursementsPage'
import ReturnsPage from '@/pages/ReturnsPage'
import ExportPage from '@/pages/ExportPage'
import SettingsPage from '@/pages/SettingsPage'
import OptimizePage from '@/pages/OptimizePage'
import BudgetsPage from '@/pages/BudgetsPage'
import { useSettingsStore } from '@/stores/settingsStore'
import { useBudgetStore } from '@/stores/budgetStore'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'

export default function AppShell() {
  const { householdId } = useAuth()
  const [dataLoaded, setDataLoaded] = useState(false)

  const { load: loadSettings } = useSettingsStore()
  const { load: loadTransactions } = useTransactionStore()
  const { load: loadCards } = useCardStore()
  const { load: loadPersons } = usePersonStore()
  const { load: loadRules } = useCategoryRuleStore()
  const { load: loadRewards } = useCardRewardStore()
  const { load: loadCredits } = useCardCreditStore()
  const { load: loadBudgets } = useBudgetStore()

  useEffect(() => {
    if (!householdId) return

    setDataLoaded(false)
    Promise.all([
      loadSettings(),
      loadTransactions(householdId),
      loadCards(householdId),
      loadPersons(householdId),
      loadRules(householdId),
      loadRewards(householdId),
      loadCredits(householdId),
      loadBudgets(householdId),
    ]).then(() => setDataLoaded(true))
  }, [householdId])

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
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="reimbursements" element={<ReimbursementsPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="optimize" element={<OptimizePage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Layout>
  )
}
