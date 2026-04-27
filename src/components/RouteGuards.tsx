import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function RequireAuth() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
        <div className="text-center text-teal-400">
          <div className="w-8 h-8 border-2 border-teal-400/20 border-t-teal-400 rounded-full animate-spin mx-auto mb-3" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RedirectIfAuth() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/app" replace />
  return <Outlet />
}
