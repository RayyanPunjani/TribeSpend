import { Bug, Mail, MessageSquare, LifeBuoy } from 'lucide-react'
import { Link } from 'react-router-dom'

const SUPPORT_EMAIL = 'tribespend@gmail.com'

const supportCards = [
  {
    title: 'Email Support',
    description: 'Get help with your account, setup, or anything that feels stuck.',
    button: 'Email TribeSpend',
    subject: 'TribeSpend Support',
    icon: Mail,
  },
  {
    title: 'Send Feedback',
    description: 'Share ideas, requests, or notes on what would make TribeSpend better for your household.',
    button: 'Send Feedback',
    subject: 'TribeSpend Feedback',
    icon: MessageSquare,
  },
  {
    title: 'Report a Bug',
    description: 'Tell us what happened, where you saw it, and what you expected instead.',
    button: 'Report Bug',
    subject: 'TribeSpend Bug Report',
    icon: Bug,
  },
]

function mailto(subject: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export default function HelpSupportPage() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
          <LifeBuoy size={20} className="text-accent-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Help & Support</h1>
          <p className="text-sm text-slate-500 mt-1">
            Need help, have feedback, or found a bug? Contact us and we&apos;ll get back to you.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {supportCards.map(({ title, description, button, subject, icon: Icon }) => (
          <section key={title} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-slate-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">{title}</h2>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
              </div>
            </div>
            <a
              href={mailto(subject)}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 transition-colors"
            >
              <Mail size={15} />
              {button}
            </a>
          </section>
        ))}
      </div>

      <section data-tour="help-support" className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-800">Helpful Details</h2>
        <p className="text-sm text-slate-500 mt-2">
          If you&apos;re reporting a bug, please include screenshots, the email address on your account, and the
          steps to reproduce the issue. That helps us investigate quickly and reply with useful next steps.
        </p>
        <Link
          to="/app/help?tour=1"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Take guided tour
        </Link>
      </section>
    </div>
  )
}
