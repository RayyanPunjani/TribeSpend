import { useState } from 'react'
import { CreditCard, Sparkles } from 'lucide-react'
import CardManager from '@/components/settings/CardManager'
import CardRewardsManager from '@/components/settings/CardRewardsManager'

type Tab = 'cards' | 'rewards'

const TABS = [
  { id: 'cards' as Tab, label: 'Cards', icon: CreditCard },
  { id: 'rewards' as Tab, label: 'Rewards & Credits', icon: Sparkles },
]

export default function CardsPage() {
  const [tab, setTab] = useState<Tab>('cards')

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <CreditCard size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cards</h1>
          <p className="text-sm text-slate-500 mt-1">Manage credit cards, payment methods, rewards, and credits.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {tab === 'cards' ? <CardManager /> : <CardRewardsManager />}
      </div>
    </div>
  )
}
