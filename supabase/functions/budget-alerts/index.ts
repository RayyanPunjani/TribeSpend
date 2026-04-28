import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REFUND_CATEGORY = 'Refunds & Credits'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface BudgetRow {
  id: string
  household_id: string
  person_id: string | null
  category: string | null
  label: string
  amount: number | string
  period: 'weekly' | 'monthly' | 'annual'
  notify_email: string | null
  notify_thresholds: unknown
  last_notified_threshold: number | string | null
  last_notified_at: string | null
}

interface TransactionRow {
  amount: number | string
  category: string
  card_id: string | null
  is_payment: boolean | null
  is_credit: boolean | null
  is_balance_payment: boolean | null
  is_deleted: boolean | null
  reimbursement_status: string | null
}

interface PeriodRange {
  start: string
  end: string
  label: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getRequestBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== 'POST') return {}
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return {}

  try {
    return await req.json()
  } catch {
    return {}
  }
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === '1'
}

function getPeriodRange(period: BudgetRow['period']): PeriodRange {
  const now = new Date()
  const start = new Date(now)

  if (period === 'weekly') {
    const day = now.getDay()
    const daysToMonday = day === 0 ? -6 : 1 - day
    start.setDate(now.getDate() + daysToMonday)
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return { start: toDateString(start), end: toDateString(end), label: 'weekly' }
  }

  if (period === 'monthly') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setMonth(start.getMonth() + 1)
    return { start: toDateString(start), end: toDateString(end), label: 'monthly' }
  }

  start.setMonth(0, 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setFullYear(start.getFullYear() + 1)
  return { start: toDateString(start), end: toDateString(end), label: 'annual' }
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseThresholds(raw: unknown): number[] {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      value = []
    }
  }

  if (!Array.isArray(value)) return []

  return value
    .map((threshold) => Number(threshold))
    .filter((threshold) => Number.isFinite(threshold) && threshold > 0)
    .sort((a, b) => a - b)
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function shouldCountTransaction(transaction: TransactionRow): boolean {
  if (transaction.is_deleted) return false
  if (transaction.is_payment || transaction.is_credit || transaction.is_balance_payment) return false
  if (transaction.category === REFUND_CATEGORY) return false
  if (transaction.reimbursement_status === 'full') return false
  return true
}

function getCurrentPeriodLastThreshold(budget: BudgetRow, period: PeriodRange): number {
  if (!budget.last_notified_at) return 0
  if (budget.last_notified_at.slice(0, 10) < period.start) return 0
  return Number(budget.last_notified_threshold ?? 0) || 0
}

