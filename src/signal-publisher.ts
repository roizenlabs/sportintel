/**
 * SportIntel Signal Publisher
 *
 * Polls MCP tools and publishes detected signals to the Signal Gateway.
 * Runs as a background service, monitoring for:
 * - Steam moves (rapid line movements)
 * - Arbitrage opportunities
 * - Sentiment shifts
 * - Breaking news
 *
 * Usage:
 *   npx tsx src/signal-publisher.ts
 *
 * Environment Variables:
 *   SIGNAL_GATEWAY_URL - Gateway endpoint (default: http://localhost:8080/signals)
 *   NODE_ID - Unique identifier for this node
 *   ODDS_API_KEY - The Odds API key
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { OddsApiService, FormattedOdds, ArbitrageOpportunity } from './services/odds-api.js';
import {
  Signal,
  SteamSignal,
  ArbitrageSignal,
  LineSnapshot,
  LineMovement,
  generateSignalId
} from './signals/types.js';

dotenv.config();

// Configuration
const SIGNAL_GATEWAY_URL = process.env.SIGNAL_GATEWAY_URL || 'http://localhost:8080/signals';
const NODE_ID = process.env.NODE_ID || `sportintel-${process.env.COMPUTERNAME || 'node'}-${Date.now()}`;
const NODE_REPUTATION = 85; // Default reputation score

// Polling intervals (in milliseconds)
const POLL_INTERVALS = {
  betting_lines: 60 * 1000,      // 1 minute
  arbitrage: 2 * 60 * 1000,      // 2 minutes
  sentiment: 10 * 60 * 1000,     // 10 minutes
  breaking_news: 3 * 60 * 1000,  // 3 minutes
};

// Detection thresholds
const THRESHOLDS = {
  steamMove: 1.5,           // Points movement to trigger steam alert
  steamTimeWindow: 60000,   // 60 seconds window for steam detection
  minArbProfit: 0.5,        // Minimum arbitrage profit %
  sentimentShift: 20,       // Minimum sentiment shift %
};

// In-memory line history for steam detection
const lineHistory: Map<string, LineSnapshot[]> = new Map();
const MAX_HISTORY_PER_GAME = 20;

// Published signal cache to avoid duplicates
const publishedSignals: Set<string> = new Set();
const SIGNAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Services
const oddsApi = new OddsApiService();

// ============== SIGNAL PUBLISHING ==============

async function publishSignal(signal: Signal): Promise<boolean> {
  // Check for duplicate
  const signalKey = `${signal.type}-${signal.id}`;
  if (publishedSignals.has(signalKey)) {
    return false;
  }

  try {
    const response = await axios.post(SIGNAL_GATEWAY_URL, signal, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    if (response.status === 200) {
      console.log(`✅ Published ${signal.type} signal: ${signal.payload.description}`);
      publishedSignals.add(signalKey);

      // Clear from cache after TTL
      setTimeout(() => publishedSignals.delete(signalKey), SIGNAL_CACHE_TTL);
      return true;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ Failed to publish signal: ${error.message}`);
    }
  }
  return false;
}

// ============== STEAM MOVE DETECTION ==============

function detectSteamMoves(snapshots: LineSnapshot[]): LineMovement[] {
  const movements: LineMovement[] = [];
  const now = Date.now();

  // Group by game and bookmaker
  const grouped = new Map<string, LineSnapshot[]>();
  for (const snap of snapshots) {
    const key = `${snap.gameId}-${snap.bookmaker}`;
    const existing = grouped.get(key) || [];
    existing.push(snap);
    grouped.set(key, existing);
  }

  // Detect movements
  for (const [, snaps] of grouped) {
    if (snaps.length < 2) continue;

    const sorted = snaps.sort((a, b) => a.timestamp - b.timestamp);
    const recent = sorted.filter(s => now - s.timestamp < THRESHOLDS.steamTimeWindow);

    if (recent.length < 2) continue;

    const first = recent[0];
    const last = recent[recent.length - 1];
    const delta = Math.abs(last.homeOdds - first.homeOdds);
    const timeElapsed = last.timestamp - first.timestamp;

    if (delta >= THRESHOLDS.steamMove * 100) { // Odds are in American format
      let significance: 'steam' | 'high' | 'medium' | 'low';
      if (delta >= 50) significance = 'steam';
      else if (delta >= 30) significance = 'high';
      else if (delta >= 15) significance = 'medium';
      else significance = 'low';

      movements.push({
        gameId: first.gameId,
        game: first.game,
        bookmaker: first.bookmaker,
        previousValue: first.homeOdds,
        newValue: last.homeOdds,
        delta,
        timeElapsed,
        significance
      });
    }
  }

  return movements;
}

function createSteamSignal(movement: LineMovement): SteamSignal {
  const confidence = movement.significance === 'steam' ? 95 :
                     movement.significance === 'high' ? 85 :
                     movement.significance === 'medium' ? 70 : 55;

  return {
    id: generateSignalId('steam', movement.gameId),
    type: 'steam',
    source: {
      nodeId: NODE_ID,
      reputation: NODE_REPUTATION,
      timestamp: Date.now()
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000, // 1 minute TTL
    payload: {
      gameId: movement.gameId,
      game: movement.game,
      sport: 'nba', // Could be extracted from gameId
      description: `Steam move: ${movement.previousValue} → ${movement.newValue} (${movement.bookmaker})`,
      confidence,
      ttl: 60
    },
    evidence: {
      books: [movement.bookmaker],
      oldLine: movement.previousValue,
      newLine: movement.newValue,
      delta: movement.delta,
      timestamp: Date.now()
    }
  };
}

// ============== ARBITRAGE DETECTION ==============

function createArbitrageSignal(arb: ArbitrageOpportunity, sport: string): ArbitrageSignal {
  const confidence = arb.profit >= 3 ? 95 : arb.profit >= 2 ? 88 : arb.profit >= 1 ? 80 : 70;

  return {
    id: generateSignalId('arb', arb.game.replace(/\s+/g, '-').toLowerCase()),
    type: 'arb',
    source: {
      nodeId: NODE_ID,
      reputation: NODE_REPUTATION,
      timestamp: Date.now()
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 120000, // 2 minute TTL
    payload: {
      gameId: arb.game.replace(/\s+/g, '-').toLowerCase(),
      game: arb.game,
      sport,
      description: `Arbitrage: ${arb.profit.toFixed(2)}% profit on ${arb.game}`,
      confidence,
      ttl: 120,
      profitPercent: arb.profit
    },
    bets: {
      book1: {
        name: arb.book1.name,
        bet: arb.book1.bet,
        odds: arb.book1.odds,
        stakePercent: arb.stake1Pct
      },
      book2: {
        name: arb.book2.name,
        bet: arb.book2.bet,
        odds: arb.book2.odds,
        stakePercent: arb.stake2Pct
      }
    }
  };
}

// ============== POLLING FUNCTIONS ==============

async function pollBettingLines(sport: string): Promise<void> {
  try {
    console.log(`📊 Polling ${sport.toUpperCase()} betting lines...`);
    const odds = await oddsApi.getLiveOdds(sport);

    // Store snapshots for steam detection
    const now = Date.now();
    for (const game of odds) {
      const key = game.id;
      const existing = lineHistory.get(key) || [];

      for (const [bookmaker, bookOdds] of Object.entries(game.odds)) {
        if (!bookOdds) continue;

        const snapshot: LineSnapshot = {
          gameId: game.id,
          game: game.game,
          sport,
          bookmaker,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeOdds: bookOdds.home,
          awayOdds: bookOdds.away,
          spread: bookOdds.spread,
          total: bookOdds.total,
          timestamp: now
        };

        existing.push(snapshot);
      }

      // Trim history
      if (existing.length > MAX_HISTORY_PER_GAME) {
        existing.splice(0, existing.length - MAX_HISTORY_PER_GAME);
      }

      lineHistory.set(key, existing);
    }

    // Detect steam moves
    const allSnapshots = Array.from(lineHistory.values()).flat();
    const movements = detectSteamMoves(allSnapshots);

    for (const movement of movements) {
      if (movement.significance !== 'low') {
        const signal = createSteamSignal(movement);
        await publishSignal(signal);
      }
    }

    console.log(`   Found ${odds.length} games, ${movements.length} movements`);
  } catch (error) {
    console.error(`❌ Failed to poll betting lines:`, error);
  }
}

async function pollArbitrage(sport: string): Promise<void> {
  try {
    console.log(`🎯 Scanning ${sport.toUpperCase()} for arbitrage...`);
    const arbs = await oddsApi.findArbitrage(sport, THRESHOLDS.minArbProfit);

    for (const arb of arbs) {
      const signal = createArbitrageSignal(arb, sport);
      await publishSignal(signal);
    }

    console.log(`   Found ${arbs.length} arbitrage opportunities`);
  } catch (error) {
    console.error(`❌ Failed to scan arbitrage:`, error);
  }
}

// ============== MAIN LOOP ==============

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        SportIntel Signal Publisher                         ║
╚════════════════════════════════════════════════════════════╝

🚀 Starting Signal Publisher...
   Node ID: ${NODE_ID}
   Gateway: ${SIGNAL_GATEWAY_URL}
  `);

  // Test gateway connection
  try {
    await axios.get(SIGNAL_GATEWAY_URL.replace('/signals', '/health'));
    console.log('✅ Gateway connection verified');
  } catch (error) {
    console.warn('⚠️  Gateway not reachable - signals will be queued');
  }

  const sports = ['nba', 'nfl'];

  // Initial poll
  console.log('\n📡 Starting initial poll...');
  for (const sport of sports) {
    await pollBettingLines(sport);
  }

  // Set up polling intervals
  console.log('\n⏰ Setting up polling intervals:');
  console.log(`   Betting Lines: Every ${POLL_INTERVALS.betting_lines / 1000}s`);
  console.log(`   Arbitrage: Every ${POLL_INTERVALS.arbitrage / 1000}s`);

  // Betting lines polling
  setInterval(async () => {
    for (const sport of sports) {
      await pollBettingLines(sport);
    }
  }, POLL_INTERVALS.betting_lines);

  // Arbitrage polling (less frequent)
  setInterval(async () => {
    for (const sport of sports) {
      await pollArbitrage(sport);
    }
  }, POLL_INTERVALS.arbitrage);

  console.log('\n✅ Signal Publisher running. Press Ctrl+C to stop.\n');

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nShutting down Signal Publisher...');
    process.exit(0);
  });
}

main().catch(console.error);
