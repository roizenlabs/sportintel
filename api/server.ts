import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import { authenticateToken, optionalAuth, authHandlers, AuthRequest } from './auth.js'
import { db } from './db/index.js'

// Load .env from parent dir in dev, use Railway env vars in prod
dotenv.config({ path: '../.env' })
dotenv.config() // Also check current dir

const app = express()
const PORT = process.env.PORT || process.env.API_PORT || 8080

app.use(cors())
app.use(express.json())

const ODDS_API_KEY = process.env.ODDS_API_KEY
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet']

// Sport key mapping
const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl'
}

// Alert configuration (in-memory, persists during runtime)
const alertConfig = {
  telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN || '', chatId: process.env.TELEGRAM_CHAT_ID || '' },
  discord: { webhookUrl: process.env.DISCORD_WEBHOOK_URL || '' },
  settings: { arbitrageAlerts: true, steamMoveAlerts: true, minProfit: 0.5, minSteamChange: 15 }
}

// In-memory line tracking
interface OddsSnapshot {
  gameId: string
  game: string
  timestamp: Date
  odds: Record<string, { home: number; away: number; spread?: number }>
}
const lineHistory: OddsSnapshot[] = []
const MAX_SNAPSHOTS = 1000

// Affiliate Links (Revenue)
const AFFILIATE_LINKS: Record<string, string> = {
  draftkings: process.env.AFFILIATE_DRAFTKINGS || 'https://sportsbook.draftkings.com',
  fanduel: process.env.AFFILIATE_FANDUEL || 'https://sportsbook.fanduel.com',
  betmgm: process.env.AFFILIATE_BETMGM || 'https://sports.betmgm.com',
  caesars: process.env.AFFILIATE_CAESARS || 'https://sportsbook.caesars.com',
  pointsbet: process.env.AFFILIATE_POINTSBET || 'https://pointsbet.com',
  bovada: 'https://bovada.lv'
}

const SIGNUP_BONUSES: Record<string, string> = {
  draftkings: '$200 bonus',
  fanduel: '$200 bonus',
  betmgm: '$1500 bonus',
  caesars: '$1000 bonus',
  pointsbet: '$500 bonus'
}

function getAffiliateLink(bookmaker: string): string {
  const key = bookmaker.toLowerCase().replace(/[^a-z]/g, '')
  return AFFILIATE_LINKS[key] || ''
}

function getSignupBonus(bookmaker: string): string {
  const key = bookmaker.toLowerCase().replace(/[^a-z]/g, '')
  return SIGNUP_BONUSES[key] || 'Sign up bonus'
}

// Alert Functions
async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!alertConfig.telegram.botToken || !alertConfig.telegram.chatId) return false
  try {
    await axios.post(`https://api.telegram.org/bot${alertConfig.telegram.botToken}/sendMessage`, {
      chat_id: alertConfig.telegram.chatId,
      text: message,
      parse_mode: 'Markdown'
    })
    console.log('[TELEGRAM] Alert sent')
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
    console.log('[DISCORD] Alert sent')
    return true
  } catch (err: any) {
    console.error('[DISCORD] Send failed:', err.message)
    return false
  }
}

