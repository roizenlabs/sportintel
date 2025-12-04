/**
 * SportIntel Pro - Real-Time API Server
 * Build: 2025-12-04-v2
 *
 * Features:
 * - WebSocket for instant arbitrage push
 * - Redis caching for speed
 * - O(n) arbitrage detection
 * - Freemium tier system
 * - Background odds ingestion
 * - Stripe subscriptions
 */

// Load environment FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
dotenv.config()

import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import axios from 'axios'
import { authenticateToken, optionalAuth, authHandlers, AuthRequest } from './auth.js'
import { db } from './db/index.js'
import { initWebSocket, getClientCount, getArbSubscriberCount, getSignalSubscriberCount, getRegisteredNodeCount, broadcastArbitrage } from './lib/websocket.js'
import { cache, getRedis } from './lib/redis.js'
import { startIngestion, stopIngestion, getIngestionStats, forcePoll, onArbitrageFound } from './lib/odds-ingestion.js'
import type { ArbitrageOpportunity } from './lib/arbitrage-engine.js'
import {
  initSignalBus,
  onSignal,
  publishSignal,
  publishSteamSignal,
  publishArbSignal,
  registerNode,
  heartbeatNode,
  getNetworkStats,
  getRecentSignals,
  type Signal,
  type SignalType
} from './lib/signal-bus.js'
import {
  recordLineMovement,
  detectSteamMove,
  findMatchingPatterns,
  saveGameContext,
  recordSignalOutcome,
  getNodeStats,
  getTopNodes
} from './lib/context-ledger.js'
import adminRoutes, { requireAdmin, setDatabase as setAdminDatabase } from './lib/admin-routes.js'
import { pool } from './db/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Run database migrations on startup
async function runMigrations() {
  console.log('[MIGRATE] Starting database migrations...')

  try {
    // Get migrations directory (handle both src and dist locations)
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    let migrationsDir = path.join(__dirname, 'db/migrations')

    // If not found, try parent directory (for when running from dist/)
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, '../db/migrations')
    }

    // Also try project root
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(process.cwd(), 'db/migrations')
    }

    if (!fs.existsSync(migrationsDir)) {
      console.log('[MIGRATE] No migrations directory found at:', migrationsDir)
      return
    }

    console.log('[MIGRATE] Using migrations directory:', migrationsDir)

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    console.log('[MIGRATE] Found migrations:', files)

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      try {
        await pool.query(sql)
        console.log(`[MIGRATE] ✅ ${file}`)
      } catch (err: any) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`[MIGRATE] ⏭️ ${file} (already applied)`)
        } else {
          console.error(`[MIGRATE] ❌ ${file}:`, err.message)
        }
      }
    }

    // Create/update admin user
    console.log('[MIGRATE] Setting up admin user...')
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('SportIntel2024!', 10)

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', ['shawnsonnier04@gmail.com'])

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password_hash, username, first_name, is_admin, subscription_tier)
         VALUES ($1, $2, $3, $4, true, 'enterprise')`,
        ['shawnsonnier04@gmail.com', hash, 'shawn_admin', 'Shawn']
      )
      console.log('[MIGRATE] ✅ Created admin: shawnsonnier04@gmail.com / SportIntel2024!')
    } else {
      await pool.query(
        'UPDATE users SET password_hash = $1, is_admin = true WHERE email = $2',
        [hash, 'shawnsonnier04@gmail.com']
      )
      console.log('[MIGRATE] ✅ Updated admin: shawnsonnier04@gmail.com / SportIntel2024!')
    }

    console.log('[MIGRATE] Database migrations complete!')
  } catch (err: any) {
    console.error('[MIGRATE] Migration error:', err.message)
  }
}

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || process.env.API_PORT || 8080

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}))
app.use(express.json())

// Initialize WebSocket
const io = initWebSocket(httpServer)

// Alert configuration
const alertConfig = {
  telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN || '', chatId: process.env.TELEGRAM_CHAT_ID || '' },
  discord: { webhookUrl: process.env.DISCORD_WEBHOOK_URL || '' },
  settings: { arbitrageAlerts: true, steamMoveAlerts: true, minProfit: 0.5, minSteamChange: 15 }
}

// Constants
const ODDS_API_KEY = process.env.ODDS_API_KEY
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 'bovada']
const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl'
}

// ============================================
// ALERT FUNCTIONS
// ============================================

async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!alertConfig.telegram.botToken || !alertConfig.telegram.chatId) return false
  try {
    await axios.post(`https://api.telegram.org/bot${alertConfig.telegram.botToken}/sendMessage`, {
      chat_id: alertConfig.telegram.chatId,
      text: message,
      parse_mode: 'Markdown'
    })
    return true
  } catch (err: any) {
    console.error('[TELEGRAM] Send failed:', err.message)
    return false
  }
}

