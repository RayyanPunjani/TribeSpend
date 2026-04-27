import { useState } from 'react'
import { Users, CreditCard, Database, Download, Upload, Link2, Trash2, AlertTriangle, Sparkles } from 'lucide-react'
import PeopleManager from '@/components/settings/PeopleManager'
import CardManager from '@/components/settings/CardManager'
import PlaidManager from '@/components/settings/PlaidManager'
import CardRewardsManager from '@/components/settings/CardRewardsManager'
import { exportAllData, importAllData } from '@/services/db'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getItems, disconnectItem } from '@/api/plaid'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCardStore } from '@/stores/cardStore'
import { usePersonStore } from '@/stores/personStore'
import { useCategoryRuleStore } from '@/stores/categoryRuleStore'
import { useCardRewardStore } from '@/stores/cardRewardStore'
import { useCardCreditStore } from '@/stores/cardCreditStore'

type Tab = 'people' | 'plaid' | 'cards' | 'rewards' | 'data'

const TABS = [
  { id: 'people' as Tab,  label: 'People',             icon: Users },
  { id: 'plaid' as Tab,   label: 'Connected Accounts', icon: Link2 },
  { id: 'cards' as Tab,   label: 'Cards',              icon: CreditCard },
  { id: 'rewards' as Tab, label: 'Card Rewards',       icon: Sparkles },
  { id: 'data' as Tab,    label: 'Data & Backup',      icon: Database },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('people')

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
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
        {tab === 'plaid' && (
          <>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Connected Bank Accounts</h3>
            <PlaidManager />
          </>
        )}
        {tab === 'people' && <PeopleManager />}
        {tab === 'cards' && <CardManager />}
        {tab === 'rewards' && <CardRewardsManager />}
        {tab === 'data' && <DataBackup />}
      </div>
    </div>
  )
}

function DataBackup() {
  const { householdId } = useAuth()
  const { transactions, load: loadTransactions } = useTransactionStore()
  const { load: loadCards } = useCardStore()
  const { load: loadPersons } = usePersonStore()
  const { load: loadRules } = useCategoryRuleStore()
  const { load: loadRewards } = useCardRewardStore()
  const { load: loadCredits } = useCardCreditStore()
  const [importing, setImporting] = useState(false)
  const [dangerModal, setDangerModal] = useState<'transactions' | 'reset' | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isWorking, setIsWorking] = useState(false)

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

  const handleResetEverything = async () => {
    setIsWorking(true)
    try {
      try {
        const items = await getItems()
        await Promise.all(items.map((it) => disconnectItem(it.id).catch(() => {})))
      } catch {
        // Server may not be running
      }

      // Delete all household data from Supabase
      const tables = [
        'transactions', 'card_credits', 'card_reward_rules',
        'category_rules', 'plaid_account_mappings', 'plaid_items',
        'cards', 'people',
      ]
      for (const table of tables) {
        await supabase.from(table).delete().eq('household_id', hid)
      }
      localStorage.removeItem('tribespend_settings')
      window.location.reload()
    } finally {
      setIsWorking(false)
      setConfirmText('')
    }
  }

  const closeModal = () => {
    setDangerModal(null)
    setConfirmText('')
  }

  return (
    <>
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

        {/* ── Danger Zone ────────────────────────────────────────────────────── */}
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
                <p className="text-sm font-medium text-slate-800">Reset Everything</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Erase all data — transactions, cards, people, rules, and settings.
                </p>
              </div>
              <button
                onClick={() => setDangerModal('reset')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <AlertTriangle size={13} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation modals ──────────────────────────────────────────────── */}
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
                  <h3 className="text-base font-semibold text-slate-800">Reset Everything</h3>
                </div>
                <p className="text-sm text-slate-500">
                  This will erase all data and reset TribeSpend to a fresh install.
                  This cannot be undone.
                </p>
                <p className="text-sm text-slate-500">
                  Type <strong className="text-slate-700 font-mono">RESET</strong> to confirm.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET"
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
                    onClick={handleResetEverything}
                    disabled={confirmText !== 'RESET' || isWorking}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    {isWorking ? 'Resetting…' : 'Reset Everything'}
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
