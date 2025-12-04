/**
 * Context Ledger - Historical Pattern Analysis
 *
 * Stores and queries:
 * - Line movement history
 * - Betting patterns (vectorized)
 * - Game context for pattern matching
 * - Signal outcomes for reputation
 */

import { db } from '../db/index.js'

// ============================================
// LINE MOVEMENT TRACKING
// ============================================

export interface LineMovement {
  gameId: string
  sport: string
  bookmaker: string
  market: string
  side: string
  oldLine?: number
  newLine?: number
  oldOdds?: number
  newOdds?: number
  delta: number
  velocity?: number
  timeToGame?: number
}

export async function recordLineMovement(movement: LineMovement): Promise<void> {
  try {
    await db.query(`
      INSERT INTO line_movements
      (game_id, sport, bookmaker, market, side, old_line, new_line, old_odds, new_odds, delta, velocity, time_to_game)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      movement.gameId,
      movement.sport,
      movement.bookmaker,
      movement.market,
      movement.side,
      movement.oldLine,
      movement.newLine,
      movement.oldOdds,
      movement.newOdds,
      movement.delta,
      movement.velocity,
      movement.timeToGame
    ])
  } catch (err) {
    // Table might not exist yet, log but don't crash
    console.error('[CONTEXT LEDGER] Failed to record line movement:', err)
  }
}

export async function getLineHistory(
  gameId: string,
  limit = 50
): Promise<LineMovement[]> {
  try {
    const result = await db.query(`
      SELECT * FROM line_movements
      WHERE game_id = $1
      ORDER BY captured_at DESC
      LIMIT $2
    `, [gameId, limit])
    return result.rows
  } catch (err) {
    return []
  }
}

export async function detectSteamMove(
  gameId: string,
  windowSeconds = 60
): Promise<{
  isSteam: boolean
  books: string[]
  totalDelta: number
  velocity: number
} | null> {
  try {
    const result = await db.query(`
      SELECT
        array_agg(DISTINCT bookmaker) as books,
        SUM(ABS(delta)) as total_delta,
        COUNT(*) as move_count
      FROM line_movements
      WHERE game_id = $1
        AND captured_at > NOW() - INTERVAL '${windowSeconds} seconds'
    `, [gameId])

    const row = result.rows[0]
    if (!row || !row.books) return null

    const isSteam = row.books.length >= 3 && parseFloat(row.total_delta) >= 2

    return {
      isSteam,
      books: row.books,
      totalDelta: parseFloat(row.total_delta),
      velocity: parseFloat(row.total_delta) / windowSeconds
    }
  } catch (err) {
    return null
  }
}

// ============================================
// PATTERN MATCHING
// ============================================

export interface BettingPattern {
  id: number
  name: string
  description: string
  conditions: Record<string, any>
  sampleSize: number
  coverRate: number
  avgRoi: number
  similarity?: number
}

/**
 * Find patterns matching current conditions
 * Note: Requires embeddings to be generated externally (via LLM)
 */
export async function findMatchingPatterns(
  conditions: Record<string, any>
): Promise<BettingPattern[]> {
  try {
    // For now, do simple JSON matching without vectors
    // TODO: Implement vector similarity when embeddings available
    const result = await db.query(`
      SELECT * FROM betting_patterns
      WHERE is_active = true
      ORDER BY sample_size DESC
      LIMIT 10
    `)

    // Filter by conditions locally
    return result.rows.filter(pattern => {
      const patternConditions = pattern.conditions
      for (const [key, value] of Object.entries(patternConditions)) {
        if (key.endsWith('_min') && conditions[key.replace('_min', '')] < value) {
          return false
        }
        if (key.endsWith('_max') && conditions[key.replace('_max', '')] > value) {
          return false
        }
      }
      return true
    }).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      conditions: row.conditions,
      sampleSize: row.sample_size,
      coverRate: parseFloat(row.cover_rate),
      avgRoi: parseFloat(row.avg_roi)
    }))
  } catch (err) {
    return []
  }
}

/**
 * Find similar patterns using vector similarity
 * Requires pgvector and embeddings
 */
export async function findSimilarPatterns(
  embedding: number[],
  threshold = 0.7,
  limit = 5
): Promise<BettingPattern[]> {
  try {
    const result = await db.query(`
      SELECT
        id, name, description, conditions, sample_size, cover_rate, avg_roi,
        1 - (embedding <=> $1::vector) as similarity
      FROM betting_patterns
      WHERE is_active = true
        AND 1 - (embedding <=> $1::vector) > $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `, [`[${embedding.join(',')}]`, threshold, limit])

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      conditions: row.conditions,
      sampleSize: row.sample_size,
      coverRate: parseFloat(row.cover_rate),
      avgRoi: parseFloat(row.avg_roi),
      similarity: parseFloat(row.similarity)
    }))
  } catch (err) {
    // pgvector might not be enabled
    console.error('[CONTEXT LEDGER] Vector search failed:', err)
    return []
  }
}

// ============================================
// GAME CONTEXT
// ============================================

export interface GameContext {
  gameId: string
  sport: string
  homeTeam: string
  awayTeam: string
  startTime: Date
  venue?: string
  weather?: {
    temp?: number
    wind?: number
    precipitation?: number
  }
  homeInjuries?: string[]
  awayInjuries?: string[]
  openingLine?: number
  currentLine?: number
  consensusPick?: 'home' | 'away'
  publicPercentage?: number
}

export async function saveGameContext(context: GameContext): Promise<void> {
  try {
    await db.query(`
      INSERT INTO game_context
      (game_id, sport, home_team, away_team, start_time, venue, weather,
       home_injuries, away_injuries, opening_line, current_line, consensus_pick, public_percentage)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (game_id) DO UPDATE SET
        current_line = EXCLUDED.current_line,
        consensus_pick = EXCLUDED.consensus_pick,
        public_percentage = EXCLUDED.public_percentage,
        weather = EXCLUDED.weather,
        updated_at = CURRENT_TIMESTAMP
    `, [
      context.gameId,
      context.sport,
      context.homeTeam,
      context.awayTeam,
      context.startTime,
      context.venue,
      JSON.stringify(context.weather || {}),
      JSON.stringify(context.homeInjuries || []),
      JSON.stringify(context.awayInjuries || []),
      context.openingLine,
      context.currentLine,
      context.consensusPick,
      context.publicPercentage
    ])
  } catch (err) {
    console.error('[CONTEXT LEDGER] Failed to save game context:', err)
  }
}

export async function getGameContext(gameId: string): Promise<GameContext | null> {
  try {
    const result = await db.query(
      'SELECT * FROM game_context WHERE game_id = $1',
      [gameId]
    )
    if (!result.rows[0]) return null

    const row = result.rows[0]
    return {
      gameId: row.game_id,
      sport: row.sport,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      startTime: row.start_time,
      venue: row.venue,
      weather: row.weather,
      homeInjuries: row.home_injuries,
      awayInjuries: row.away_injuries,
      openingLine: parseFloat(row.opening_line),
      currentLine: parseFloat(row.current_line),
      consensusPick: row.consensus_pick,
      publicPercentage: parseFloat(row.public_percentage)
    }
  } catch (err) {
    return null
  }
}

// ============================================
// SIGNAL OUTCOMES (for reputation)
// ============================================

export interface SignalOutcome {
  signalId: string
  signalType: string
  nodeId: string
  gameId?: string
  sport?: string
  prediction: string
  confidence: number
  outcome: 'correct' | 'incorrect' | 'push' | 'cancelled'
  actualResult?: string
  signalTime: Date
  outcomeTime: Date
}

export async function recordSignalOutcome(outcome: SignalOutcome): Promise<number> {
  try {
    // Calculate reputation delta
    let reputationDelta = 0
    switch (outcome.outcome) {
      case 'correct':
        reputationDelta = Math.round(outcome.confidence / 10)
        break
      case 'incorrect':
        reputationDelta = -Math.round(outcome.confidence / 10)
        break
      case 'push':
        reputationDelta = 0
        break
      case 'cancelled':
        reputationDelta = 0
        break
    }

    await db.query(`
      INSERT INTO signal_outcomes
      (signal_id, signal_type, node_id, game_id, sport, prediction, confidence,
       outcome, actual_result, signal_time, outcome_time, reputation_delta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      outcome.signalId,
      outcome.signalType,
      outcome.nodeId,
      outcome.gameId,
      outcome.sport,
      outcome.prediction,
      outcome.confidence,
      outcome.outcome,
      outcome.actualResult,
      outcome.signalTime,
      outcome.outcomeTime,
      reputationDelta
    ])

    // Update node reputation
    await db.query(`
      UPDATE network_nodes
      SET
        reputation = GREATEST(0, LEAST(100, reputation + $2)),
        signals_correct = signals_correct + CASE WHEN $3 = 'correct' THEN 1 ELSE 0 END,
        signals_incorrect = signals_incorrect + CASE WHEN $3 = 'incorrect' THEN 1 ELSE 0 END
      WHERE id = $1
    `, [outcome.nodeId, reputationDelta, outcome.outcome])

    return reputationDelta
  } catch (err) {
    console.error('[CONTEXT LEDGER] Failed to record outcome:', err)
    return 0
  }
}