async function sendArbitrageAlerts(arb: any): Promise<void> {
  if (!alertConfig.settings.arbitrageAlerts) return
  if (arb.profit < alertConfig.settings.minProfit) return

  // Get affiliate links
  const link1 = getAffiliateLink(arb.book1.name)
  const link2 = getAffiliateLink(arb.book2.name)
  const bonus1 = getSignupBonus(arb.book1.name)
  const bonus2 = getSignupBonus(arb.book2.name)

  // Build affiliate section
  let affiliateSection = '\n\n💎 *New to these books?*'
  if (link1) affiliateSection += `\n• [${arb.book1.name} - ${bonus1}](${link1})`
  if (link2 && link2 !== link1) affiliateSection += `\n• [${arb.book2.name} - ${bonus2}](${link2})`

  // Telegram
  const telegramMsg = `
🎯 *ARBITRAGE FOUND*
*Game:* ${arb.game}
*Profit:* +${arb.profit.toFixed(2)}%

📊 *Bets:*
• ${arb.book1.name}: ${arb.book1.bet} @ ${arb.book1.odds > 0 ? '+' : ''}${arb.book1.odds} (${arb.book1.stake.toFixed(1)}%)
• ${arb.book2.name}: ${arb.book2.bet} @ ${arb.book2.odds > 0 ? '+' : ''}${arb.book2.odds} (${arb.book2.stake.toFixed(1)}%)

⏰ Act fast!${affiliateSection}
`
  sendTelegramAlert(telegramMsg)

  // Discord affiliate field
  let signupLinks = ''
  if (link1) signupLinks += `[${arb.book1.name} - ${bonus1}](${link1})\n`
  if (link2 && link2 !== link1) signupLinks += `[${arb.book2.name} - ${bonus2}](${link2})`

  const discordFields = [
    { name: 'Game', value: arb.game, inline: false },
    { name: 'Profit', value: `+${arb.profit.toFixed(2)}%`, inline: true },
    { name: arb.book1.name, value: `${arb.book1.bet}\n${arb.book1.odds > 0 ? '+' : ''}${arb.book1.odds}`, inline: true },
    { name: arb.book2.name, value: `${arb.book2.bet}\n${arb.book2.odds > 0 ? '+' : ''}${arb.book2.odds}`, inline: true }
  ]
  if (signupLinks) {
    discordFields.push({ name: '💎 New User Bonuses', value: signupLinks, inline: false })
  }

  const discordEmbed = {
    title: '🎯 Arbitrage Opportunity!',
    color: arb.profit >= 2 ? 0xff0000 : 0x00ff00,
    fields: discordFields,
    footer: { text: 'SportIntel' },
    timestamp: new Date().toISOString()
  }
  sendDiscordAlert(discordEmbed)
}

async function sendSteamMoveAlerts(move: any): Promise<void> {
  if (!alertConfig.settings.steamMoveAlerts) return
  if (Math.abs(move.change) < alertConfig.settings.minSteamChange) return

  const link = getAffiliateLink(move.book)
  const bonus = getSignupBonus(move.book)
  const affiliateSection = link ? `\n\n💎 [${move.book} - ${bonus}](${link})` : ''

  const telegramMsg = `
${move.change > 0 ? '📈' : '📉'} *STEAM MOVE*
*Game:* ${move.game}
*Book:* ${move.book}
*Line:* ${move.oldLine} → ${move.newLine} (${move.change > 0 ? '+' : ''}${move.change})${affiliateSection}
`
  sendTelegramAlert(telegramMsg)

  const discordFields = [
    { name: 'Game', value: move.game, inline: false },
    { name: 'Book', value: move.book, inline: true },
    { name: 'Movement', value: `${move.oldLine} → ${move.newLine}`, inline: true }
  ]
  if (link) {
    discordFields.push({ name: '💎 New User Bonus', value: `[${move.book} - ${bonus}](${link})`, inline: false })
  }

  const discordEmbed = {
    title: `${move.change > 0 ? '📈' : '📉'} Steam Move Detected`,
    color: Math.abs(move.change) >= 30 ? 0xff6600 : 0xffcc00,
    fields: discordFields,
    timestamp: new Date().toISOString()
  }
  sendDiscordAlert(discordEmbed)
}

// Helper: Convert American odds to decimal
function americanToDecimal(odds: number): number {
  return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1
}

// Helper: Calculate implied probability
function impliedProbability(decimal: number): number {
  return 1 / decimal
}

