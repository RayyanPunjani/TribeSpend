import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  List,
  RefreshCw,
  DollarSign,
  PackageOpen,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  LogOut,
  Target,
  Crown,
  Mail,
  UserCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTransactionStore } from '@/stores/transactionStore'
import TribeSpendLogoIcon from '@/components/shared/TribeSpendLogoIcon'

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/app/transactions', icon: List, label: 'Transactions' },
      { to: '/app/recurring', icon: RefreshCw, label: 'Recurring' },
      { to: '/app/reimbursements', icon: DollarSign, label: 'Reimbursements' },
      { to: '/app/returns', icon: PackageOpen, label: 'Returns' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/app/insights', icon: BarChart3, label: 'Insights' },
      { to: '/app/budgets', icon: Target, label: 'Budgets' },
      { to: '/app/optimize', icon: BarChart3, label: 'Optimize' },
      { to: '/app/export', icon: Download, label: 'Export' },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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
        <TribeSpendLogoIcon className="w-8 h-8 shrink-0 drop-shadow-[0_0_10px_rgba(45,212,191,0.18)]" />
        {!collapsed && (
          <span className="font-bold text-base tracking-tight">
            <span className="text-accent-400">Tribe</span><span className="text-white">Spend</span>
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {section.label}
              </p>
            )}
            {section.items.map(({ to, icon: Icon, label, end }) => (
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
          </div>
        ))}

        <div className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Support
            </p>
          )}
          <a
            href="mailto:tribespend@gmail.com?subject=TribeSpend%20Feedback"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200"
            title="Help & Support"
          >
            <Mail size={18} className="shrink-0" />
            {!collapsed && <span>Help & Support</span>}
          </a>
        </div>
      </nav>

      {/* User + Collapse */}
      <div className="px-2 pb-4 flex flex-col gap-1 border-t border-slate-700/50 pt-3">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((open) => !open)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200 transition-colors text-sm ${
              collapsed ? 'justify-center' : ''
            }`}
            title={profile?.name || 'Account'}
          >
            <UserCircle size={18} className="shrink-0" />
            {!collapsed && (
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{profile?.name || 'Account'}</span>
                {isPremium && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                    <Crown size={11} className="shrink-0 fill-amber-300/20" />
                    Premium
                  </span>
                )}
              </span>
            )}
            {!collapsed && (
              <ChevronRight
                size={14}
                className={`shrink-0 text-slate-500 transition-transform ${userMenuOpen ? 'rotate-90' : ''}`}
              />
            )}
            {collapsed && isPremium && (
              <span className="absolute right-1.5 top-1.5 w-2 h-2 rounded-full bg-amber-300" title="Premium" />
            )}
          </button>

          {userMenuOpen && (
            <div
              className={`absolute bottom-full mb-2 rounded-xl border border-slate-700 bg-[#111827] shadow-xl overflow-hidden ${
                collapsed ? 'left-2 w-44' : 'left-0 right-0'
              }`}
            >
              <NavLink
                to="/app/settings"
                onClick={() => setUserMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'text-accent-300 bg-accent-700/30'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200'
                  }`
                }
              >
                <Settings size={15} />
                Settings
              </NavLink>
              <button
                onClick={() => {
                  setUserMenuOpen(false)
                  void signOut()
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-sidebar-text hover:bg-red-500/20 hover:text-red-300 transition-colors"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setCollapsed((c) => !c)
            setUserMenuOpen(false)
          }}
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
