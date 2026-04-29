import '@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ProfileRow = {
  stripe_customer_id: string | null
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = getServiceRoleKey()

    if (!stripeSecretKey) return json({ error: 'Missing STRIPE_SECRET_KEY' }, 500)
    if (!supabaseUrl) return json({ error: 'Missing SUPABASE_URL' }, 500)
    if (!supabaseAnonKey) return json({ error: 'Missing SUPABASE_ANON_KEY' }, 500)
    if (!serviceRoleKey) return json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, 500)

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Authentication required' }, 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

    if (userError || !userData.user) {
      console.warn('[create-portal-session] Unauthorized portal attempt:', userError?.message)
      return json({ error: 'Authentication required' }, 401)
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[create-portal-session] Failed to fetch profile:', profileError.message)
      return json({ error: 'Failed to load billing profile' }, 500)
    }

    const customerId = (profile as ProfileRow | null)?.stripe_customer_id
    if (!customerId) return json({ error: 'No Stripe customer found for this account.' }, 400)

    const origin = req.headers.get('origin')
    const siteUrl = Deno.env.get('SITE_URL') ?? origin ?? 'https://tribespend.com'
    const stripe = createStripeClient(stripeSecretKey)
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/app/settings?tab=billing`,
    })

    console.log('[create-portal-session] Created billing portal session', {
      userId: userData.user.id,
      customerId,
    })

    return json({ url: portal.url })
  } catch (err) {
    console.error('[create-portal-session] Failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Failed to create portal session' }, 500)
  }
})