async function sendDiscordAlert(embed: any): Promise<boolean> {
  if (!alertConfig.discord.webhookUrl) return false
  try {
    await axios.post(alertConfig.discord.webhookUrl, { embeds: [embed] })
    return true
  } catch (err: any) {
    console.error('[DISCORD] Send failed:', err.message)
    return false
  }
}

// Register arbitrage alert callback
onArbitrageFound(async (arb: ArbitrageOpportunity) => {
  if (!alertConfig.settings.arbitrageAlerts) return
  if (arb.profit < alertConfig.settings.minProfit) return

  // Send alerts in parallel
  const telegramMsg = `
🎯 *ARBITRAGE FOUND*
*Game:* ${arb.game}
*Profit:* +${arb.profit.toFixed(2)}%
*Type:* ${arb.type}

📊 *Bets:*
• ${arb.book1.name}: ${arb.book1.bet} @ ${arb.book1.odds > 0 ? '+' : ''}${arb.book1.odds} (${arb.book1.stake.toFixed(1)}%)
• ${arb.book2.name}: ${arb.book2.bet} @ ${arb.book2.odds > 0 ? '+' : ''}${arb.book2.odds} (${arb.book2.stake.toFixed(1)}%)

⏰ Act fast!
`

  const discordEmbed = {
    title: '🎯 Arbitrage Opportunity!',
    color: arb.profit >= 2 ? 0xff0000 : 0x00ff00,
    fields: [
      { name: 'Game', value: arb.game, inline: false },
      { name: 'Type', value: arb.type, inline: true },
      { name: 'Profit', value: `+${arb.profit.toFixed(2)}%`, inline: true },
      { name: arb.book1.name, value: `${arb.book1.bet}\n${arb.book1.odds > 0 ? '+' : ''}${arb.book1.odds}`, inline: true },
      { name: arb.book2.name, value: `${arb.book2.bet}\n${arb.book2.odds > 0 ? '+' : ''}${arb.book2.odds}`, inline: true }
    ],
    footer: { text: 'SportIntel Pro' },
    timestamp: new Date().toISOString()
  }

  await Promise.all([
    sendTelegramAlert(telegramMsg),
    sendDiscordAlert(discordEmbed)
  ])
})

// ============================================
// HEALTH & STATUS ROUTES
// ============================================

app.get('/api/health', async (req, res) => {
  const stats = getIngestionStats()
  let networkStats = { activeNodes: 0, signalsToday: 0, avgReputation: 0, coverage: { sports: [], books: [] } }
  try {
    networkStats = await getNetworkStats()
  } catch (err) {
    // Network stats may not be available without Redis
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocket: {
      clients: getClientCount(),
      arbSubscribers: getArbSubscriberCount(),
      signalSubscribers: getSignalSubscriberCount(),
      registeredNodes: getRegisteredNodeCount()
    },
    network: networkStats,
    ingestion: stats,
    redis: process.env.REDIS_URL ? 'connected' : 'mock'
  })
})

app.get('/api/status', (req, res) => {
  res.json({
    version: '2.0.0-network',
    name: 'SportIntel Agentic Network',
    features: {
      websocket: true,
      realTimeArbitrage: true,
      freemiumTiers: true,
      signalNetwork: true,
      agentNodes: true,
      contextLedger: true
    },
    limits: {
      free: { arbDelay: 5, maxSports: 2, signalPublish: false },
      pro: { arbDelay: 0, maxSports: 4, signalPublish: true },
      premium: { arbDelay: 0, maxSports: -1, signalPublish: true }
    },
    signalTypes: ['steam', 'arb', 'dead', 'ev', 'news', 'pattern']
  })
})