async function sendBudgetAlert(params: {
  apiKey: string
  to: string
  label: string
  category: string | null
  period: string
  spend: number
  amount: number
  percent: number
}): Promise<void> {
  const { apiKey, to, label, category, period, spend, amount, percent } = params
  const categoryOrLabel = label || category || 'Budget'
  const roundedPercent = Math.round(percent)
  const subject = `🚨 ${categoryOrLabel} budget at ${roundedPercent}%`
  const text = [
    `You’ve spent ${formatCurrency(spend)} of your ${formatCurrency(amount)} ${period} budget.`,
    '',
    `Category: ${categoryOrLabel}`,
    `Usage: ${roundedPercent}%`,
    '',
    'You are approaching your limit. Consider reviewing your spending.',
    '',
    '— TribeSpend',
  ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TribeSpend <alerts@tribespend.com>',
      to,
      subject,
      text,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend error ${response.status}: ${details}`)
  }
}

async function sendTestBudgetAlert(params: {
  apiKey: string
  to: string
  label: string
}): Promise<void> {
  const { apiKey, to, label } = params
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TribeSpend <alerts@tribespend.com>',
      to,
      subject: '✅ Test Budget Alert — TribeSpend',
      text: [
        'This is a test alert from TribeSpend.',
        '',
        `Budget: ${label}`,
        'Email notifications are working correctly.',
        '',
        'You will receive alerts when your spending crosses configured thresholds.',
      ].join('\n'),
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend error ${response.status}: ${details}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const body = await getRequestBody(req)
  const url = new URL(req.url)
  const testMode = isTruthy(body.test) || isTruthy(url.searchParams.get('test'))
  const budgetId = typeof body.budgetId === 'string'
    ? body.budgetId
    : url.searchParams.get('budgetId')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey =
    Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  if (!supabaseUrl) {
    return json({ error: 'Missing SUPABASE_URL environment variable' }, 500)
  }

  if (!serviceRoleKey) {
    return json(
      {
        error:
          'Missing SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variable; budget alerts require the service role key to bypass RLS',
      },
      500,
    )
  }

  if (!resendApiKey) {
    return json({ error: 'Missing RESEND_API_KEY secret; budget alert emails were not sent' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  })

  const summary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: [] as string[],
  }

  let budgetsQuery = supabase
    .from('budgets')
    .select('*')
    .not('notify_email', 'is', null)

  if (budgetId) budgetsQuery = budgetsQuery.eq('id', budgetId)

  const { data: budgets, error: budgetsError } = await budgetsQuery
  if (budgetsError) {
    return json({ error: 'Failed to fetch budgets', details: budgetsError.message }, 500)
  }

  if (testMode) {
    for (const budget of (budgets ?? []) as BudgetRow[]) {
      summary.checked += 1

      try {
        const email = budget.notify_email?.trim()
        if (!email) {
          summary.skipped += 1
          continue
        }

        await sendTestBudgetAlert({
          apiKey: resendApiKey,
          to: email,
          label: budget.label,
        })

        summary.sent += 1
        console.log(`[budget-alerts] Sent test alert for budget ${budget.id}`)
      } catch (error) {
        summary.skipped += 1
        const message = error instanceof Error ? error.message : String(error)
        summary.errors.push(`Budget ${budget.id}: ${message}`)
        console.error(`[budget-alerts] Test alert for budget ${budget.id} failed:`, error)
      }
    }

    return json(summary)
  }

  for (const budget of (budgets ?? []) as BudgetRow[]) {
    summary.checked += 1

    try {
      const email = budget.notify_email?.trim()
      const amount = Number(budget.amount)
      const thresholds = parseThresholds(budget.notify_thresholds)
      const period = getPeriodRange(budget.period)

      console.log(`[budget-alerts] Checking budget ${budget.id} (${budget.label})`)

      if (!email || !Number.isFinite(amount) || amount <= 0 || thresholds.length === 0) {
        summary.skipped += 1
        console.log(`[budget-alerts] Skipping budget ${budget.id}: missing email, amount, or thresholds`)
        continue
      }

      let personCardIds: string[] | null = null
      if (budget.person_id) {
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select('id')
          .eq('household_id', budget.household_id)
          .eq('person_id', budget.person_id)

        if (cardsError) throw new Error(`Failed to fetch person cards: ${cardsError.message}`)

        personCardIds = (cards ?? []).map((card: { id: string }) => card.id)
        if (personCardIds.length === 0) {
          summary.skipped += 1
          console.log(`[budget-alerts] Skipping budget ${budget.id}: no cards for person ${budget.person_id}`)
          continue
        }
      }

      let transactionQuery = supabase
        .from('transactions')
        .select('amount, category, card_id, is_payment, is_credit, is_balance_payment, is_deleted, reimbursement_status')
        .eq('household_id', budget.household_id)
        .gte('trans_date', period.start)
        .lt('trans_date', period.end)
        .neq('category', REFUND_CATEGORY)

      if (budget.category) transactionQuery = transactionQuery.eq('category', budget.category)
      if (personCardIds) transactionQuery = transactionQuery.in('card_id', personCardIds)

      const { data: transactions, error: transactionsError } = await transactionQuery
      if (transactionsError) throw new Error(`Failed to fetch transactions: ${transactionsError.message}`)

      const spend = ((transactions ?? []) as TransactionRow[]).reduce((sum, transaction) => {
        if (!shouldCountTransaction(transaction)) return sum
        return sum + Number(transaction.amount || 0)
      }, 0)

      const percent = (spend / amount) * 100
      const crossedThresholds = thresholds.filter((threshold) => percent >= threshold)
      const thresholdToNotify = crossedThresholds.at(-1)
      const lastNotifiedThreshold = getCurrentPeriodLastThreshold(budget, period)

      console.log(
        `[budget-alerts] Budget ${budget.id}: ${formatCurrency(spend)} / ${formatCurrency(amount)} (${percent.toFixed(1)}%)`,
      )

      if (!thresholdToNotify || thresholdToNotify <= lastNotifiedThreshold) {
        summary.skipped += 1
        continue
      }

      await sendBudgetAlert({
        apiKey: resendApiKey,
        to: email,
        label: budget.label,
        category: budget.category,
        period: period.label,
        spend,
        amount,
        percent,
      })

      const { error: updateError } = await supabase
        .from('budgets')
        .update({
          last_notified_threshold: thresholdToNotify,
          last_notified_at: new Date().toISOString(),
        })
        .eq('id', budget.id)

      if (updateError) throw new Error(`Email sent, but failed to update budget: ${updateError.message}`)

      summary.sent += 1
      console.log(`[budget-alerts] Sent ${thresholdToNotify}% alert for budget ${budget.id}`)
    } catch (error) {
      summary.skipped += 1
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push(`Budget ${budget.id}: ${message}`)
      console.error(`[budget-alerts] Budget ${budget.id} failed:`, error)
    }
  }

  return json(summary)
})
