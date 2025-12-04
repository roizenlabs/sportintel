/**
 * Odds Ingestion Service
 *
 * Background worker that:
 * 1. Polls odds APIs at configured intervals
 * 2. Normalizes data across providers
 * 3. Caches in Redis
 * 4. Triggers arbitrage detection
 * 5. Publishes updates via WebSocket
 */

import axios from 'axios'
import { cache, getRedis } from './redis.js'
import { scanForArbitrage, deduplicateArbitrage, type NormalizedOdds, type ArbitrageOpportunity } from './arbitrage-engine.js'
import { broadcastArbitrage, broadcastOddsUpdate } from './websocket.js'

// Configuration
const ODDS_API_KEY = process.env.ODDS_API_KEY
const ODDSJAM_API_KEY = process.env.ODDSJAM_API_KEY
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

// Polling intervals (in ms)
const POLL_INTERVAL_ACTIVE = 5000    // 5 seconds during active hours
const POLL_INTERVAL_IDLE = 30000     // 30 seconds during idle hours
const ACTIVE_HOURS_START = 10        // 10 AM local
const ACTIVE_HOURS_END = 24          // Midnight

// Sport configuration
const SPORTS = {
  nfl: { key: 'americanfootball_nfl', active: true },
  nba: { key: 'basketball_nba', active: true },
  mlb: { key: 'baseball_mlb', active: true },
  nhl: { key: 'icehockey_nhl', active: true }
}

const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 'bovada']

// State
let isRunning = false
let pollIntervalId: NodeJS.Timeout | null = null
let lastPollTime = new Map<string, number>()
let apiRequestCount = 0
let arbsFoundToday = 0

// Alert callbacks
type AlertCallback = (arb: ArbitrageOpportunity) => Promise<void>
const alertCallbacks: AlertCallback[] = []

export function onArbitrageFound(callback: AlertCallback): void {
  alertCallbacks.push(callback)
}

/**
 * Get current poll interval based on time of day
 */
function getCurrentPollInterval(): number {
  const hour = new Date().getHours()
  if (hour >= ACTIVE_HOURS_START && hour < ACTIVE_HOURS_END) {
    return POLL_INTERVAL_ACTIVE
  }
  return POLL_INTERVAL_IDLE
}

/**
 * Fetch odds from The Odds API
 */
async function fetchOddsAPI(sportKey: string): Promise<any[]> {
  if (!ODDS_API_KEY) {
    console.warn('[INGESTION] No ODDS_API_KEY configured')
    return []
  }

  try {
    const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american',
        bookmakers: BOOKMAKERS.join(',')
      },
      timeout: 10000
    })

    apiRequestCount++
    const remaining = response.headers['x-requests-remaining']
    console.log(`[INGESTION] Fetched ${sportKey}, ${response.data.length} games, ${remaining} API calls remaining`)

    return response.data
  } catch (err: any) {
    if (err.response?.status === 429) {
      console.error('[INGESTION] Rate limited by Odds API')
    } else {
      console.error(`[INGESTION] Odds API error for ${sportKey}:`, err.message)
    }
    return []
  }
}

/**
 * Fetch odds from OddsJam API (premium source)
 */
async function fetchOddsJam(sport: string): Promise<any[]> {
  if (!ODDSJAM_API_KEY) {
    return [] // Not configured
  }

  try {
    // OddsJam API structure - adjust based on actual API docs
    const response = await axios.get(`https://api.oddsjam.com/v2/odds`, {
      params: {
        sport: sport,
        api_key: ODDSJAM_API_KEY
      },
      timeout: 10000
    })

    return response.data?.odds || []
  } catch (err: any) {
    console.error(`[INGESTION] OddsJam error for ${sport}:`, err.message)
    return []
  }
}

/**
 * Normalize odds data from different sources
 */
function normalizeOddsData(rawData: any[], sport: string, source: string): NormalizedOdds[] {
  const normalized: NormalizedOdds[] = []

  for (const game of rawData) {
    const books: any[] = []

    for (const bookmaker of game.bookmakers || []) {
      const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')
      const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')
      const totals = bookmaker.markets?.find((m: any) => m.key === 'totals')

      if (!h2h) continue

      const homeOutcome = h2h.outcomes.find((o: any) => o.name === game.home_team)
      const awayOutcome = h2h.outcomes.find((o: any) => o.name === game.away_team)

      const bookOdds: any = {
        bookmaker: bookmaker.key,
        homeOdds: homeOutcome?.price || 0,
        awayOdds: awayOutcome?.price || 0,
        timestamp: Date.now()
      }

      // Add spreads if available
      if (spreads) {
        const homeSpread = spreads.outcomes.find((o: any) => o.name === game.home_team)
        const awaySpread = spreads.outcomes.find((o: any) => o.name === game.away_team)
        if (homeSpread && awaySpread) {
          bookOdds.homeSpread = homeSpread.point
          bookOdds.awaySpread = awaySpread.point
          bookOdds.spreadHomeOdds = homeSpread.price
          bookOdds.spreadAwayOdds = awaySpread.price
        }
      }

      // Add totals if available
      if (totals) {
        const over = totals.outcomes.find((o: any) => o.name === 'Over')
        const under = totals.outcomes.find((o: any) => o.name === 'Under')
        if (over && under) {
          bookOdds.totalLine = over.point
          bookOdds.overOdds = over.price
          bookOdds.underOdds = under.price
        }
      }

      books.push(bookOdds)
    }

    if (books.length > 0) {
      normalized.push({
        gameId: game.id,
        game: `${game.away_team} @ ${game.home_team}`,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        sport: sport,
        startTime: game.commence_time,
        books
      })
    }
  }

  return normalized
}