// ============================================
// REAL-TIME ARBITRAGE ROUTES
// ============================================

// GET /api/arbitrage/live - Get current active arbitrages
app.get('/api/arbitrage/live', async (req, res) => {
  try {
    const arbs = await cache.getArbitrages()
    res.json({
      arbitrages: arbs,
      count: arbs.length,
      timestamp: Date.now()
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch arbitrages' })
  }
})

// POST /api/arbitrage/scan - Force immediate scan
app.post('/api/arbitrage/scan', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await forcePoll()
    res.json({
      success: true,
      gamesScanned: result.games,
      arbitragesFound: result.arbs
    })
  } catch (err) {
    res.status(500).json({ error: 'Scan failed' })
  }
})

// GET /api/arbitrage/:sport - Legacy endpoint (still works but uses cache)
app.get('/api/arbitrage/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const minProfit = parseFloat(req.query.minProfit as string) || 0

    // Get from cache
    const allArbs = await cache.getArbitrages()
    const sportArbs = allArbs.filter(a =>
      a.sport === sport && a.profit >= minProfit
    )

    res.json({
      opportunities: sportArbs,
      scannedGames: sportArbs.length,
      cached: true,
      hint: 'Connect via WebSocket for real-time updates'
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch arbitrages' })
  }
})

// ============================================
// ODDS ROUTES (with caching)
// ============================================

app.get('/api/odds/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const sportKey = SPORT_KEYS[sport]

    if (!sportKey) {
      return res.status(400).json({ error: 'Invalid sport. Use: nfl, nba, mlb, nhl' })
    }

    // Try cache first
    const cached = await cache.getOdds(sport)
    if (cached) {
      return res.json({
        games: cached,
        cached: true,
        timestamp: Date.now()
      })
    }

    // Fallback to direct API call
    const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'h2h,spreads',
        oddsFormat: 'american',
        bookmakers: BOOKMAKERS.slice(0, 3).join(',')
      }
    })

    const games = response.data.map((game: any) => {
      const oddsData: Record<string, any> = {}

      for (const bookmaker of game.bookmakers || []) {
        const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')
        const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')

        if (h2h) {
          const home = h2h.outcomes.find((o: any) => o.name === game.home_team)
          const away = h2h.outcomes.find((o: any) => o.name === game.away_team)
          const spreadHome = spreads?.outcomes?.find((o: any) => o.name === game.home_team)

          oddsData[bookmaker.key] = {
            home: home?.price || 0,
            away: away?.price || 0,
            spread: spreadHome?.point || null
          }
        }
      }

      return {
        id: game.id,
        game: `${game.away_team} @ ${game.home_team}`,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: new Date(game.commence_time).toLocaleString(),
        odds: oddsData
      }
    })

    // Cache the response
    await cache.setOdds(sport, games, 10)

    res.json({ games, cached: false })
  } catch (err: any) {
    console.error('Odds error:', err.message)
    res.status(500).json({ error: 'Failed to fetch odds' })
  }
})

// ============================================
// STEAM MOVES / LINE MOVEMENT ROUTES
// ============================================

// GET /api/steam-moves/:sport - Get recent line movements/steam moves
app.get('/api/steam-moves/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const limit = parseInt(req.query.limit as string) || 20

    // Get recent line movements from database
    const result = await db.query(`
      SELECT * FROM line_movements
      WHERE sport = $1
      ORDER BY captured_at DESC
      LIMIT $2
    `, [sport, limit])

    // Also get any recent steam signals
    const signals = await getRecentSignals('steam', 10)
    const sportSignals = signals.filter(s => s.payload.sport === sport)

    res.json({
      movements: result.rows,
      steamSignals: sportSignals,
      count: result.rows.length
    })
  } catch (err: any) {
    console.error('Steam moves error:', err.message)
    // Return empty array if table doesn't exist yet
    res.json({ movements: [], steamSignals: [], count: 0 })
  }
})

// ============================================
// PLAYER PROPS ROUTES
// ============================================

