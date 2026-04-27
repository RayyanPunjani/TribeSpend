import { Link } from 'react-router-dom'

const sections = [
  {
    title: 'Overview',
    body: [
      'This Privacy Policy explains how TribeSpend collects, uses, stores, and protects information when you use our website and application. The effective date of this policy is April 27, 2026.',
      'TribeSpend is designed to help users track transactions, spending, reimbursements, returns, and card-related insights.',
    ],
  },
  {
    title: 'Information We Collect',
    body: [
      'We collect information you provide directly, such as your name, email address, household information, cards you add, categories, notes, reimbursement details, and other information you enter into the app.',
      'We may also collect usage and technical information needed to operate the service, such as authentication status, device or browser information, and application logs.',
    ],
  },
  {
    title: 'Plaid / Financial Data',
    body: [
      'If you choose to connect a financial account, TribeSpend uses Plaid to help connect to your financial institution and retrieve transaction and account information for transaction tracking and spending insights.',
      'TribeSpend does not receive or store your bank login credentials. Bank credential entry and authentication are handled through Plaid and your financial institution.',
      'Financial data received through Plaid may include account names, account masks, transaction descriptions, transaction amounts, dates, categories, and related transaction metadata.',
    ],
  },
  {
    title: 'How We Use Information',
    body: [
      'We use information to provide and improve TribeSpend features, including transaction tracking, categorization, reimbursements, returns, connected account sync, card reward insights, and account management.',
      'We may use contact information to support account access, respond to requests, and send service-related messages.',
    ],
  },
  {
    title: 'Data Sharing',
    body: [
      'We do not sell personal information. We share information only as needed to operate TribeSpend, comply with law, protect rights and security, or with your direction or consent.',
      'When you connect accounts through Plaid, Plaid processes information according to its own terms and privacy policy.',
    ],
  },
  {
    title: 'Data Storage & Security',
    body: [
      'TribeSpend uses Supabase for authentication and data storage. We use reasonable technical and organizational safeguards intended to protect information stored in the service.',
      'No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
    ],
  },
  {
    title: 'User Consent',
    body: [
      'By creating an account, entering information, uploading files, or connecting a financial account, you consent to TribeSpend processing that information to provide the service.',
      'By connecting your bank account, you authorize TribeSpend to access your financial data through Plaid for transaction tracking and spending insights.',
    ],
  },
  {
    title: 'Data Retention & Deletion',
    body: [
      'We retain information for as long as needed to provide the service, comply with legal obligations, resolve disputes, and maintain business records.',
      'You may delete data within the app where deletion tools are available. To request account or data deletion, contact support@tribespend.com.',
    ],
  },
  {
    title: 'Third-Party Services',
    body: [
      'TribeSpend uses third-party service providers, including Supabase for authentication and data storage, and Plaid for financial account connections.',
      'These providers may process information according to their own terms, privacy policies, and security practices.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'If you have questions about this Privacy Policy or want to request data deletion, contact us at support@tribespend.com.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-white relative overflow-hidden">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-teal-500/[0.07] blur-3xl -top-56 -right-28 pointer-events-none" />
      <div className="absolute w-[420px] h-[420px] rounded-full bg-teal-500/[0.05] blur-3xl -bottom-40 -left-28 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-4 mb-12">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="TribeSpend" className="w-8 h-8" />
            <span className="text-xl font-bold">
              <span className="text-gray-100">Tribe</span>
              <span className="text-teal-400">Spend</span>
            </span>
          </Link>
          <Link to="/login" className="text-sm text-gray-400 hover:text-teal-300">
            Sign in
          </Link>
        </header>

        <main className="bg-gradient-to-br from-[#141a2a] to-[#0f1422] border border-teal-500/[0.12] rounded-2xl p-6 sm:p-10">
          <p className="text-sm font-semibold text-teal-300 mb-3">Effective date: April 27, 2026</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-100 mb-4">Privacy Policy</h1>
          <p className="text-gray-400 leading-relaxed mb-10">
            This policy describes how TribeSpend handles personal and financial information. It is written to be clear about what we collect, how we use it, and how Plaid and Supabase support the service.
          </p>

          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold text-gray-100 mb-3">{section.title}</h2>
                <div className="flex flex-col gap-3">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-6 text-gray-400">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <footer className="py-8 text-center text-xs text-gray-500">
          © 2026 TribeSpend
        </footer>
      </div>
    </div>
  )
}