function getTimeDiff(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)}h ago`
}

// GET /api/odds/:sport - Live odds from all books
app.get('/api/odds/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const sportKey = SPORT_KEYS[sport]
    
    if (!sportKey) {
      return res.status(400).json({ error: 'Invalid sport. Use: nfl, nba, mlb, nhl' })
    }

    const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'h2h,spreads',
        oddsFormat: 'american',
        bookmakers: 'draftkings,fanduel,bovada'
      }
    })

    const games = response.data.map((game: any) => {
      const oddsData: Record<string, any> = {}
      
      for (const bookmaker of game.bookmakers || []) {
        const h2hMarket = bookmaker.markets?.find((m: any) => m.key === 'h2h')
        const spreadsMarket = bookmaker.markets?.find((m: any) => m.key === 'spreads')
        
        if (h2hMarket) {
          const homeOutcome = h2hMarket.outcomes.find((o: any) => o.name === game.home_team)
          const awayOutcome = h2hMarket.outcomes.find((o: any) => o.name === game.away_team)
          const spreadOutcome = spreadsMarket?.outcomes?.find((o: any) => o.name === game.home_team)
          
          oddsData[bookmaker.key] = {
            home: homeOutcome?.price || 0,
            away: awayOutcome?.price || 0,
            spread: spreadOutcome?.point || null
          }
        }
      }

      // Store snapshot for line tracking
      const gameName = `${game.away_team} @ ${game.home_team}`
      if (Object.keys(oddsData).length > 0) {
        lineHistory.push({ gameId: game.id, game: gameName, timestamp: new Date(), odds: oddsData })
        if (lineHistory.length > MAX_SNAPSHOTS) lineHistory.shift()
      }

      return {
        id: game.id,
        game: gameName,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: new Date(game.commence_time).toLocaleString('en-US', {
          weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
        }),
        odds: oddsData
      }
    })

    const remaining = response.headers['x-requests-remaining']
    console.log(`[${sport.toUpperCase()}] ${games.length} games. Remaining: ${remaining}`)
    res.json({ games, remaining: parseInt(remaining) || 0 })
  } catch (error: any) {
    console.error('Odds error:', error.response?.data || error.message)
    res.status(500).json({ error: 'Failed to fetch odds' })
  }
})

// GET /api/arbitrage/:sport - Find arbitrage opportunities
app.get('/api/arbitrage/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const minProfit = parseFloat(req.query.minProfit as string) || 0
    const sportKey = SPORT_KEYS[sport]
    
    if (!sportKey) return res.status(400).json({ error: 'Invalid sport' })

    const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
      params: { apiKey: ODDS_API_KEY, regions: 'us', markets: 'h2h', oddsFormat: 'american', bookmakers: 'draftkings,fanduel,bovada' }
    })

    const opportunities: any[] = []

    for (const game of response.data) {
      const bookOdds: { book: string; home: number; away: number }[] = []
      
      for (const bookmaker of game.bookmakers || []) {
        const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')
        if (h2h) {
          const home = h2h.outcomes.find((o: any) => o.name === game.home_team)?.price
          const away = h2h.outcomes.find((o: any) => o.name === game.away_team)?.price
          if (home && away) bookOdds.push({ book: bookmaker.key, home, away })
        }
      }

      // Check all book pairs for arbitrage
      for (let i = 0; i < bookOdds.length; i++) {
        for (let j = 0; j < bookOdds.length; j++) {
          if (i === j) continue
          
          const homeDecimal = americanToDecimal(bookOdds[i].home)
          const awayDecimal = americanToDecimal(bookOdds[j].away)
          const totalImplied = impliedProbability(homeDecimal) + impliedProbability(awayDecimal)
          
          if (totalImplied < 1) {
            const profit = ((1 / totalImplied) - 1) * 100
            if (profit >= minProfit) {
              const homeStake = (impliedProbability(homeDecimal) / totalImplied) * 100
              const awayStake = (impliedProbability(awayDecimal) / totalImplied) * 100
              
              const arb = {
                id: `${game.id}-${i}-${j}`,
                game: `${game.away_team} @ ${game.home_team}`,
                profit,
                book1: { name: bookOdds[i].book, bet: `${game.home_team} ML`, odds: bookOdds[i].home, stake: homeStake },
                book2: { name: bookOdds[j].book, bet: `${game.away_team} ML`, odds: bookOdds[j].away, stake: awayStake },
                expiresIn: 'Check live'
              }
              opportunities.push(arb)
              sendArbitrageAlerts(arb) // Send alert!
            }
          }
        }
      }
    }

    opportunities.sort((a, b) => b.profit - a.profit)
    console.log(`[ARB] Found ${opportunities.length} in ${sport.toUpperCase()}`)
    res.json({ opportunities, scannedGames: response.data.length })
  } catch (error: any) {
    res.status(500).json({ error: 'Arbitrage scan failed' })
  }
})

// GET /api/steam-moves/:sport - Detect significant line movements
app.get('/api/steam-moves/:sport', (req, res) => {
  const steamMoves: any[] = []
  
  // Group snapshots by game
  const gameSnapshots = new Map<string, OddsSnapshot[]>()
  for (const snap of lineHistory) {
    const existing = gameSnapshots.get(snap.gameId) || []
    existing.push(snap)
    gameSnapshots.set(snap.gameId, existing)
  }

  // Detect significant movements
  for (const [gameId, snapshots] of gameSnapshots) {
    if (snapshots.length < 2) continue
    
    const sorted = snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    
    for (const book of Object.keys(last.odds)) {
      const oldOdds = first.odds[book]
      const newOdds = last.odds[book]
      if (!oldOdds || !newOdds) continue
      
      const change = newOdds.home - oldOdds.home
      const absChange = Math.abs(change)
      
      if (absChange >= 10) {
        let significance: 'low' | 'medium' | 'high' | 'steam' = 'low'
        if (absChange >= 50) significance = 'steam'
        else if (absChange >= 30) significance = 'high'
        else if (absChange >= 15) significance = 'medium'
        
        const move = {
          gameId, game: last.game, book, oldLine: oldOdds.home, newLine: newOdds.home,
          change, time: getTimeDiff(last.timestamp), significance
        }
        steamMoves.push(move)
        if (significance !== 'low') sendSteamMoveAlerts(move) // Send alert!
      }
    }
  }
  
  steamMoves.sort((a, b) => {
    const order = { steam: 0, high: 1, medium: 2, low: 3 }
    return order[a.significance as keyof typeof order] - order[b.significance as keyof typeof order]
  })
  
  res.json({ steamMoves })
})

// GET /api/alerts/status - Get alert configuration status
app.get('/api/alerts/status', (req, res) => {
  res.json({
    telegram: { configured: !!(alertConfig.telegram.botToken && alertConfig.telegram.chatId) },
    discord: { configured: !!alertConfig.discord.webhookUrl },
    settings: alertConfig.settings
  })
})

// POST /api/alerts/telegram - Configure Telegram
app.post('/api/alerts/telegram', (req, res) => {
  const { botToken, chatId } = req.body
  if (botToken) alertConfig.telegram.botToken = botToken
  if (chatId) alertConfig.telegram.chatId = chatId
  res.json({ success: true, configured: !!(alertConfig.telegram.botToken && alertConfig.telegram.chatId) })
})

// POST /api/alerts/discord - Configure Discord
app.post('/api/alerts/discord', (req, res) => {
  const { webhookUrl } = req.body
  if (webhookUrl) alertConfig.discord.webhookUrl = webhookUrl
  res.json({ success: true, configured: !!alertConfig.discord.webhookUrl })
})

// POST /api/alerts/settings - Update alert settings
app.post('/api/alerts/settings', (req, res) => {
  const { arbitrageAlerts, steamMoveAlerts, minProfit, minSteamChange } = req.body
  if (arbitrageAlerts !== undefined) alertConfig.settings.arbitrageAlerts = arbitrageAlerts
  if (steamMoveAlerts !== undefined) alertConfig.settings.steamMoveAlerts = steamMoveAlerts
  if (minProfit !== undefined) alertConfig.settings.minProfit = minProfit
  if (minSteamChange !== undefined) alertConfig.settings.minSteamChange = minSteamChange
  res.json({ success: true, settings: alertConfig.settings })
})

// POST /api/alerts/test - Test alert connections
app.post('/api/alerts/test', async (req, res) => {
  const { channel } = req.body
  const results: any = {}
  
  if (channel === 'telegram' || channel === 'all') {
    results.telegram = await sendTelegramAlert('🧪 *Test Alert*\n\nSportIntel is connected and working!')
  }
  if (channel === 'discord' || channel === 'all') {
    results.discord = await sendDiscordAlert({
      title: '🧪 Test Alert',
      description: 'SportIntel is connected and working!',
      color: 0x00ff00,
      timestamp: new Date().toISOString()
    })
  }
  
  res.json({ success: true, results })
})

// GET /api/health - Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), lineHistorySize: lineHistory.length })
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
// PLAYER PROPS ROUTES
// ============================================

const PROP_MARKETS: Record<string, string[]> = {
  nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  nfl: ['player_pass_yds', 'player_rush_yds', 'player_reception_yds', 'player_receptions', 'player_anytime_td'],
  mlb: ['batter_hits', 'batter_total_bases', 'pitcher_strikeouts'],
  nhl: ['player_points', 'player_shots_on_goal', 'goalie_saves']
}

// GET /api/props/:sport - Get player props
app.get('/api/props/:sport', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const sportKey = SPORT_KEYS[sport]
    const { player, market } = req.query

    if (!sportKey) {
      return res.status(400).json({ error: 'Invalid sport. Use: nfl, nba, mlb, nhl' })
    }

    const markets = market ? [market as string] : (PROP_MARKETS[sport] || ['player_points'])
    const allProps: any[] = []

    for (const mkt of markets.slice(0, 3)) { // Limit to 3 markets to save API calls
      try {
        const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
          params: {
            apiKey: ODDS_API_KEY,
            regions: 'us',
            markets: mkt,
            oddsFormat: 'american',
            bookmakers: BOOKMAKERS.join(',')
          }
        })

        for (const event of response.data) {
          const game = `${event.away_team} @ ${event.home_team}`

          for (const bookmaker of event.bookmakers || []) {
            for (const market of bookmaker.markets || []) {
              const playerOutcomes: Map<string, any> = new Map()

              for (const outcome of market.outcomes || []) {
                if (!outcome.description) continue
                const key = `${outcome.description}-${outcome.point}`
                const existing = playerOutcomes.get(key) || { line: outcome.point || 0 }

                if (outcome.name === 'Over') existing.over = outcome.price
                else if (outcome.name === 'Under') existing.under = outcome.price
                existing.player = outcome.description

                playerOutcomes.set(key, existing)
              }

              for (const [, data] of playerOutcomes) {
                if (!data.over && !data.under) continue
                if (player && !data.player.toLowerCase().includes((player as string).toLowerCase())) continue

                allProps.push({
                  player: data.player,
                  game,
                  gameId: event.id,
                  market: mkt,
                  marketLabel: formatMarketLabel(mkt),
                  line: data.line,
                  overOdds: data.over || 0,
                  underOdds: data.under || 0,
                  bookmaker: bookmaker.key
                })
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch ${mkt}:`, err)
      }
    }

    // Group props for comparison
    const grouped: Map<string, any[]> = new Map()
    for (const prop of allProps) {
      const key = `${prop.player}|${prop.market}|${prop.line}`
      const existing = grouped.get(key) || []
      existing.push(prop)
      grouped.set(key, existing)
    }

    const comparisons = []
    for (const [, props] of grouped) {
      if (props.length < 1) continue
      const first = props[0]
      const books = props.map(p => ({ name: p.bookmaker, over: p.overOdds, under: p.underOdds }))

      let bestOver = { book: '', odds: -Infinity }
      let bestUnder = { book: '', odds: -Infinity }
      for (const b of books) {
        if (b.over > bestOver.odds) bestOver = { book: b.name, odds: b.over }
        if (b.under > bestUnder.odds) bestUnder = { book: b.name, odds: b.under }
      }

      comparisons.push({
        player: first.player,
        game: first.game,
        market: first.marketLabel,
        line: first.line,
        books,
        bestOver,
        bestUnder
      })
    }

    res.json({ props: comparisons, markets: PROP_MARKETS[sport] || [] })
  } catch (error: any) {
    console.error('Props error:', error.message)
    res.status(500).json({ error: 'Failed to fetch props' })
  }
})

