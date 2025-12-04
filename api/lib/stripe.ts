import Stripe from 'stripe'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia'
})

// Subscription tiers
export const TIERS = {
  free: {
    name: 'Free',
    priceId: null,
    features: {
      apiCallsPerDay: 100,
      sports: 3,
      alerts: false,
      steamMoves: false,
      propsAnalysis: false,
      priority: false
    }
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 4900, // $49.00 in cents
    features: {
      apiCallsPerDay: 5000,
      sports: 4,
      alerts: true,
      steamMoves: true,
      propsAnalysis: true,
      priority: true
    }
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    price: 19900, // $199.00 in cents
    features: {
      apiCallsPerDay: -1, // unlimited
      sports: 4,
      alerts: true,
      steamMoves: true,
      propsAnalysis: true,
      priority: true,
      customIntegrations: true,
      dedicatedSupport: true
    }
  }
} as const

export type TierName = keyof typeof TIERS

// Create checkout session
export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: 'pro' | 'enterprise',
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const tierConfig = TIERS[tier]
  if (!tierConfig.priceId) {
    throw new Error(`No price ID configured for tier: ${tier}`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    client_reference_id: userId,
    line_items: [
      {
        price: tierConfig.priceId,
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      tier
    },
    subscription_data: {
      metadata: {
        userId,
        tier
      },
      trial_period_days: 14
    }
  })

  return session.url || ''
}

// Create customer portal session
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  })
  return session.url
}

// Get subscription details
export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId)
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId)
}

// Handle webhook events
export async function handleWebhookEvent(
  body: string | Buffer,
  signature: string
): Promise<{ event: Stripe.Event; handled: boolean }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  }

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

  return { event, handled: true }
}

// Get user tier from subscription status
export function getTierFromSubscription(
  subscription: Stripe.Subscription | null
): TierName {
  if (!subscription || subscription.status !== 'active') {
    return 'free'
  }

  const priceId = subscription.items.data[0]?.price.id

  if (priceId === TIERS.enterprise.priceId) return 'enterprise'
  if (priceId === TIERS.pro.priceId) return 'pro'

  return 'free'
}

// Check if user has feature access
export function hasFeatureAccess(
  tier: TierName,
  feature: keyof typeof TIERS.pro.features
): boolean {
  const tierConfig = TIERS[tier]
  return !!tierConfig.features[feature as keyof typeof tierConfig.features]
}

// Get remaining API calls for user
export function getApiLimit(tier: TierName): number {
  return TIERS[tier].features.apiCallsPerDay
}

export { stripe }
