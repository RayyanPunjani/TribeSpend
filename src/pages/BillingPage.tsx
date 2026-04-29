import { useState } from 'react'
import { Crown, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

function isPremiumStatus(status?: string | null): boolean {
  return status === 'active' || status === 'trialing'
}

function formatPeriodEnd(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BillingPage() {
  const { profile } = useAuth()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPremium = profile?.plaid_access_enabled === true || isPremiumStatus(profile?.subscription_status)
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

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Crown size={20} className="text-amber-500 fill-amber-200/40" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Billing</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your Premium subscription status.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">TribeSpend Premium</p>
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

        {!hasPremium && (
          <button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="w-fit flex items-center justify-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-60"
          >
            {checkoutLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {checkoutLoading ? 'Opening Checkout...' : 'Upgrade to Premium'}
          </button>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