// GET /api/props/:sport/arbitrage - Find prop arbitrage
app.get('/api/props/:sport/arbitrage', async (req, res) => {
  try {
    const sport = req.params.sport.toLowerCase()
    const sportKey = SPORT_KEYS[sport]
    const minProfit = parseFloat(req.query.minProfit as string) || 0

    if (!sportKey) return res.status(400).json({ error: 'Invalid sport' })

    const markets = PROP_MARKETS[sport] || ['player_points']
    const allProps: any[] = []

    for (const mkt of markets.slice(0, 2)) {
      try {
        const response = await axios.get(`${ODDS_API_BASE}/sports/${sportKey}/odds`, {
          params: { apiKey: ODDS_API_KEY, regions: 'us', markets: mkt, oddsFormat: 'american', bookmakers: BOOKMAKERS.join(',') }
        })

        for (const event of response.data) {
          for (const bookmaker of event.bookmakers || []) {
            for (const market of bookmaker.markets || []) {
              const playerOutcomes: Map<string, any> = new Map()
              for (const outcome of market.outcomes || []) {
                if (!outcome.description) continue
                const key = `${outcome.description}-${outcome.point}`
                const existing = playerOutcomes.get(key) || { line: outcome.point || 0, player: outcome.description }
                if (outcome.name === 'Over') existing.over = outcome.price
                else if (outcome.name === 'Under') existing.under = outcome.price
                playerOutcomes.set(key, existing)
              }

              for (const [, data] of playerOutcomes) {
                allProps.push({
                  player: data.player,
                  game: `${event.away_team} @ ${event.home_team}`,
                  market: mkt,
                  line: data.line,
                  overOdds: data.over || 0,
                  underOdds: data.under || 0,
                  bookmaker: bookmaker.key
                })
              }
            }
          }
        }
      } catch (err) {
        // continue
      }
    }

    // Find arbitrage
    const grouped: Map<string, any[]> = new Map()
    for (const prop of allProps) {
      const key = `${prop.player}|${prop.market}|${prop.line}`
      const existing = grouped.get(key) || []
      existing.push(prop)
      grouped.set(key, existing)
    }

    const opportunities = []
    for (const [, props] of grouped) {
      if (props.length < 2) continue

      let bestOver: any = null, bestUnder: any = null
      for (const p of props) {
        if (p.overOdds && (!bestOver || p.overOdds > bestOver.overOdds)) bestOver = p
        if (p.underOdds && (!bestUnder || p.underOdds > bestUnder.underOdds)) bestUnder = p
      }

      if (!bestOver || !bestUnder || bestOver.bookmaker === bestUnder.bookmaker) continue

      const overDec = bestOver.overOdds > 0 ? (bestOver.overOdds / 100) + 1 : (100 / Math.abs(bestOver.overOdds)) + 1
      const underDec = bestUnder.underOdds > 0 ? (bestUnder.underOdds / 100) + 1 : (100 / Math.abs(bestUnder.underOdds)) + 1
      const totalImplied = (1 / overDec) + (1 / underDec)

      if (totalImplied < 1) {
        const profit = ((1 / totalImplied) - 1) * 100
        if (profit >= minProfit) {
          opportunities.push({
            player: bestOver.player,
            game: bestOver.game,
            market: formatMarketLabel(bestOver.market),
            line: bestOver.line,
            overBook: bestOver.bookmaker,
            overOdds: bestOver.overOdds,
            underBook: bestUnder.bookmaker,
            underOdds: bestUnder.underOdds,
            profit
          })
        }
      }
    }

    opportunities.sort((a, b) => b.profit - a.profit)
    res.json({ opportunities })
  } catch (error: any) {
    res.status(500).json({ error: 'Prop arbitrage scan failed' })
  }
})

