import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'
import PeopleManager from '@/components/settings/PeopleManager'
import PlaidManager from '@/components/settings/PlaidManager'
import CardManager from '@/components/settings/CardManager'
import CardRewardsManager from '@/components/settings/CardRewardsManager'

export default function WalletPage() {
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

      <WalletSection title="People">
        <PeopleManager />
      </WalletSection>

      <WalletSection title="Linked Accounts">
        <PlaidManager />
      </WalletSection>

      <WalletSection title="Cards">
        <div className="flex flex-col gap-8">
          <CardManager />
          <div className="border-t border-slate-100 pt-6">
            <CardRewardsManager />
          </div>
        </div>
      </WalletSection>
    </div>
  )
}

function WalletSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-5">{title}</h2>
      {children}
    </section>
  )
}
