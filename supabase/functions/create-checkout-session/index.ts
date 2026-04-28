import '@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
    const priceId = Deno.env.get('STRIPE_PRICE_ID') ?? 'price_1TRFrIJWjYECGB4jrLONRznA'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!stripeSecretKey) return json({ error: 'Missing STRIPE_SECRET_KEY' }, 500)
    if (!priceId) return json({ error: 'Missing price ID' }, 500)
    if (!supabaseUrl) return json({ error: 'Missing SUPABASE_URL' }, 500)
    if (!supabaseAnonKey) return json({ error: 'Missing SUPABASE_ANON_KEY' }, 500)

    const stripe = createStripeClient(stripeSecretKey)
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Authentication required' }, 401)

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

    if (userError || !userData.user) {
      console.warn('[create-checkout-session] Unauthorized checkout attempt:', userError?.message)
      return json({ error: 'Authentication required' }, 401)
    }

    const user = userData.user
    const origin = req.headers.get('origin')
    const siteUrl = Deno.env.get('SITE_URL') ?? origin ?? 'https://tribespend.com'
    const customerParams = user.email ? { customer_email: user.email } : {}

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...customerParams,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
      success_url: `${siteUrl}/app?success=true`,
      cancel_url: `${siteUrl}/app?canceled=true`,
    })

    console.log('[create-checkout-session] Created checkout session', {
      userId: user.id,
      sessionId: session.id,
      hasCustomerEmail: !!user.email,
    })

    return json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session] Failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' }, 500)
  }
})