export async function getNodeStats(nodeId: string): Promise<{
  reputation: number
  signalsPublished: number
  signalsCorrect: number
  signalsIncorrect: number
  accuracy: number
} | null> {
  try {
    const result = await db.query(
      'SELECT * FROM network_nodes WHERE id = $1',
      [nodeId]
    )
    if (!result.rows[0]) return null

    const row = result.rows[0]
    const total = row.signals_correct + row.signals_incorrect
    return {
      reputation: row.reputation,
      signalsPublished: row.signals_published,
      signalsCorrect: row.signals_correct,
      signalsIncorrect: row.signals_incorrect,
      accuracy: total > 0 ? row.signals_correct / total : 0
    }
  } catch (err) {
    return null
  }
}

// ============================================
// ANALYTICS QUERIES
// ============================================

export async function getPatternPerformance(
  sport?: string,
  days = 30
): Promise<Array<{
  patternName: string
  totalSignals: number
  correctSignals: number
  accuracy: number
  avgRoi: number
}>> {
  try {
    const result = await db.query(`
      SELECT
        bp.name as pattern_name,
        COUNT(so.id) as total_signals,
        SUM(CASE WHEN so.outcome = 'correct' THEN 1 ELSE 0 END) as correct_signals
      FROM signal_outcomes so
      JOIN betting_patterns bp ON so.prediction LIKE '%' || bp.name || '%'
      WHERE so.signal_time > NOW() - INTERVAL '${days} days'
        ${sport ? "AND so.sport = '" + sport + "'" : ''}
      GROUP BY bp.name
      ORDER BY COUNT(so.id) DESC
      LIMIT 20
    `)

    return result.rows.map(row => ({
      patternName: row.pattern_name,
      totalSignals: parseInt(row.total_signals),
      correctSignals: parseInt(row.correct_signals),
      accuracy: parseInt(row.total_signals) > 0
        ? parseInt(row.correct_signals) / parseInt(row.total_signals)
        : 0,
      avgRoi: 0 // TODO: Calculate actual ROI
    }))
  } catch (err) {
    return []
  }
}

export async function getTopNodes(limit = 10): Promise<Array<{
  nodeId: string
  reputation: number
  accuracy: number
  signalsPublished: number
}>> {
  try {
    const result = await db.query(`
      SELECT
        id as node_id,
        reputation,
        signals_published,
        signals_correct,
        signals_incorrect
      FROM network_nodes
      WHERE last_seen > NOW() - INTERVAL '7 days'
      ORDER BY reputation DESC
      LIMIT $1
    `, [limit])

    return result.rows.map(row => ({
      nodeId: row.node_id,
      reputation: row.reputation,
      signalsPublished: row.signals_published,
      accuracy: (row.signals_correct + row.signals_incorrect) > 0
        ? row.signals_correct / (row.signals_correct + row.signals_incorrect)
        : 0
    }))
  } catch (err) {
    return []
  }
}

export default {
  recordLineMovement,
  getLineHistory,
  detectSteamMove,
  findMatchingPatterns,
  findSimilarPatterns,
  saveGameContext,
  getGameContext,
  recordSignalOutcome,
  getNodeStats,
  getPatternPerformance,
  getTopNodes
}
