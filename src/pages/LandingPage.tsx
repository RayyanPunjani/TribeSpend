import { Link } from 'react-router-dom'
import TribeSpendLogoIcon from '@/components/shared/TribeSpendLogoIcon'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-white relative overflow-hidden">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-teal-500/[0.07] blur-3xl -top-56 -right-28 pointer-events-none" />
      <div className="absolute w-[420px] h-[420px] rounded-full bg-teal-500/[0.05] blur-3xl -bottom-40 -left-28 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-6 sm:px-10 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <TribeSpendLogoIcon className="w-8 h-8 shrink-0 text-white" />
            <span className="text-xl font-bold">
              <span className="text-gray-100">Tribe</span>
              <span className="text-teal-400">Spend</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-gray-300 hover:text-white">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-xl bg-teal-500 text-[#0a0e17] font-semibold hover:bg-teal-400"
            >
              Get started
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center px-6 sm:px-10 py-16">
          <section className="max-w-3xl">
            <p className="text-sm font-semibold text-teal-300 mb-4">Shared spending made clearer</p>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-100">
              Track household cards, reimbursements, and spending in one calm place.
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-2xl leading-relaxed">
              TribeSpend helps families and groups organize transactions, card rewards, reimbursements, and spending insights without sharing bank login credentials with TribeSpend.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="px-5 py-3 rounded-xl bg-teal-500 text-[#0a0e17] text-sm font-semibold hover:bg-teal-400"
              >
                Create account
              </Link>
              <Link
                to="/login"
                className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-gray-100 text-sm font-semibold hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </section>
        </main>

        <footer className="px-6 sm:px-10 py-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 justify-between text-xs text-gray-500">
          <span>© 2026 TribeSpend</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-teal-300">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-teal-300">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
