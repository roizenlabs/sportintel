/**
 * High-Performance Arbitrage Detection Engine
 *
 * O(n) algorithm instead of O(n²) - tracks best odds per outcome
 * Detects arbitrage opportunities within milliseconds of receiving new odds
 */

export interface BookOdds {
  bookmaker: string
  homeOdds: number      // American odds for home team
  awayOdds: number      // American odds for away team
  homeSpread?: number
  awaySpread?: number
  spreadHomeOdds?: number
  spreadAwayOdds?: number
  totalLine?: number
  overOdds?: number
  underOdds?: number
  timestamp: number     // When these odds were captured
}

export interface NormalizedOdds {
  gameId: string
  game: string
  homeTeam: string
  awayTeam: string
  sport: string
  startTime: string
  books: BookOdds[]
}

export interface ArbitrageOpportunity {
  id: string
  type: 'moneyline' | 'spread' | 'total' | 'prop'
  game: string
  gameId: string
  sport: string
  profit: number        // Percentage profit (e.g., 2.5 = 2.5%)
  book1: {
    name: string
    bet: string
    odds: number
    stake: number       // Percentage of total stake
    decimalOdds: number
  }
  book2: {
    name: string
    bet: string
    odds: number
    stake: number
    decimalOdds: number
  }
  totalImplied: number  // Combined implied probability
  detectedAt: number    // Timestamp of detection
  expiresAt: number     // Estimated expiry (odds likely to change)
}

// Convert American odds to decimal
export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1
  }
  return (100 / Math.abs(odds)) + 1
}

// Convert decimal odds to implied probability
export function impliedProbability(decimal: number): number {
  return 1 / decimal
}

// Calculate arbitrage from two decimal odds
export function calculateArbitrage(decimal1: number, decimal2: number): {
  isArbitrage: boolean
  profit: number
  stake1Pct: number
  stake2Pct: number
  totalImplied: number
} {
  const imp1 = impliedProbability(decimal1)
  const imp2 = impliedProbability(decimal2)
  const totalImplied = imp1 + imp2

  if (totalImplied < 1) {
    const profit = ((1 / totalImplied) - 1) * 100
    return {
      isArbitrage: true,
      profit: Math.round(profit * 100) / 100,
      stake1Pct: Math.round((imp1 / totalImplied) * 10000) / 100,
      stake2Pct: Math.round((imp2 / totalImplied) * 10000) / 100,
      totalImplied: Math.round(totalImplied * 10000) / 100
    }
  }

  return {
    isArbitrage: false,
    profit: 0,
    stake1Pct: 0,
    stake2Pct: 0,
    totalImplied: Math.round(totalImplied * 10000) / 100
  }
}

/**
 * O(n) Arbitrage Detection
 *
 * Instead of comparing every book pair (O(n²)), we:
 * 1. Track the best home odds and best away odds in single pass
 * 2. Only check if best home + best away creates arbitrage
 *
 * This reduces comparisons from n*(n-1) to just 2n
 */
