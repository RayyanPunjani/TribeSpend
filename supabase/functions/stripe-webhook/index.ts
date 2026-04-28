import '@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PREMIUM_STATUSES = new Set(['active', 'trialing'])

type ProfileUpdate = {
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  subscription_current_period_end?: string | null
  plaid_access_enabled?: boolean
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

function idFromStripeValue(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.id ?? null
}

function periodEndToIso(periodEnd: number | null | undefined): string | null {
  if (!periodEnd) return null
  return new Date(periodEnd * 1000).toISOString()
}

function profileAccessForStatus(status: string | null | undefined): boolean {
  return !!status && PREMIUM_STATUSES.has(status)
}

async function getSubscription(stripe: Stripe, subscriptionId: string | null): Promise<Stripe.Subscription | null> {
  if (!subscriptionId) return null
  try {
    return await stripe.subscriptions.retrieve(subscriptionId)
  } catch (err) {
    console.warn('[stripe-webhook] Failed to retrieve subscription', subscriptionId, err)
    return null
  }
}

async function findProfileId(params: {
  supabase: ReturnType<typeof createClient>
  userId?: string | null
  customerId?: string | null
  subscriptionId?: string | null
}): Promise<string | null> {
  const { supabase, userId, customerId, subscriptionId } = params
  if (userId) return userId

  if (subscriptionId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle()

    if (error) console.warn('[stripe-webhook] Profile lookup by subscription failed:', error.message)
    if (data?.id) return data.id as string
  }

  if (customerId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (error) console.warn('[stripe-webhook] Profile lookup by customer failed:', error.message)
    if (data?.id) return data.id as string
  }

  return null
}

async function updateProfile(params: {
  supabase: ReturnType<typeof createClient>
  userId?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  patch: ProfileUpdate
}): Promise<boolean> {
  const { supabase, userId, customerId, subscriptionId, patch } = params
  const profileId = await findProfileId({ supabase, userId, customerId, subscriptionId })

  if (!profileId) {
    console.warn('[stripe-webhook] No profile found for Stripe event', {
      hasUserId: !!userId,
      customerId,
      subscriptionId,
    })
    return false
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileId)

  if (error) {
    console.error('[stripe-webhook] Failed to update profile:', error.message, error.details, error.hint)
    return false
  }

  console.log('[stripe-webhook] Updated profile subscription state', {
    profileId,
    customerId: patch.stripe_customer_id ?? customerId,
    subscriptionId: patch.stripe_subscription_id ?? subscriptionId,
    status: patch.subscription_status,
    plaidAccessEnabled: patch.plaid_access_enabled,
  })
  return true
}

async function updateFromSubscription(params: {
  supabase: ReturnType<typeof createClient>
  subscription: Stripe.Subscription
  userId?: string | null
}): Promise<boolean> {
  const { supabase, subscription, userId } = params
  const customerId = idFromStripeValue(subscription.customer)
  const status = subscription.status

  return updateProfile({
    supabase,
    userId: userId ?? subscription.metadata?.user_id ?? null,
    customerId,
    subscriptionId: subscription.id,
    patch: {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      subscription_current_period_end: periodEndToIso(subscription.current_period_end),
      plaid_access_enabled: profileAccessForStatus(status),
    },
  })
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  const userId = session.metadata?.user_id ?? session.client_reference_id ?? null
  const customerId = idFromStripeValue(session.customer)
  const subscriptionId = idFromStripeValue(session.subscription)
  const subscription = await getSubscription(stripe, subscriptionId)

  if (subscription) {
    return updateFromSubscription({ supabase, subscription, userId })
  }

  return updateProfile({
    supabase,
    userId,
    customerId,
    subscriptionId,
    patch: {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: session.payment_status === 'paid' ? 'active' : session.status,
      subscription_current_period_end: null,
      plaid_access_enabled: session.payment_status === 'paid',
    },
  })
}

async function handleInvoiceEvent(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
  fallbackStatus: string,
): Promise<boolean> {
  const customerId = idFromStripeValue(invoice.customer)
  const subscriptionId = idFromStripeValue(invoice.subscription)
  const subscription = await getSubscription(stripe, subscriptionId)

  if (subscription) {
    return updateFromSubscription({ supabase, subscription })
  }

  return updateProfile({
    supabase,
    customerId,
    subscriptionId,
    patch: {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: fallbackStatus,
      subscription_current_period_end: null,
      plaid_access_enabled: profileAccessForStatus(fallbackStatus),
    },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = getServiceRoleKey()
  const signature = req.headers.get('stripe-signature')

  if (!stripeSecretKey) return json({ error: 'Missing STRIPE_SECRET_KEY' }, 500)
  if (!webhookSecret) return json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, 500)
  if (!supabaseUrl) return json({ error: 'Missing SUPABASE_URL' }, 500)
  if (!serviceRoleKey) return json({ error: 'Missing SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY' }, 500)
  if (!signature) return json({ error: 'Missing Stripe signature' }, 400)

  const stripe = createStripeClient(stripeSecretKey)
  const rawBody = await req.text()
  let event: Stripe.Event

  try {
    const cryptoProvider = Stripe.createSubtleCryptoProvider()
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    )
  } catch (err) {
    console.warn('[stripe-webhook] Signature verification failed:', err)
    return json({ error: 'Invalid Stripe signature' }, 400)
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

  console.log('[stripe-webhook] Received event', event.type)

  let updated = false

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        updated = await handleCheckoutCompleted(stripe, supabase, event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        updated = await updateFromSubscription({
          supabase,
          subscription: event.data.object as Stripe.Subscription,
        })
        break

      case 'invoice.payment_succeeded':
        updated = await handleInvoiceEvent(stripe, supabase, event.data.object as Stripe.Invoice, 'active')
        break

      case 'invoice.payment_failed':
        updated = await handleInvoiceEvent(stripe, supabase, event.data.object as Stripe.Invoice, 'past_due')
        break

      default:
        console.log('[stripe-webhook] Ignored event type', event.type)
    }
  } catch (err) {
    console.error('[stripe-webhook] Event handling failed:', err)
    return json({ error: 'Webhook handler failed' }, 500)
  }

  return json({ received: true, eventType: event.type, updated })
})