// GET /api/props/:sport - Get player props with odds comparison
app.get('/api/props/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const sportKey = SPORT_KEYS[sport]
    const market = req.query.market as string

    if (!sportKey) {
      return res.status(400).json({ error: 'Invalid sport. Use: nfl, nba, mlb, nhl' })
    }

    // Fetch player props from The Odds API
    const marketsParam = market || 'player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals,player_turnovers'

    const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/events`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        oddsFormat: 'american'
      }
    })

    // For each event, get player props
    const events = response.data.slice(0, 5) // Limit to 5 games to save API calls
    const allProps: any[] = []
    const marketsFound = new Set<string>()

    for (const event of events) {
      try {
        const propsResponse = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/events/${event.id}/odds`, {
          params: {
            apiKey: ODDS_API_KEY,
            regions: 'us',
            markets: marketsParam,
            oddsFormat: 'american'
          }
        })

        const propsData = propsResponse.data
        if (!propsData.bookmakers) continue

        // Process each bookmaker's props
        const propsByPlayer: Record<string, any> = {}

        for (const bookmaker of propsData.bookmakers) {
          for (const marketData of bookmaker.markets || []) {
            marketsFound.add(marketData.key)

            for (const outcome of marketData.outcomes || []) {
              const playerKey = `${outcome.description}|${marketData.key}`

              if (!propsByPlayer[playerKey]) {
                propsByPlayer[playerKey] = {
                  player: outcome.description,
                  game: `${event.away_team} @ ${event.home_team}`,
                  market: marketData.key,
                  line: outcome.point || 0,
                  books: [],
                  bestOver: { book: '', odds: -Infinity },
                  bestUnder: { book: '', odds: -Infinity }
                }
              }

              const prop = propsByPlayer[playerKey]
              const isOver = outcome.name === 'Over'
              const odds = outcome.price

              // Add book data
              let bookEntry = prop.books.find((b: any) => b.name === bookmaker.key)
              if (!bookEntry) {
                bookEntry = { name: bookmaker.key, over: 0, under: 0 }
                prop.books.push(bookEntry)
              }

              if (isOver) {
                bookEntry.over = odds
                if (odds > prop.bestOver.odds) {
                  prop.bestOver = { book: bookmaker.key, odds }
                }
              } else {
                bookEntry.under = odds
                if (odds > prop.bestUnder.odds) {
                  prop.bestUnder = { book: bookmaker.key, odds }
                }
              }
            }
          }
        }

        allProps.push(...Object.values(propsByPlayer))
      } catch (err) {
        // Skip events that fail
        continue
      }
    }

    res.json({
      props: allProps,
      markets: Array.from(marketsFound),
      count: allProps.length
    })
  } catch (err: any) {
    console.error('Props error:', err.message)
    res.status(500).json({ error: 'Failed to fetch player props' })
  }
})

// ============================================
// ALERT CONFIGURATION ROUTES
// ============================================

app.get('/api/alerts/status', (req, res) => {
  res.json({
    telegram: { configured: !!(alertConfig.telegram.botToken && alertConfig.telegram.chatId) },
    discord: { configured: !!alertConfig.discord.webhookUrl },
    settings: alertConfig.settings,
    websocket: {
      clients: getClientCount(),
      arbSubscribers: getArbSubscriberCount()
    }
  })
})

app.post('/api/alerts/telegram', (req, res) => {
  const { botToken, chatId } = req.body
  if (botToken) alertConfig.telegram.botToken = botToken
  if (chatId) alertConfig.telegram.chatId = chatId
  res.json({ success: true, configured: !!(alertConfig.telegram.botToken && alertConfig.telegram.chatId) })
})

app.post('/api/alerts/discord', (req, res) => {
  const { webhookUrl } = req.body
  if (webhookUrl) alertConfig.discord.webhookUrl = webhookUrl
  res.json({ success: true, configured: !!alertConfig.discord.webhookUrl })
})

app.post('/api/alerts/settings', (req, res) => {
  const { arbitrageAlerts, steamMoveAlerts, minProfit, minSteamChange } = req.body
  if (arbitrageAlerts !== undefined) alertConfig.settings.arbitrageAlerts = arbitrageAlerts
  if (steamMoveAlerts !== undefined) alertConfig.settings.steamMoveAlerts = steamMoveAlerts
  if (minProfit !== undefined) alertConfig.settings.minProfit = minProfit
  if (minSteamChange !== undefined) alertConfig.settings.minSteamChange = minSteamChange
  res.json({ success: true, settings: alertConfig.settings })
})

