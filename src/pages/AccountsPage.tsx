import { Link2 } from 'lucide-react'
import PlaidManager from '@/components/settings/PlaidManager'

export default function AccountsPage() {
  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
          <Link2 size={20} className="text-accent-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">Connect banks, map accounts, and sync transactions.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <PlaidManager />
      </div>
    </div>
  )
}
