import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getTierFromSubscription,
  TIERS,
  stripe
} from './stripe.js'

const router = Router()

// Middleware to get authenticated user
interface AuthRequest extends Request {
  user?: { id: string; email: string }
}

// Database pool (passed in during router setup)
let db: Pool

export function setDatabase(pool: Pool) {
  db = pool
}

// GET /api/subscription - Get current user's subscription
router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await db.query(
      `SELECT tier, stripe_customer_id, stripe_subscription_id, subscription_status,
              current_period_end, created_at
       FROM user_subscriptions
       WHERE user_id = $1`,
      [req.user.id]
    )

    if (result.rows.length === 0) {
      return res.json({
        tier: 'free',
        features: TIERS.free.features,
        subscription: null
      })
    }

    const sub = result.rows[0]
    return res.json({
      tier: sub.tier,
      features: TIERS[sub.tier as keyof typeof TIERS]?.features || TIERS.free.features,
      subscription: {
        status: sub.subscription_status,
        currentPeriodEnd: sub.current_period_end,
        customerId: sub.stripe_customer_id
      }
    })
  } catch (error: any) {
    console.error('[STRIPE] Get subscription error:', error.message)
    res.status(500).json({ error: 'Failed to get subscription' })
  }
})

// POST /api/subscription/checkout - Create checkout session
router.post('/subscription/checkout', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { tier } = req.body
    if (!tier || !['pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Use: pro, enterprise' })
    }

    const baseUrl = process.env.APP_URL || 'https://roizenlabs.com'
    const successUrl = `${baseUrl}/dashboard?subscription=success`
    const cancelUrl = `${baseUrl}/dashboard?subscription=cancelled`

    const checkoutUrl = await createCheckoutSession(
      req.user.id,
      req.user.email,
      tier,
      successUrl,
      cancelUrl
    )

    res.json({ url: checkoutUrl })
  } catch (error: any) {
    console.error('[STRIPE] Checkout error:', error.message)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// POST /api/subscription/portal - Create customer portal session
router.post('/subscription/portal', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get customer ID from database
    const result = await db.query(
      'SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = $1',
      [req.user.id]
    )

    if (result.rows.length === 0 || !result.rows[0].stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    const baseUrl = process.env.APP_URL || 'https://roizenlabs.com'
    const portalUrl = await createPortalSession(
      result.rows[0].stripe_customer_id,
      `${baseUrl}/dashboard`
    )

    res.json({ url: portalUrl })
  } catch (error: any) {
    console.error('[STRIPE] Portal error:', error.message)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// POST /api/webhooks/stripe - Stripe webhook handler
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  try {
    const { event } = await handleWebhookEvent(req.body, signature)

    console.log(`[STRIPE] Webhook received: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const userId = session.client_reference_id || session.metadata?.userId
        const tier = session.metadata?.tier || 'pro'
        const customerId = session.customer
        const subscriptionId = session.subscription

        if (userId && subscriptionId) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)

          await db.query(
            `INSERT INTO user_subscriptions
             (user_id, tier, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end)
             VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
             ON CONFLICT (user_id)
             DO UPDATE SET
               tier = $2,
               stripe_customer_id = $3,
               stripe_subscription_id = $4,
               subscription_status = $5,
               current_period_end = to_timestamp($6),
               updated_at = NOW()`,
            [
              userId,
              tier,
              customerId,
              subscriptionId,
              subscription.status,
              subscription.current_period_end
            ]
          )

          console.log(`[STRIPE] User ${userId} subscribed to ${tier}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const userId = subscription.metadata?.userId

        if (userId) {
          const tier = getTierFromSubscription(subscription)

          await db.query(
            `UPDATE user_subscriptions
             SET tier = $1,
                 subscription_status = $2,
                 current_period_end = to_timestamp($3),
                 updated_at = NOW()
             WHERE stripe_subscription_id = $4`,
            [tier, subscription.status, subscription.current_period_end, subscription.id]
          )

          console.log(`[STRIPE] Subscription updated for user ${userId}: ${subscription.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any

        await db.query(
          `UPDATE user_subscriptions
           SET tier = 'free',
               subscription_status = 'canceled',
               updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [subscription.id]
        )

        console.log(`[STRIPE] Subscription canceled: ${subscription.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription

        await db.query(
          `UPDATE user_subscriptions
           SET subscription_status = 'past_due',
               updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        )

        console.log(`[STRIPE] Payment failed for subscription: ${subscriptionId}`)
        break
      }
    }

    res.json({ received: true })
  } catch (error: any) {
    console.error('[STRIPE] Webhook error:', error.message)
    res.status(400).json({ error: error.message })
  }
})

// GET /api/subscription/tiers - Get available tiers
router.get('/subscription/tiers', (_req: Request, res: Response) => {
  res.json({
    tiers: {
      free: {
        name: 'Free',
        price: 0,
        features: TIERS.free.features
      },
      pro: {
        name: 'Pro',
        price: 49,
        features: TIERS.pro.features
      },
      enterprise: {
        name: 'Enterprise',
        price: 199,
        features: TIERS.enterprise.features
      }
    }
  })
})

export default router