app.post('/api/alerts/test', async (req, res) => {
  const { channel } = req.body
  const results: any = {}

  if (channel === 'telegram' || channel === 'all') {
    results.telegram = await sendTelegramAlert('🧪 *Test Alert*\n\nSportIntel Pro is connected!')
  }
  if (channel === 'discord' || channel === 'all') {
    results.discord = await sendDiscordAlert({
      title: '🧪 Test Alert',
      description: 'SportIntel Pro is connected!',
      color: 0x00ff00
    })
  }

  res.json({ success: true, results })
})

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', authHandlers.register)
app.post('/api/auth/login', authHandlers.login)
app.post('/api/auth/refresh', authHandlers.refresh)
app.post('/api/auth/logout', authHandlers.logout)
app.get('/api/auth/me', authenticateToken, authHandlers.me)

// ============================================
// SUBSCRIPTION/TIER ROUTES
// ============================================

app.get('/api/subscription/plans', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subscription_plans WHERE active = true ORDER BY price_monthly')
    res.json({ plans: result.rows })
  } catch (err) {
    // Return default plans if table doesn't exist (matches lib/stripe.ts)
    res.json({
      plans: [
        { name: 'Free', tier: 'free', price_monthly: 0, features: { arb_delay_seconds: 5, max_sports: 3, apiCallsPerDay: 100 } },
        { name: 'Pro', tier: 'pro', price_monthly: 49, features: { arb_delay_seconds: 0, max_sports: 4, apiCallsPerDay: 5000 } },
        { name: 'Enterprise', tier: 'enterprise', price_monthly: 199, features: { arb_delay_seconds: 0, max_sports: 4, apiCallsPerDay: -1 } }
      ]
    })
  }
})

app.get('/api/subscription/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      'SELECT s.*, p.features FROM subscriptions s LEFT JOIN subscription_plans p ON s.tier = p.tier WHERE s.user_id = $1',
      [req.user!.id]
    )
    res.json({ subscription: result.rows[0] || { tier: 'free', features: { arb_delay_seconds: 5 } } })
  } catch (err) {
    res.json({ subscription: { tier: 'free', features: { arb_delay_seconds: 5 } } })
  }
})

// ============================================
// STRIPE SUBSCRIPTION ROUTES
// ============================================