// ============================================
// WATCHLIST ROUTES (Protected)
// ============================================

// GET /api/watchlist - Get user's watchlist
app.get('/api/watchlist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sport = req.query.sport as string | undefined
    const watchlist = await db.getWatchlist(req.user!.id, sport)
    res.json({ watchlist })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get watchlist' })
  }
})

// POST /api/watchlist - Add to watchlist
app.post('/api/watchlist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { playerName, sport, propType, targetLine, alertOnEdge, notes } = req.body

    if (!playerName || !sport || !propType) {
      return res.status(400).json({ error: 'playerName, sport, and propType required' })
    }

    const item = await db.addToWatchlist(req.user!.id, {
      playerName, sport, propType, targetLine, alertOnEdge, notes
    })

    res.status(201).json({ item })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add to watchlist' })
  }
})

// DELETE /api/watchlist/:id - Remove from watchlist
app.delete('/api/watchlist/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await db.removeFromWatchlist(req.user!.id, parseInt(req.params.id))
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove from watchlist' })
  }
})

// PUT /api/watchlist/:id - Update watchlist item
app.put('/api/watchlist/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const item = await db.updateWatchlistItem(req.user!.id, parseInt(req.params.id), req.body)
    res.json({ item })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update watchlist' })
  }
})

// ============================================
// USER PREFERENCES (Protected)
// ============================================

