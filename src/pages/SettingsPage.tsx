import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Crown, Database, Download, FileText, KeyRound, Loader2, LogOut, Sparkles, Table, Trash2, Upload, UserCircle, DollarSign, Tags } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exportAllData, importAllData } from '@/services/db'
import { exportToCSV, exportToExcel, exportReimbursementReport } from '@/services/exportService'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getItems, removeAllPlaidConnections } from '@/api/plaid'
import { useTransactionStore, applyFilters } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'
import CategoriesManager from '@/components/settings/CategoriesManager'

type Tab = 'profile' | 'categories' | 'billing' | 'export'

const TABS = [
  { id: 'profile' as Tab,     label: 'Profile',     icon: UserCircle },
  { id: 'categories' as Tab,  label: 'Categories',  icon: Tags },
  { id: 'billing' as Tab,     label: 'Billing',     icon: Crown },
  { id: 'export' as Tab,      label: 'Export',      icon: Database },
]

function isTab(value: string | null): value is Tab {
  return value === 'profile' || value === 'categories' || value === 'billing' || value === 'export'
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const tabParam = searchParams.get('tab')
  const initialTab = isTab(tabParam) ? tabParam : 'profile'
  const [tab, setTab] = useState<Tab>(initialTab)
  const { user, profile, householdId } = useAuth()

  useEffect(() => {
    const nextTab = searchParams.get('tab')
    setTab(isTab(nextTab) ? nextTab : 'profile')
  }, [searchParams])

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab)
    setSearchParams(nextTab === 'profile' ? {} : { tab: nextTab })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {tab === 'profile' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-slate-700">Profile</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{ backgroundColor: profile?.color || '#14b8a6' }}
              >
                {(profile?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{profile?.name || 'Account'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</p>
                <p className="text-sm font-medium text-slate-800 mt-1 capitalize">{profile?.role || 'member'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Household</p>
                <p className="text-sm font-medium text-slate-800 mt-1 truncate">{householdId || 'Not loaded'}</p>
              </div>
            </div>
            <AccountSection onLoggedOut={() => navigate('/login', { replace: true })} />
            <DangerZone />
          </div>
        )}
        {tab === 'categories' && <CategoriesManager />}
        {tab === 'billing' && <BillingSettings />}
        {tab === 'export' && <ExportSettings />}
      </div>
    </div>
  )
}

function isPremiumStatus(status?: string | null): boolean {
  return status === 'active' || status === 'trialing'
}

function formatPeriodEnd(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function AccountSection({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { user, signOut } = useAuth()
  const [resetLoading, setResetLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChangePassword = async () => {
    setResetLoading(true)
    setMessage(null)
    setError(null)
    try {
      if (!user?.email) throw new Error('No account email is available for password reset.')
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) throw resetError
      setMessage('Password reset email sent. Check your inbox for the next step.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send password reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  const handleLogOut = async () => {
    setLogoutLoading(true)
    setMessage(null)
    setError(null)
    try {
      await signOut()
      onLoggedOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log out.')
      setLogoutLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Account</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Change Password</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a secure password reset link to {user?.email || 'your account email'}.
            </p>
          </div>
          <button
            onClick={handleChangePassword}
            disabled={resetLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            {resetLoading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
            {resetLoading ? 'Sending...' : 'Change Password'}
          </button>
        </div>

        <div className="border-t border-slate-100" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Log Out</p>
            <p className="text-xs text-slate-500 mt-0.5">Sign out of TribeSpend on this device.</p>
          </div>
          <button
            onClick={handleLogOut}
            disabled={logoutLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            {logoutLoading ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            {logoutLoading ? 'Logging out...' : 'Log Out'}
          </button>
        </div>

        {message && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-700">
            <CheckCircle size={14} className="shrink-0" />
            {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}
      </div>
    </section>
  )
}

function BillingSettings() {
  const { profile } = useAuth()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPremium = profile?.plaid_access_enabled === true || isPremiumStatus(profile?.subscription_status)
  const canManageSubscription = hasPremium && !!profile?.stripe_customer_id
  const statusLabel = profile?.subscription_status
    ? profile.subscription_status.replace(/_/g, ' ')
    : 'free'
  const periodEnd = formatPeriodEnd(profile?.subscription_current_period_end)

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Please sign in again before upgrading.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Checkout is not configured. Missing Supabase settings.')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      })

      const checkoutData = await response.json().catch(() => ({})) as { url?: string; error?: string }
      if (!response.ok) throw new Error(checkoutData.error || `Checkout failed (${response.status})`)
      if (!checkoutData.url) throw new Error('Checkout session did not return a Stripe URL.')

      window.location.href = checkoutData.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.')
      setCheckoutLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Please sign in again before managing your subscription.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Billing portal is not configured. Missing Supabase settings.')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      })

      const portalData = await response.json().catch(() => ({})) as { url?: string; error?: string }
      if (!response.ok) throw new Error(portalData.error || `Billing portal failed (${response.status})`)
      if (!portalData.url) throw new Error('Billing portal did not return a Stripe URL.')

      window.location.href = portalData.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open billing portal.')
      setPortalLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Billing</h3>
          <p className="text-sm text-slate-500 mt-1">
            Unlock automatic bank syncing with Premium — $4.99/month.
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            hasPremium
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {hasPremium ? 'Premium' : statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subscription Status</p>
          <p className="text-sm font-medium text-slate-800 mt-1 capitalize">{statusLabel}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Plaid Access</p>
          <p className="text-sm font-medium text-slate-800 mt-1">{profile?.plaid_access_enabled ? 'Enabled' : 'Not enabled'}</p>
        </div>
      </div>

      {periodEnd && (
        <p className="text-sm text-slate-500">
          Current period ends <span className="font-medium text-slate-700">{periodEnd}</span>.
        </p>
      )}

      {!canManageSubscription && (
        <button
          onClick={handleUpgrade}
          disabled={checkoutLoading}
          className="w-fit flex items-center justify-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-60"
        >
          {checkoutLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {checkoutLoading ? 'Opening Checkout...' : 'Upgrade to Premium'}
        </button>
      )}

      {canManageSubscription && (
        <button
          onClick={handleManageSubscription}
          disabled={portalLoading}
          className="w-fit flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
          {portalLoading ? 'Opening Portal...' : 'Manage Subscription'}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

function ExportSettings() {
  const { transactions, filters } = useTransactionStore()
  const { cards } = useCardStore()
  const { persons } = usePersonStore()
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  const filteredTransactions = applyFilters(transactions, filters)
  const rangeFiltered = transactions.filter((t) => {
    if (dateStart && t.transDate < dateStart) return false
    if (dateEnd && t.transDate > dateEnd) return false
    return true
  })

  const exports = [
    {
      icon: <Table size={20} className="text-accent-600" />,
      title: 'All Transactions (CSV)',
      description: `Export all ${transactions.length} transactions as a CSV file`,
      action: () => exportToCSV(transactions, cards, persons, 'tribespend-all.csv'),
    },
    {
      icon: <FileText size={20} className="text-blue-600" />,
      title: 'All Transactions (Excel)',
      description: `Export all ${transactions.length} transactions as an Excel file`,
      action: () => exportToExcel(transactions, cards, persons, 'tribespend-all.xlsx'),
    },
    {
      icon: <Table size={20} className="text-green-600" />,
      title: 'Current Filtered View (CSV)',
      description: `Export the currently filtered view — ${filteredTransactions.length} transactions`,
      action: () => exportToCSV(filteredTransactions, cards, persons, 'tribespend-filtered.csv'),
    },
    {
      icon: <FileText size={20} className="text-purple-600" />,
      title: 'Current Filtered View (Excel)',
      description: `Export the currently filtered view — ${filteredTransactions.length} transactions`,
      action: () => exportToExcel(filteredTransactions, cards, persons, 'tribespend-filtered.xlsx'),
    },
    {
      icon: <DollarSign size={20} className="text-orange-600" />,
      title: 'Reimbursement Report (Excel)',
      description: 'Export a detailed reimbursement report grouped by person',
      action: () => exportReimbursementReport(transactions, cards, persons),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Export</h3>
        <p className="text-sm text-slate-500 mt-1">
          Download transaction reports or back up household data.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {exports.map((exp, i) => (
          <button
            key={i}
            onClick={exp.action}
            disabled={transactions.length === 0}
            className="flex items-center gap-4 border border-slate-200 rounded-xl px-5 py-4 hover:border-slate-300 hover:shadow-card transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              {exp.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{exp.title}</p>
              <p className="text-xs text-slate-500">{exp.description}</p>
            </div>
            <Download size={15} className="text-slate-400 shrink-0" />
          </button>
        ))}
      </div>

      <div className="border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-700">Export by Date Range</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToCSV(rangeFiltered, cards, persons, 'tribespend-range.csv')}
            disabled={rangeFiltered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            <Download size={14} /> CSV ({rangeFiltered.length})
          </button>
          <button
            onClick={() => exportToExcel(rangeFiltered, cards, persons, 'tribespend-range.xlsx')}
            disabled={rangeFiltered.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      <DataBackup />
    </div>
  )
}

function DataBackup() {
  const { householdId } = useAuth()
  const { load: loadTransactions } = useTransactionStore()
  const { load: loadCards } = useCardStore()
  const { load: loadPersons } = usePersonStore()
  const { load: loadRules } = useCategoryRuleStore()
  const { load: loadRewards } = useCardRewardStore()
  const { load: loadCredits } = useCardCreditStore()
  const [importing, setImporting] = useState(false)

  const hid = householdId!

  const reloadAll = async () => {
    await Promise.all([
      loadTransactions(hid), loadCards(hid), loadPersons(hid),
      loadRules(hid), loadRewards(hid), loadCredits(hid),
    ])
  }

  const handleExport = async () => {
    const json = await exportAllData(hid)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tribespend-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        await importAllData(hid, ev.target?.result as string)
        await reloadAll()
        alert('Data imported successfully!')
      } catch (err) {
        alert('Import failed: ' + String(err))
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-700">Data Backup & Restore</h3>
      <p className="text-sm text-slate-500">
        All data is stored securely in the cloud. Export a backup regularly
        as an extra precaution.
      </p>

      <div className="flex gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
        >
          <Download size={15} />
          Export All Data
        </button>

        <label className={`flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer ${importing ? 'opacity-50' : ''}`}>
          <Upload size={15} />
          {importing ? 'Importing...' : 'Import Backup'}
          <input type="file" accept=".json" className="hidden" onChange={handleImport} disabled={importing} />
        </label>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        Importing a backup will merge with existing data. It will not delete existing records.
      </div>
    </div>
  )
}

function DangerZone() {
  const { householdId, signOut } = useAuth()
  const { transactions, load: loadTransactions } = useTransactionStore()
  const [dangerModal, setDangerModal] = useState<'transactions' | 'account' | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [dangerError, setDangerError] = useState<string | null>(null)

  const hid = householdId!

  const handleDeleteTransactions = async () => {
    setIsWorking(true)
    try {
      await supabase.from('transactions').delete().eq('household_id', hid)
      await loadTransactions(hid)
      setDangerModal(null)
    } finally {
      setIsWorking(false)
      setConfirmText('')
    }
  }

  const handleDeleteAccount = async () => {
    setIsWorking(true)
    setDangerError(null)
    try {
      let hadPlaidConnections = false
      try {
        hadPlaidConnections = (await getItems()).length > 0
      } catch {
        // Non-premium users or offline Plaid server may not be able to list items.
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Please sign in again before deleting your account.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Account deletion is not configured. Missing Supabase settings.')
      }

      const callDeleteFunction = async (phase: 'prepare' | 'finalize') => {
        const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phase }),
        })

        const result = await response.json().catch(() => ({})) as { error?: string }
        if (!response.ok) {
          throw new Error(result.error || 'Unable to delete account.')
        }
      }

      await callDeleteFunction('prepare')

      try {
        await removeAllPlaidConnections()
      } catch {
        if (hadPlaidConnections) {
          throw new Error("We couldn't remove your linked bank connections. Please try again or contact support.")
        }
      }

      await callDeleteFunction('finalize')

      localStorage.removeItem('tribespend_settings')
      await signOut()
      window.location.href = '/login'
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : 'Unable to delete account.')
    } finally {
      setIsWorking(false)
      setConfirmText('')
    }
  }

  const closeModal = () => {
    setDangerModal(null)
    setConfirmText('')
    setDangerError(null)
  }

  return (
    <>
      <div className="mt-4 rounded-xl border border-red-200 overflow-hidden">
        <div className="bg-red-50 px-4 py-2.5 border-b border-red-100">
          <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Danger Zone</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Delete All Transactions</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Remove all {transactions.length} transactions. Cards, people, and category rules are kept.
              </p>
            </div>
            <button
              onClick={() => setDangerModal('transactions')}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>

          <div className="border-t border-red-100" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Delete Account</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently deactivate your account, cancel active subscriptions, remove Plaid links, and delete app data.
              </p>
            </div>
            <button
              onClick={() => setDangerModal('account')}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <AlertTriangle size={13} />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {dangerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            {dangerModal === 'transactions' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Delete All Transactions</h3>
                </div>
                <p className="text-sm text-slate-500">
                  This will permanently delete all{' '}
                  <strong className="text-slate-700">{transactions.length} transactions</strong>.
                  Your cards, people, and category rules will be kept.
                </p>
                <p className="text-sm text-slate-500">
                  Type <strong className="text-slate-700 font-mono">DELETE</strong> to confirm.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteTransactions}
                    disabled={confirmText !== 'DELETE' || isWorking}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    {isWorking ? 'Deleting…' : 'Delete Transactions'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-red-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Delete Account</h3>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  This is permanent. If you have an active Stripe subscription, TribeSpend will cancel it first.
                  If cancellation fails, account deletion will stop.
                </div>
                <div className="text-sm text-slate-500">
                  <p className="mb-2">This will permanently delete or deactivate:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>profile/account data</li>
                    <li>transactions</li>
                    <li>budgets</li>
                    <li>recurring items</li>
                    <li>reimbursements</li>
                    <li>returns/refunds</li>
                    <li>linked Plaid connections</li>
                    <li>cards/payment methods</li>
                  </ul>
                </div>
                <p className="text-sm text-slate-500">
                  Type <strong className="text-slate-700 font-mono">DELETE</strong> to confirm.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                {dangerError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {dangerError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={confirmText !== 'DELETE' || isWorking}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    {isWorking ? 'Deleting…' : 'Delete Account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
