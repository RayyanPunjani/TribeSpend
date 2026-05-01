import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const STRIPE_CANCEL_BEFORE_DELETE = new Set(['active', 'trialing', 'past_due'])

type ProfileRow = {
  id: string
  household_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
}

type PlaidItemRow = {
  id: string
  access_token?: string | null
}

type DeletePhase = 'prepare' | 'finalize' | 'all'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getServiceRoleKey(): string | null {
  return Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  })
}

function plaidBaseUrl(): string {
  const env = Deno.env.get('PLAID_ENV') ?? 'sandbox'
  if (env === 'production') return 'https://production.plaid.com'
  if (env === 'development') return 'https://development.plaid.com'
  return 'https://sandbox.plaid.com'
}

function isIgnorableDbError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')
    || /could not find|does not exist|schema cache/i.test(error.message ?? '')
}

async function removePlaidAccessToken(accessToken: string): Promise<boolean> {
  const clientId = Deno.env.get('PLAID_CLIENT_ID')
  const secret = Deno.env.get('PLAID_SECRET')
  if (!clientId || !secret) {
    console.warn('[delete-account] PLAID_CLIENT_ID/PLAID_SECRET missing; skipping Plaid API removal')
    return false
  }

  const response = await fetch(`${plaidBaseUrl()}/item/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      access_token: accessToken,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.warn('[delete-account] Plaid item/remove failed:', response.status, body.slice(0, 500))
    return false
  }
  return true
}

async function deleteByHousehold(
  supabase: ReturnType<typeof createClient>,
  table: string,
  householdId: string,
): Promise<{ table: string; deleted: boolean; warning?: string }> {
  const { error } = await supabase.from(table).delete().eq('household_id', householdId)
  if (error) {
    if (isIgnorableDbError(error)) return { table, deleted: false, warning: error.message }
    throw new Error(`Failed to delete ${table}: ${error.message}`)
  }
  return { table, deleted: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = getServiceRoleKey()
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!supabaseUrl) return json({ error: 'Missing SUPABASE_URL' }, 500)
    if (!supabaseAnonKey) return json({ error: 'Missing SUPABASE_ANON_KEY' }, 500)
    if (!serviceRoleKey) return json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, 500)
    if (!stripeSecretKey) return json({ error: 'Missing STRIPE_SECRET_KEY' }, 500)

    const body = await req.json().catch(() => ({})) as { phase?: string }
    const phase = (body.phase ?? 'all') as DeletePhase
    if (!['prepare', 'finalize', 'all'].includes(phase)) {
      return json({ error: 'Invalid delete phase' }, 400)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Authentication required' }, 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const stripe = createStripeClient(stripeSecretKey)
    const userId = userData.user.id

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, household_id, stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[delete-account] Failed to fetch profile:', profileError.message)
      return json({ error: 'Failed to load account profile' }, 500)
    }
    if (!profile) return json({ error: 'Account profile not found' }, 404)

    const p = profile as ProfileRow
    if (!p.household_id) return json({ error: 'Account household not found' }, 400)

    if (p.stripe_subscription_id && STRIPE_CANCEL_BEFORE_DELETE.has(p.subscription_status ?? '')) {
      try {
        await stripe.subscriptions.cancel(p.stripe_subscription_id)
        const { error: cancelUpdateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            plaid_access_enabled: false,
            onboarding_completed: false,
          })
          .eq('id', userId)

        if (cancelUpdateError) throw cancelUpdateError
      } catch (err) {
        console.error('[delete-account] Stripe cancellation failed:', err)
        return json(
          { error: "We couldn't cancel your subscription. Please try again or contact support." },
          409,
        )
      }
    } else {
      await supabase
        .from('profiles')
        .update({ plaid_access_enabled: false, onboarding_completed: false })
        .eq('id', userId)
    }

    if (phase === 'prepare') {
      return json({
        success: true,
        phase: 'prepare',
        stripeSubscriptionCanceled: !!p.stripe_subscription_id && STRIPE_CANCEL_BEFORE_DELETE.has(p.subscription_status ?? ''),
      })
    }

    let plaidApiRemoved = 0
    const { data: plaidItems, error: plaidFetchError } = await supabase
      .from('plaid_items')
      .select('id, access_token')
      .eq('household_id', p.household_id)

    if (plaidFetchError) {
      if (!isIgnorableDbError(plaidFetchError)) {
        console.warn('[delete-account] Failed to fetch Plaid items:', plaidFetchError.message)
      }
    } else {
      for (const item of (plaidItems ?? []) as PlaidItemRow[]) {
        if (!item.access_token) continue
        try {
          if (await removePlaidAccessToken(item.access_token)) plaidApiRemoved += 1
        } catch (err) {
          console.warn('[delete-account] Plaid cleanup error for item:', item.id, err)
        }
      }
    }

    const cleanupResults = []
    const tables = [
      'transactions',
      'budgets',
      'card_credits',
      'card_reward_rules',
      'category_rules',
      'plaid_account_mappings',
      'plaid_items',
      'cards',
      'people',
    ]

    for (const table of tables) {
      cleanupResults.push(await deleteByHousehold(supabase, table, p.household_id))
    }

    // Deactivate the profile instead of deleting the Supabase Auth user.
    // TODO: add a separate admin-only deletion path using Supabase Auth Admin API.
    const deletedAt = new Date().toISOString()
    const { error: deactivateError } = await supabase
      .from('profiles')
      .update({
        account_status: 'deleted',
        deleted_at: deletedAt,
        name: 'Deleted Account',
        subscription_status: 'canceled',
        plaid_access_enabled: false,
        onboarding_completed: false,
      })
      .eq('id', userId)

    if (deactivateError) {
      if (!isIgnorableDbError(deactivateError)) {
        console.error('[delete-account] Failed to deactivate profile:', deactivateError.message)
        return json({ error: 'Failed to deactivate account profile' }, 500)
      }

      await supabase
        .from('profiles')
        .update({
          name: 'Deleted Account',
          subscription_status: 'canceled',
          plaid_access_enabled: false,
          onboarding_completed: false,
        })
        .eq('id', userId)
    }

    console.log('[delete-account] Account deactivated', {
      userId,
      householdId: p.household_id,
      plaidApiRemoved,
    })

    return json({
      success: true,
      mode: 'deactivated',
      plaidApiRemoved,
      cleanupResults,
      authUserDeletionTodo: true,
    })
  } catch (err) {
    console.error('[delete-account] Failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Failed to delete account' }, 500)
  }
})