/**
 * Main polling function
 */
async function pollOdds(): Promise<void> {
  const startTime = performance.now()
  const allGames: NormalizedOdds[] = []

  // Poll all active sports in parallel
  const sportPromises = Object.entries(SPORTS)
    .filter(([_, config]) => config.active)
    .map(async ([sport, config]) => {
      // Check if we polled this sport recently
      const lastPoll = lastPollTime.get(sport) || 0
      const minInterval = getCurrentPollInterval()

      if (Date.now() - lastPoll < minInterval) {
        // Use cached data
        const cached = await cache.getOdds(sport)
        if (cached) return cached
      }

      // Fetch fresh data
      const rawData = await fetchOddsAPI(config.key)
      const normalized = normalizeOddsData(rawData, sport, 'odds-api')

      // Cache the data
      await cache.setOdds(sport, normalized, 10)
      lastPollTime.set(sport, Date.now())

      // Broadcast odds update
      broadcastOddsUpdate(sport, { games: normalized, timestamp: Date.now() })

      return normalized
    })

  const results = await Promise.all(sportPromises)
  for (const games of results) {
    if (games) allGames.push(...games)
  }

  // Run arbitrage detection
  const arbs = scanForArbitrage(allGames, 0.5) // Min 0.5% profit

  // Process new arbitrages
  for (const arb of arbs) {
    if (deduplicateArbitrage(arb)) {
      arbsFoundToday++

      // Broadcast via WebSocket
      broadcastArbitrage(arb)

      // Publish to Redis for other instances
      await cache.publishArbitrage(arb)

      // Call alert callbacks (Telegram, Discord, etc.)
      for (const callback of alertCallbacks) {
        try {
          await callback(arb)
        } catch (err) {
          console.error('[INGESTION] Alert callback error:', err)
        }
      }

      console.log(`[ARB] 🎯 ${arb.game}: +${arb.profit}% (${arb.book1.name} vs ${arb.book2.name})`)
    }
  }

  // Store active arbs in cache
  await cache.setArbitrages(arbs, 30)

  const elapsed = performance.now() - startTime
  console.log(`[INGESTION] Poll complete: ${allGames.length} games, ${arbs.length} arbs in ${elapsed.toFixed(0)}ms`)
}

/**
 * Start the ingestion service
 */
export function startIngestion(): void {
  if (isRunning) {
    console.log('[INGESTION] Already running')
    return
  }

  isRunning = true
  console.log('[INGESTION] Starting odds ingestion service...')

  // Initial poll
  pollOdds().catch(err => console.error('[INGESTION] Initial poll error:', err))

  // Set up polling interval
  const scheduleNextPoll = () => {
    const interval = getCurrentPollInterval()
    pollIntervalId = setTimeout(async () => {
      if (!isRunning) return

      try {
        await pollOdds()
      } catch (err) {
        console.error('[INGESTION] Poll error:', err)
      }

      scheduleNextPoll()
    }, interval)
  }

  scheduleNextPoll()

  console.log(`[INGESTION] Service started, polling every ${getCurrentPollInterval() / 1000}s`)
}

/**
 * Stop the ingestion service
 */
export function stopIngestion(): void {
  isRunning = false

  if (pollIntervalId) {
    clearTimeout(pollIntervalId)
    pollIntervalId = null
  }

  console.log('[INGESTION] Service stopped')
}

/**
 * Get service stats
 */
export function getIngestionStats(): {
  isRunning: boolean
  apiRequestCount: number
  arbsFoundToday: number
  lastPollTimes: Record<string, number>
  pollInterval: number
} {
  return {
    isRunning,
    apiRequestCount,
    arbsFoundToday,
    lastPollTimes: Object.fromEntries(lastPollTime),
    pollInterval: getCurrentPollInterval()
  }
}

/**
 * Force an immediate poll (for manual refresh)
 */
export async function forcePoll(): Promise<{ games: number; arbs: number }> {
  // Clear last poll times to force fresh fetch
  lastPollTime.clear()

  const allGames: NormalizedOdds[] = []

  for (const [sport, config] of Object.entries(SPORTS)) {
    if (!config.active) continue

    const rawData = await fetchOddsAPI(config.key)
    const normalized = normalizeOddsData(rawData, sport, 'odds-api')
    allGames.push(...normalized)

    await cache.setOdds(sport, normalized, 10)
    lastPollTime.set(sport, Date.now())
  }

  const arbs = scanForArbitrage(allGames, 0)

  return {
    games: allGames.length,
    arbs: arbs.length
  }
}

/**
 * Reset daily stats (call at midnight)
 */
export function resetDailyStats(): void {
  arbsFoundToday = 0
  apiRequestCount = 0
  console.log('[INGESTION] Daily stats reset')
}

export default {
  startIngestion,
  stopIngestion,
  getIngestionStats,
  forcePoll,
  resetDailyStats,
  onArbitrageFound
}
