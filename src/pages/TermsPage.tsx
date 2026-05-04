import { Link } from 'react-router-dom'
import TribeSpendLogoIcon from '@/components/shared/TribeSpendLogoIcon'

const sections = [
  {
    title: 'Use of Service',
    body: [
      'TribeSpend provides tools for tracking transactions, spending, reimbursements, returns, budgets, connected accounts, and card reward insights. You agree to use the service only for lawful purposes and in a way that does not interfere with the operation or security of the service.',
      'You are responsible for the information you enter, upload, connect, categorize, or otherwise manage in TribeSpend.',
    ],
  },
  {
    title: 'Accounts',
    body: [
      'You may need an account to use TribeSpend. You are responsible for keeping your login credentials secure and for activity that occurs under your account.',
      'You agree to provide accurate account information and to update it when needed.',
    ],
  },
  {
    title: 'Financial Data / Plaid',
    body: [
      'If you choose to connect financial accounts, TribeSpend uses Plaid to help retrieve account and transaction information for transaction tracking and spending insights.',
      'TribeSpend does not receive or store your bank login credentials. Your use of Plaid may also be governed by Plaid’s own terms and privacy policy.',
      'You authorize TribeSpend to access and use financial data received through Plaid to provide the features you request.',
    ],
  },
  {
    title: 'Payments / Stripe',
    body: [
      'Paid features, subscriptions, payment methods, invoices, and related billing actions may be handled by Stripe.',
      'Stripe processes payment information according to its own terms, privacy policy, and security practices. TribeSpend does not store full payment card numbers.',
    ],
  },
  {
    title: 'No Financial Advice',
    body: [
      'TribeSpend is an organizational and informational tool. It does not provide financial, legal, tax, investment, accounting, or credit advice.',
      'Any insights, budgets, reward estimates, or recommendations are for informational purposes only. You should make financial decisions based on your own judgment and, when appropriate, advice from qualified professionals.',
    ],
  },
  {
    title: 'Data Accuracy',
    body: [
      'TribeSpend may rely on information from you, uploaded files, connected financial institutions, Plaid, Stripe, and other third-party services.',
      'We do not guarantee that transaction data, categories, reward estimates, budget alerts, reimbursement tracking, or other calculations will always be complete, accurate, current, or error-free.',
    ],
  },
  {
    title: 'Termination',
    body: [
      'You may stop using TribeSpend at any time. We may suspend or terminate access if we believe these Terms have been violated, if continued use creates risk, or if required by law.',
      'Certain data may be retained as described in our Privacy Policy or as needed for legal, security, billing, or operational reasons.',
    ],
  },
  {
    title: 'Limitation of Liability',
    body: [
      'To the fullest extent permitted by law, TribeSpend will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, or financial losses arising from use of the service.',
      'The service is provided on an “as is” and “as available” basis without warranties of any kind, except where warranties cannot be excluded under applicable law.',
    ],
  },
  {
    title: 'Changes to Terms',
    body: [
      'We may update these Terms from time to time. If changes are material, we will take reasonable steps to notify users, such as updating this page or providing an in-app notice.',
      'Continued use of TribeSpend after changes become effective means you accept the updated Terms.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'If you have questions about these Terms, contact us at tribespend@gmail.com.',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-white relative overflow-hidden">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-teal-500/[0.07] blur-3xl -top-56 -right-28 pointer-events-none" />
      <div className="absolute w-[420px] h-[420px] rounded-full bg-teal-500/[0.05] blur-3xl -bottom-40 -left-28 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-4 mb-12">
          <Link to="/" className="flex items-center gap-2.5">
            <TribeSpendLogoIcon className="w-8 h-8 shrink-0 text-white" />
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
          <p className="text-sm font-semibold text-teal-300 mb-3">Effective date: May 4, 2026</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-100 mb-4">Terms of Service</h1>
          <p className="text-gray-400 leading-relaxed mb-10">
            These Terms describe the rules for using TribeSpend. By creating an account or using the service, you agree to these Terms.
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
