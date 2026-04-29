import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  List,
  Upload,
  RefreshCw,
  DollarSign,
  PackageOpen,
  Download,
  Settings,
  Home,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  LogOut,
  Target,
  Crown,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTransactionStore } from '@/stores/transactionStore'

const NAV_ITEMS = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/transactions', icon: List, label: 'Transactions' },
  { to: '/app/upload', icon: Upload, label: 'Upload' },
  { to: '/app/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/app/reimbursements', icon: DollarSign, label: 'Reimbursements' },
  { to: '/app/returns', icon: PackageOpen, label: 'Returns' },
  { to: '/app/budgets', icon: Target, label: 'Budgets' },
  { to: '/app/optimize', icon: BarChart3, label: 'Optimize' },
  { to: '/app/export', icon: Download, label: 'Export' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { signOut, profile } = useAuth()
  const isPremium = profile?.plaid_access_enabled === true
    || profile?.subscription_status === 'active'
    || profile?.subscription_status === 'trialing'
  const pendingRefundReviews = useTransactionStore((s) =>
    s.transactions.filter((t) => t.refundReviewPending && !t.deleted).length,
  )

  return (
    <aside
      className={`flex flex-col bg-sidebar-bg h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center shrink-0">
          <Home className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base tracking-tight">
            <span className="text-accent-400">Tribe</span><span className="text-white">Spend</span>
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-accent-700/40 text-accent-300'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
            {!collapsed && <span>{label}</span>}
            {label === 'Returns' && pendingRefundReviews > 0 && (
              <span
                className={`ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center ${
                  collapsed ? 'absolute right-1.5 top-1.5' : ''
                }`}
              >
                {pendingRefundReviews > 9 ? '9+' : pendingRefundReviews}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings + Collapse */}
      <div className="px-2 pb-4 flex flex-col gap-1 border-t border-slate-700/50 pt-3">
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              isActive
                ? 'bg-accent-700/40 text-accent-300'
                : 'text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200'
            }`
          }
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-text hover:bg-red-500/20 hover:text-red-300 transition-colors text-sm"
          title="Sign out"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate">{profile?.name || 'Sign out'}</span>
              {isPremium && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300"
                  title="Premium"
                >
                  <Crown size={10} className="shrink-0" />
                  Premium
                </span>
              )}
            </span>
          )}
        </button>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200 transition-colors text-sm"
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={18} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
