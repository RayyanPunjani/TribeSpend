import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Link2, Sparkles, Users, Wallet } from 'lucide-react'
import PeopleManager from '@/components/settings/PeopleManager'
import PlaidManager from '@/components/settings/PlaidManager'
import CardManager from '@/components/settings/CardManager'
import CardRewardsManager from '@/components/settings/CardRewardsManager'

type WalletTab = 'people' | 'linkedAccounts' | 'paymentMethods' | 'cardRewards'

const TABS = [
  { id: 'people' as WalletTab, label: 'People', icon: Users },
  { id: 'linkedAccounts' as WalletTab, label: 'Linked Accounts', icon: Link2 },
  { id: 'paymentMethods' as WalletTab, label: 'Payment Methods', icon: CreditCard },
  { id: 'cardRewards' as WalletTab, label: 'Card Rewards', icon: Sparkles },
]

function isWalletTab(value: string | null): value is WalletTab {
  return value === 'people' || value === 'linkedAccounts' || value === 'paymentMethods' || value === 'cardRewards'
}

export default function WalletPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState<WalletTab>(isWalletTab(requestedTab) ? requestedTab : 'people')

  useEffect(() => {
    if (isWalletTab(requestedTab)) setTab(requestedTab)
  }, [requestedTab])

  const selectTab = (nextTab: WalletTab) => {
    setTab(nextTab)
    setSearchParams(nextTab === 'people' ? {} : { tab: nextTab })
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
          <Wallet size={20} className="text-accent-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Wallet</h1>
          <p className="text-sm text-slate-500 mt-1">Manage people, linked bank accounts, cards, and rewards.</p>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => selectTab(id)}
            className={`flex min-w-[150px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-1 ${
              tab === id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
        </div>
      </div>

      <section data-tour="wallet-section" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">
          {TABS.find((item) => item.id === tab)?.label}
        </h2>
        {tab === 'people' && <PeopleManager />}
        {tab === 'linkedAccounts' && <PlaidManager />}
        {tab === 'paymentMethods' && <CardManager />}
        {tab === 'cardRewards' && <CardRewardsManager />}
      </section>
    </div>
  )
}