// Stripe checkout - create payment session
app.post('/api/subscription/checkout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tier } = req.body
    if (!tier || !['pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Use: pro, enterprise' })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

    const priceId = tier === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_ENTERPRISE_PRICE_ID

    if (!priceId) {
      return res.status(500).json({ error: 'Stripe not configured' })
    }

    const baseUrl = process.env.APP_URL || 'https://roizenlabs.com'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.user!.email,
      client_reference_id: String(req.user!.id),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?subscription=success`,
      cancel_url: `${baseUrl}/dashboard?subscription=cancelled`,
      metadata: { userId: String(req.user!.id), tier },
      subscription_data: {
        metadata: { userId: String(req.user!.id), tier },
        trial_period_days: 14
      }
    })

    res.json({ url: session.url })
  } catch (err: any) {
    console.error('[STRIPE] Checkout error:', err.message)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// Stripe portal - manage subscription
app.post('/api/subscription/portal', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      'SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = $1',
      [req.user!.id]
    )

    if (!result.rows[0]?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription' })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

    const baseUrl = process.env.APP_URL || 'https://roizenlabs.com'
    const session = await stripe.billingPortal.sessions.create({
      customer: result.rows[0].stripe_customer_id,
      return_url: `${baseUrl}/dashboard`
    })

    res.json({ url: session.url })
  } catch (err: any) {
    console.error('[STRIPE] Portal error:', err.message)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// Stripe webhook
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string
  if (!signature) return res.status(400).json({ error: 'Missing signature' })

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )

    console.log(`[STRIPE] Webhook: ${event.type}`)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const userId = session.client_reference_id
      const tier = session.metadata?.tier || 'pro'
      const customerId = session.customer
      const subscriptionId = session.subscription

      if (userId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        await db.query(
          `INSERT INTO user_subscriptions (user_id, tier, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end)
           VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
           ON CONFLICT (user_id) DO UPDATE SET tier=$2, stripe_customer_id=$3, stripe_subscription_id=$4, subscription_status=$5, current_period_end=to_timestamp($6), updated_at=NOW()`,
          [userId, tier, customerId, subscriptionId, sub.status, sub.current_period_end]
        )
        console.log(`[STRIPE] User ${userId} subscribed to ${tier}`)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as any
      await db.query(
        `UPDATE user_subscriptions SET tier='free', subscription_status='canceled', updated_at=NOW() WHERE stripe_subscription_id=$1`,
        [sub.id]
      )
      console.log(`[STRIPE] Subscription canceled: ${sub.id}`)
    }

    res.json({ received: true })
  } catch (err: any) {
    console.error('[STRIPE] Webhook error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

// ============================================
// WATCHLIST ROUTES
// ============================================

app.get('/api/watchlist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sport = req.query.sport as string | undefined
    const watchlist = await db.getWatchlist(req.user!.id, sport)
    res.json({ watchlist })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get watchlist' })
  }
})

app.post('/api/watchlist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { playerName, sport, propType, targetLine, alertOnEdge, notes } = req.body
    if (!playerName || !sport || !propType) {
      return res.status(400).json({ error: 'playerName, sport, and propType required' })
    }
    const item = await db.addToWatchlist(req.user!.id, { playerName, sport, propType, targetLine, alertOnEdge, notes })
    res.status(201).json({ item })
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to watchlist' })
  }
})

app.delete('/api/watchlist/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await db.removeFromWatchlist(req.user!.id, parseInt(req.params.id))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from watchlist' })
  }
})

// ============================================
// USER PREFERENCES
// ============================================

app.get('/api/user/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const prefs = await db.getPreferences(req.user!.id)
    res.json({ preferences: prefs })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get preferences' })
  }
})

app.put('/api/user/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const prefs = await db.updatePreferences(req.user!.id, req.body)
    res.json({ preferences: prefs })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// ============================================
// NETWORK NODE ROUTES
// ============================================

// POST /api/network/register - Register a new node in the network
app.post('/api/network/register', async (req, res) => {
  try {
    const { id, watching, agents } = req.body

    if (!id) {
      return res.status(400).json({ error: 'Node ID required' })
    }

    const node = await registerNode({
      id,
      watching: watching || { sports: ['nba', 'nfl'], books: ['draftkings', 'fanduel'] },
      agents: agents || { sniper: false, steamChaser: true, evHunter: false },
      reputation: 50
    })

    res.json({
      success: true,
      node: {
        id: node.id,
        reputation: node.reputation,
        watching: node.watching,
        agents: node.agents
      }
    })
  } catch (err: any) {
    console.error('[NETWORK] Registration failed:', err.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/network/heartbeat - Keep node alive and update config
app.post('/api/network/heartbeat', async (req, res) => {
  try {
    const { nodeId, watching } = req.body

    if (!nodeId) {
      return res.status(400).json({ error: 'Node ID required' })
    }

    await heartbeatNode(nodeId, watching)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed' })
  }
})

// GET /api/network/stats - Get network-wide statistics
app.get('/api/network/stats', async (req, res) => {
  try {
    const stats = await getNetworkStats()
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get network stats' })
  }
})

// GET /api/network/leaderboard - Get top nodes by reputation
app.get('/api/network/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const topNodes = await getTopNodes(limit)
    res.json({ nodes: topNodes })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get leaderboard' })
  }
})

// GET /api/network/node/:nodeId - Get specific node stats
app.get('/api/network/node/:nodeId', async (req, res) => {
  try {
    const stats = await getNodeStats(req.params.nodeId)
    if (!stats) {
      return res.status(404).json({ error: 'Node not found' })
    }
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get node stats' })
  }
})

// ============================================
// SIGNAL ROUTES
// ============================================

// POST /api/signals/publish - Publish a signal to the network
app.post('/api/signals/publish', async (req, res) => {
  try {
    const { type, nodeId, payload, evidence } = req.body

    if (!type || !nodeId || !payload) {
      return res.status(400).json({ error: 'type, nodeId, and payload required' })
    }

    const validTypes: SignalType[] = ['steam', 'arb', 'dead', 'ev', 'news', 'pattern']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Use: ${validTypes.join(', ')}` })
    }

    const signal = await publishSignal(type, nodeId, payload, evidence || { books: [], timestamp: Date.now() })

    // Broadcast to WebSocket clients
    io.to('signals').emit('signal:new', signal)

    res.json({ success: true, signal })
  } catch (err: any) {
    console.error('[SIGNALS] Publish failed:', err.message)
    res.status(500).json({ error: 'Failed to publish signal' })
  }
})

