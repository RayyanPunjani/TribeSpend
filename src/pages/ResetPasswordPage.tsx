import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import TribeSpendLogoIcon from '@/components/shared/TribeSpendLogoIcon'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    setSuccess('Password updated. Redirecting you to sign in…')
    window.setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    }, 1400)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] px-4 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-teal-500/[0.06] blur-3xl -top-48 -right-24 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-teal-500/[0.04] blur-3xl -bottom-36 -left-24 pointer-events-none" />

      <div className="w-full max-w-[420px] bg-gradient-to-br from-[#141a2a] to-[#0f1422] border border-teal-500/[0.12] rounded-2xl p-9 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <TribeSpendLogoIcon className="w-10 h-10 shrink-0 text-white" />
          <span className="text-xl font-bold">
            <span className="text-gray-100">Tribe</span>
            <span className="text-teal-400">Spend</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-100 mb-1.5 tracking-tight">Set a new password</h1>
        <p className="text-sm text-gray-400 mb-7">
          Enter a new password for your TribeSpend account.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-3.5 py-2.5 text-sm text-teal-300 mb-4">
              {success}
            </div>
          )}

          <label className="block text-xs text-gray-400 font-medium mb-1.5">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className="w-full px-3.5 py-3 bg-white/[0.04] border border-teal-500/[0.12] rounded-lg text-gray-100 text-sm
                       placeholder-gray-600 outline-none focus:border-teal-500/40 transition-colors mb-4"
          />

          <label className="block text-xs text-gray-400 font-medium mb-1.5">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className="w-full px-3.5 py-3 bg-white/[0.04] border border-teal-500/[0.12] rounded-lg text-gray-100 text-sm
                       placeholder-gray-600 outline-none focus:border-teal-500/40 transition-colors mb-5"
          />

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword || !!success}
            className="w-full py-3 bg-teal-500 text-[#0a0e17] rounded-xl text-sm font-semibold
                       hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-5">
          <Link to="/login" className="text-gray-500 hover:text-teal-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