export function detectMoneylineArbitrage(
  game: NormalizedOdds,
  minProfit = 0
): ArbitrageOpportunity | null {
  if (game.books.length < 2) return null

  // Track best odds for each side
  let bestHome = { book: '', odds: -Infinity, decimal: 0, american: 0 }
  let bestAway = { book: '', odds: -Infinity, decimal: 0, american: 0 }

  // Single pass O(n)
  for (const book of game.books) {
    if (!book.homeOdds || !book.awayOdds) continue

    const homeDecimal = americanToDecimal(book.homeOdds)
    const awayDecimal = americanToDecimal(book.awayOdds)

    if (homeDecimal > bestHome.decimal) {
      bestHome = {
        book: book.bookmaker,
        odds: homeDecimal,
        decimal: homeDecimal,
        american: book.homeOdds
      }
    }

    if (awayDecimal > bestAway.decimal) {
      bestAway = {
        book: book.bookmaker,
        odds: awayDecimal,
        decimal: awayDecimal,
        american: book.awayOdds
      }
    }
  }

  // Check for arbitrage
  if (bestHome.book === bestAway.book) return null // Same book, no arb
  if (bestHome.decimal === 0 || bestAway.decimal === 0) return null

  const result = calculateArbitrage(bestHome.decimal, bestAway.decimal)

  if (result.isArbitrage && result.profit >= minProfit) {
    return {
      id: `${game.gameId}-ml-${Date.now()}`,
      type: 'moneyline',
      game: game.game,
      gameId: game.gameId,
      sport: game.sport,
      profit: result.profit,
      book1: {
        name: bestHome.book,
        bet: `${game.homeTeam} ML`,
        odds: bestHome.american,
        stake: result.stake1Pct,
        decimalOdds: bestHome.decimal
      },
      book2: {
        name: bestAway.book,
        bet: `${game.awayTeam} ML`,
        odds: bestAway.american,
        stake: result.stake2Pct,
        decimalOdds: bestAway.decimal
      },
      totalImplied: result.totalImplied,
      detectedAt: Date.now(),
      expiresAt: Date.now() + 30000 // Assume 30s validity
    }
  }

  return null
}

/**
 * Detect spread arbitrage (same spread, different odds)
 */
export function detectSpreadArbitrage(
  game: NormalizedOdds,
  minProfit = 0
): ArbitrageOpportunity | null {
  // Group books by spread line
  const spreadGroups = new Map<number, BookOdds[]>()

  for (const book of game.books) {
    if (book.homeSpread === undefined || !book.spreadHomeOdds || !book.spreadAwayOdds) continue

    const spread = book.homeSpread
    if (!spreadGroups.has(spread)) {
      spreadGroups.set(spread, [])
    }
    spreadGroups.get(spread)!.push(book)
  }

  // Check each spread group for arbitrage
  for (const [spread, books] of spreadGroups) {
    if (books.length < 2) continue

    let bestHomeSpread = { book: '', decimal: 0, american: 0 }
    let bestAwaySpread = { book: '', decimal: 0, american: 0 }

    for (const book of books) {
      const homeDecimal = americanToDecimal(book.spreadHomeOdds!)
      const awayDecimal = americanToDecimal(book.spreadAwayOdds!)

      if (homeDecimal > bestHomeSpread.decimal) {
        bestHomeSpread = { book: book.bookmaker, decimal: homeDecimal, american: book.spreadHomeOdds! }
      }
      if (awayDecimal > bestAwaySpread.decimal) {
        bestAwaySpread = { book: book.bookmaker, decimal: awayDecimal, american: book.spreadAwayOdds! }
      }
    }

    if (bestHomeSpread.book === bestAwaySpread.book) continue

    const result = calculateArbitrage(bestHomeSpread.decimal, bestAwaySpread.decimal)

    if (result.isArbitrage && result.profit >= minProfit) {
      return {
        id: `${game.gameId}-spread-${spread}-${Date.now()}`,
        type: 'spread',
        game: game.game,
        gameId: game.gameId,
        sport: game.sport,
        profit: result.profit,
        book1: {
          name: bestHomeSpread.book,
          bet: `${game.homeTeam} ${spread > 0 ? '+' : ''}${spread}`,
          odds: bestHomeSpread.american,
          stake: result.stake1Pct,
          decimalOdds: bestHomeSpread.decimal
        },
        book2: {
          name: bestAwaySpread.book,
          bet: `${game.awayTeam} ${-spread > 0 ? '+' : ''}${-spread}`,
          odds: bestAwaySpread.american,
          stake: result.stake2Pct,
          decimalOdds: bestAwaySpread.decimal
        },
        totalImplied: result.totalImplied,
        detectedAt: Date.now(),
        expiresAt: Date.now() + 30000
      }
    }
  }

  return null
}

/**
 * Detect totals (over/under) arbitrage
 */