// POST /api/signals/steam - Publish a steam move signal (convenience endpoint)
app.post('/api/signals/steam', async (req, res) => {
  try {
    const { nodeId, gameId, sport, books, oldLine, newLine } = req.body

    if (!nodeId || !gameId || !sport || !books || oldLine === undefined || newLine === undefined) {
      return res.status(400).json({ error: 'nodeId, gameId, sport, books, oldLine, newLine required' })
    }

    const signal = await publishSteamSignal(nodeId, gameId, sport, books, oldLine, newLine)

    // Also record in context ledger
    await recordLineMovement({
      gameId,
      sport,
      bookmaker: books[0],
      market: 'h2h',
      side: 'home',
      oldLine,
      newLine,
      delta: Math.abs(newLine - oldLine)
    })

    // Check if this constitutes a steam move
    const steamCheck = await detectSteamMove(gameId)
    if (steamCheck?.isSteam) {
      console.log(`[STEAM] Detected multi-book steam: ${steamCheck.books.join(', ')}`)
    }

    io.to('signals').emit('signal:new', signal)

    res.json({ success: true, signal, steamDetected: steamCheck?.isSteam || false })
  } catch (err: any) {
    console.error('[SIGNALS] Steam publish failed:', err.message)
    res.status(500).json({ error: 'Failed to publish steam signal' })
  }
})

// POST /api/signals/arb - Publish an arbitrage signal
app.post('/api/signals/arb', async (req, res) => {
  try {
    const { nodeId, gameId, sport, book1, book2, profit } = req.body

    if (!nodeId || !gameId || !sport || !book1 || !book2 || !profit) {
      return res.status(400).json({ error: 'nodeId, gameId, sport, book1, book2, profit required' })
    }

    const signal = await publishArbSignal(nodeId, gameId, sport, book1, book2, profit)

    io.to('signals').emit('signal:new', signal)

    res.json({ success: true, signal })
  } catch (err: any) {
    console.error('[SIGNALS] Arb publish failed:', err.message)
    res.status(500).json({ error: 'Failed to publish arb signal' })
  }
})

// GET /api/signals/recent - Get recent signals
app.get('/api/signals/recent', async (req, res) => {
  try {
    const type = req.query.type as SignalType | undefined
    const limit = parseInt(req.query.limit as string) || 20

    const signals = await getRecentSignals(type, limit)
    res.json({ signals })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get signals' })
  }
})

// POST /api/signals/outcome - Report a signal outcome (for reputation)
app.post('/api/signals/outcome', async (req, res) => {
  try {
    const { signalId, signalType, nodeId, gameId, sport, prediction, confidence, outcome, actualResult } = req.body

    if (!signalId || !signalType || !nodeId || !outcome) {
      return res.status(400).json({ error: 'signalId, signalType, nodeId, outcome required' })
    }

    const reputationDelta = await recordSignalOutcome({
      signalId,
      signalType,
      nodeId,
      gameId,
      sport,
      prediction: prediction || '',
      confidence: confidence || 50,
      outcome,
      actualResult,
      signalTime: new Date(),
      outcomeTime: new Date()
    })

    res.json({ success: true, reputationDelta })
  } catch (err: any) {
    console.error('[SIGNALS] Outcome recording failed:', err.message)
    res.status(500).json({ error: 'Failed to record outcome' })
  }
})

// ============================================
// CONTEXT LEDGER ROUTES
// ============================================

// GET /api/context/patterns - Find matching betting patterns
app.get('/api/context/patterns', async (req, res) => {
  try {
    const conditions = req.query.conditions
      ? JSON.parse(req.query.conditions as string)
      : {}

    const patterns = await findMatchingPatterns(conditions)
    res.json({ patterns })
  } catch (err) {
    res.status(500).json({ error: 'Failed to find patterns' })
  }
})

