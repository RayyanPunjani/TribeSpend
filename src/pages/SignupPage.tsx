import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const { error: err } = await signUp(email, password, name)
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setCheckEmail(true)
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const { error: err } = await signInWithGoogle()
    if (err) setError(err.message)
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] px-4">
        <div className="w-full max-w-[420px] bg-gradient-to-br from-[#141a2a] to-[#0f1422] border border-teal-500/[0.12] rounded-2xl p-9 text-center">
          <div className="w-14 h-14 rounded-full bg-teal-500/[0.12] flex items-center justify-center mx-auto mb-5 text-2xl">
            ✉️
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2 tracking-tight">Check your email</h1>
          <p className="text-sm text-gray-400 mb-6">
            We sent a confirmation link to <strong className="text-gray-100">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link to="/login" className="text-teal-400 font-semibold text-sm hover:text-teal-300">
            Back to sign in
          </Link>
          <Link to="/privacy" className="block text-gray-500 hover:text-teal-300 text-xs mt-5">
            Privacy Policy
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] px-4 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-teal-500/[0.06] blur-3xl -top-48 -right-24 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-teal-500/[0.04] blur-3xl -bottom-36 -left-24 pointer-events-none" />

      <div className="w-full max-w-[420px] bg-gradient-to-br from-[#141a2a] to-[#0f1422] border border-teal-500/[0.12] rounded-2xl p-9 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/favicon.svg" alt="TribeSpend" className="w-8 h-8" />
          <span className="text-xl font-bold">
            <span className="text-gray-100">Tribe</span>
            <span className="text-teal-400">Spend</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-100 mb-1.5 tracking-tight">Create your account</h1>
        <p className="text-sm text-gray-400 mb-7">Free forever — upgrade anytime for bank sync</p>

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-gray-100 text-sm font-medium
                     flex items-center justify-center gap-2.5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-teal-500/10" />
          <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-teal-500/10" />
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          <label className="block text-xs text-gray-400 font-medium mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="w-full px-3.5 py-3 bg-white/[0.04] border border-teal-500/[0.12] rounded-lg text-gray-100 text-sm
                       placeholder-gray-600 outline-none focus:border-teal-500/40 transition-colors mb-4"
          />

          <label className="block text-xs text-gray-400 font-medium mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full px-3.5 py-3 bg-white/[0.04] border border-teal-500/[0.12] rounded-lg text-gray-100 text-sm
                       placeholder-gray-600 outline-none focus:border-teal-500/40 transition-colors mb-4"
          />

          <label className="block text-xs text-gray-400 font-medium mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className="w-full px-3.5 py-3 bg-white/[0.04] border border-teal-500/[0.12] rounded-lg text-gray-100 text-sm
                       placeholder-gray-600 outline-none focus:border-teal-500/40 transition-colors mb-4"
          />

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 bg-teal-500 text-[#0a0e17] rounded-xl text-sm font-semibold
                       hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-1"
          >
            {loading ? 'Creating account…' : 'Create Free Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-teal-400 font-semibold hover:text-teal-300">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs text-gray-600 mt-4">
          <Link to="/privacy" className="text-gray-500 hover:text-teal-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