app.get('/api/user/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const prefs = await db.getPreferences(req.user!.id)
    res.json({ preferences: prefs })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get preferences' })
  }
})

app.put('/api/user/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const prefs = await db.updatePreferences(req.user!.id, req.body)
    res.json({ preferences: prefs })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// Helper function
function formatMarketLabel(market: string): string {
  const labels: Record<string, string> = {
    'player_points': 'Points', 'player_rebounds': 'Rebounds', 'player_assists': 'Assists',
    'player_threes': '3-Pointers', 'player_points_rebounds_assists': 'Pts+Reb+Ast',
    'player_pass_yds': 'Pass Yards', 'player_rush_yds': 'Rush Yards',
    'player_reception_yds': 'Rec Yards', 'player_receptions': 'Receptions',
    'player_anytime_td': 'Anytime TD', 'batter_hits': 'Hits',
    'batter_total_bases': 'Total Bases', 'pitcher_strikeouts': 'Strikeouts',
    'player_shots_on_goal': 'Shots on Goal', 'goalie_saves': 'Saves'
  }
  return labels[market] || market
}

// Start server
const telegramOk = alertConfig.telegram.botToken && alertConfig.telegram.chatId
const discordOk = alertConfig.discord.webhookUrl

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   🏈 SportIntel API 🏀                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                              ║
║  Odds API: ${ODDS_API_KEY ? '✅ Configured' : '❌ Missing'}                                ║
║  Telegram: ${telegramOk ? '✅ Connected' : '⚙️ Not configured'}                               ║
║  Discord: ${discordOk ? '✅ Connected' : '⚙️ Not configured'}                                ║
║  Database: ${process.env.DATABASE_URL ? '✅ Connected' : '⚙️ Not configured'}                               ║
╠═══════════════════════════════════════════════════════════════╣
║  ODDS & ARBITRAGE                                             ║
║  GET  /api/odds/:sport        - Live odds                     ║
║  GET  /api/arbitrage/:sport   - Arbitrage scanner             ║
║  GET  /api/steam-moves/:sport - Steam move alerts             ║
╠═══════════════════════════════════════════════════════════════╣
║  PLAYER PROPS                                                 ║
║  GET  /api/props/:sport       - Player props comparison       ║
║  GET  /api/props/:sport/arbitrage - Prop arbitrage            ║
╠═══════════════════════════════════════════════════════════════╣
║  AUTH                                                         ║
║  POST /api/auth/register      - Create account                ║
║  POST /api/auth/login         - Login                         ║
║  GET  /api/auth/me            - Get current user              ║
╠═══════════════════════════════════════════════════════════════╣
║  WATCHLIST (Auth required)                                    ║
║  GET  /api/watchlist          - Get watchlist                 ║
║  POST /api/watchlist          - Add to watchlist              ║
╚═══════════════════════════════════════════════════════════════╝
  `)
})