// POST /api/context/game - Save game context for pattern matching
app.post('/api/context/game', async (req, res) => {
  try {
    const context = req.body

    if (!context.gameId || !context.sport) {
      return res.status(400).json({ error: 'gameId and sport required' })
    }

    await saveGameContext(context)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save game context' })
  }
})

// ============================================
// ADMIN ROUTES
// ============================================

// Initialize admin routes with database pool
setAdminDatabase(pool)

// Bootstrap endpoint - promote user to admin with secret key (no auth required)
app.post('/api/bootstrap-admin', async (req, res) => {
  const { email, secret } = req.body
  const JWT_SECRET = process.env.JWT_SECRET || 'sportintel-secret-change-in-production'

  if (secret !== JWT_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' })
  }

  if (!email) {
    return res.status(400).json({ error: 'Email required' })
  }

  try {
    const result = await pool.query(
      'UPDATE users SET is_admin = true WHERE email = $1 RETURNING id, email, is_admin',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    console.log('[BOOTSTRAP] Made admin:', email)
    res.json({ success: true, user: result.rows[0] })
  } catch (err: any) {
    console.error('[BOOTSTRAP] Error:', err.message)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// Mount admin routes (protected by requireAdmin middleware)
app.use('/api/admin', authenticateToken, requireAdmin, adminRoutes)

// ============================================
// START SERVER
// ============================================

const telegramOk = alertConfig.telegram.botToken && alertConfig.telegram.chatId
const discordOk = alertConfig.discord.webhookUrl
const redisOk = !!process.env.REDIS_URL

httpServer.listen(PORT, async () => {
  // Run all database migrations on startup
  await runMigrations()

  // Initialize Signal Bus
  try {
    await initSignalBus()
    console.log('[SERVER] Signal Bus initialized')
  } catch (err) {
    console.warn('[SERVER] Signal Bus init failed (Redis may not be available):', err)
  }

  // Set up signal forwarding to WebSocket clients
  onSignal('all', (signal: Signal) => {
    io.to('signals').emit('signal:new', signal)
  })

  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                   🏈 SportIntel Pro API 🏀                         ║
║               Agentic Network Edition v2.0                         ║
╠════════════════════════════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT}                              ║
║  WebSocket:    ws://localhost:${PORT}                                ║
╠════════════════════════════════════════════════════════════════════╣
║  SERVICES                                                          ║
║  Odds API:     ${ODDS_API_KEY ? '✅ Configured' : '❌ Missing'}                                   ║
║  Redis:        ${redisOk ? '✅ Connected' : '⚙️  Mock mode'}                                   ║
║  Signal Bus:   ${redisOk ? '✅ Active' : '⚙️  Local only'}                                   ║
║  Telegram:     ${telegramOk ? '✅ Connected' : '⚙️  Not configured'}                                   ║
║  Discord:      ${discordOk ? '✅ Connected' : '⚙️  Not configured'}                                   ║
║  Database:     ${process.env.DATABASE_URL ? '✅ Connected' : '⚙️  Not configured'}                                   ║
╠════════════════════════════════════════════════════════════════════╣
║  NETWORK ENDPOINTS                                                 ║
║  POST /api/network/register   - Register node                      ║
║  GET  /api/network/stats      - Network statistics                 ║
║  POST /api/signals/publish    - Publish signal                     ║
║  GET  /api/signals/recent     - Recent signals                     ║
╠════════════════════════════════════════════════════════════════════╣
║  REAL-TIME ENDPOINTS                                               ║
║  WS   /socket.io              - WebSocket connection               ║
║  GET  /api/arbitrage/live     - Current active arbs                ║
║  POST /api/arbitrage/scan     - Force immediate scan               ║
╠════════════════════════════════════════════════════════════════════╣
║  CONTEXT LEDGER                                                    ║
║  GET  /api/context/patterns   - Find betting patterns              ║
║  POST /api/context/game       - Save game context                  ║
╚════════════════════════════════════════════════════════════════════╝
  `)

  // Start background odds ingestion
  startIngestion()
  console.log('[SERVER] Background odds ingestion started')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...')
  stopIngestion()
  httpServer.close(() => {
    console.log('[SERVER] HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down...')
  stopIngestion()
  httpServer.close(() => {
    console.log('[SERVER] HTTP server closed')
    process.exit(0)
  })
})