export function detectTotalsArbitrage(
  game: NormalizedOdds,
  minProfit = 0
): ArbitrageOpportunity | null {
  // Group books by total line
  const totalGroups = new Map<number, BookOdds[]>()

  for (const book of game.books) {
    if (book.totalLine === undefined || !book.overOdds || !book.underOdds) continue

    const total = book.totalLine
    if (!totalGroups.has(total)) {
      totalGroups.set(total, [])
    }
    totalGroups.get(total)!.push(book)
  }

  for (const [total, books] of totalGroups) {
    if (books.length < 2) continue

    let bestOver = { book: '', decimal: 0, american: 0 }
    let bestUnder = { book: '', decimal: 0, american: 0 }

    for (const book of books) {
      const overDecimal = americanToDecimal(book.overOdds!)
      const underDecimal = americanToDecimal(book.underOdds!)

      if (overDecimal > bestOver.decimal) {
        bestOver = { book: book.bookmaker, decimal: overDecimal, american: book.overOdds! }
      }
      if (underDecimal > bestUnder.decimal) {
        bestUnder = { book: book.bookmaker, decimal: underDecimal, american: book.underOdds! }
      }
    }

    if (bestOver.book === bestUnder.book) continue

    const result = calculateArbitrage(bestOver.decimal, bestUnder.decimal)

    if (result.isArbitrage && result.profit >= minProfit) {
      return {
        id: `${game.gameId}-total-${total}-${Date.now()}`,
        type: 'total',
        game: game.game,
        gameId: game.gameId,
        sport: game.sport,
        profit: result.profit,
        book1: {
          name: bestOver.book,
          bet: `Over ${total}`,
          odds: bestOver.american,
          stake: result.stake1Pct,
          decimalOdds: bestOver.decimal
        },
        book2: {
          name: bestUnder.book,
          bet: `Under ${total}`,
          odds: bestUnder.american,
          stake: result.stake2Pct,
          decimalOdds: bestUnder.decimal
        },
        totalImplied: result.totalImplied,
        detectedAt: Date.now(),
        expiresAt: Date.now() + 30000
      }
    }
  }

  return null
}

/**
 * Main arbitrage scanner - scans all market types
 */
export function scanForArbitrage(
  games: NormalizedOdds[],
  minProfit = 0
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []
  const startTime = performance.now()

  for (const game of games) {
    // Check moneyline
    const mlArb = detectMoneylineArbitrage(game, minProfit)
    if (mlArb) opportunities.push(mlArb)

    // Check spreads
    const spreadArb = detectSpreadArbitrage(game, minProfit)
    if (spreadArb) opportunities.push(spreadArb)

    // Check totals
    const totalsArb = detectTotalsArbitrage(game, minProfit)
    if (totalsArb) opportunities.push(totalsArb)
  }

  const elapsed = performance.now() - startTime
  console.log(`[ARB ENGINE] Scanned ${games.length} games, found ${opportunities.length} arbs in ${elapsed.toFixed(2)}ms`)

  // Sort by profit descending
  return opportunities.sort((a, b) => b.profit - a.profit)
}

/**
 * Deduplicate arbitrage opportunities
 * Prevents sending duplicate alerts for same opportunity
 */
const recentArbs = new Map<string, number>()
const ARB_DEDUP_WINDOW = 60000 // 1 minute

export function deduplicateArbitrage(arb: ArbitrageOpportunity): boolean {
  const key = `${arb.gameId}-${arb.type}-${arb.book1.name}-${arb.book2.name}`
  const lastSeen = recentArbs.get(key)

  if (lastSeen && Date.now() - lastSeen < ARB_DEDUP_WINDOW) {
    return false // Already sent recently
  }

  recentArbs.set(key, Date.now())

  // Cleanup old entries
  for (const [k, v] of recentArbs) {
    if (Date.now() - v > ARB_DEDUP_WINDOW) {
      recentArbs.delete(k)
    }
  }

  return true
}

export default {
  americanToDecimal,
  impliedProbability,
  calculateArbitrage,
  detectMoneylineArbitrage,
  detectSpreadArbitrage,
  detectTotalsArbitrage,
  scanForArbitrage,
  deduplicateArbitrage
}
