/**
 * SportIntel Signal Subscriber
 *
 * Example Redis subscriber for receiving and handling signals.
 * Use this as a template for building agent integrations.
 *
 * Usage:
 *   npx tsx src/signals/subscriber.ts
 *
 * Environment Variables:
 *   REDIS_URL - Redis connection string (default: redis://localhost:6379)
 */

import { createClient } from 'redis';
import {
  Signal,
  SteamSignal,
  ArbitrageSignal,
  EVSignal,
  NewsSignal,
  SentimentSignal,
  SIGNAL_CHANNELS,
  getSignalUrgency,
  isSignalExpired
} from './types.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Signal handlers - extend these for your agents
interface SignalHandlers {
  onSteamMove?: (signal: SteamSignal) => Promise<void>;
  onArbitrage?: (signal: ArbitrageSignal) => Promise<void>;
  onEV?: (signal: EVSignal) => Promise<void>;
  onNews?: (signal: NewsSignal) => Promise<void>;
  onSentiment?: (signal: SentimentSignal) => Promise<void>;
  onAny?: (signal: Signal) => Promise<void>;
}

export class SignalSubscriber {
  private client: ReturnType<typeof createClient>;
  private subscriber: ReturnType<typeof createClient>;
  private handlers: SignalHandlers;
  private isConnected: boolean = false;
  private stats = {
    received: 0,
    processed: 0,
    errors: 0,
    byType: { steam: 0, arb: 0, ev: 0, news: 0, sentiment: 0 }
  };

  constructor(handlers: SignalHandlers = {}) {
    this.handlers = handlers;
    this.client = createClient({ url: REDIS_URL });
    this.subscriber = this.client.duplicate();
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
      this.isConnected = true;
      console.log('✅ Connected to Redis');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async subscribe(channels: string[] = Object.values(SIGNAL_CHANNELS)): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Redis');
    }

    for (const channel of channels) {
      if (channel === 'signals:*') continue; // Skip wildcard

      await this.subscriber.subscribe(channel, async (message) => {
        try {
          this.stats.received++;
          const signal = JSON.parse(message) as Signal;

          // Skip expired signals
          if (isSignalExpired(signal)) {
            console.log(`⏭️  Skipping expired signal: ${signal.id}`);
            return;
          }

          // Track stats
          this.stats.byType[signal.type] = (this.stats.byType[signal.type] || 0) + 1;

          // Log with urgency indicator
          const urgency = getSignalUrgency(signal);
          const urgencyEmoji = urgency === 'critical' ? '🔴' :
                               urgency === 'high' ? '🟠' :
                               urgency === 'medium' ? '🟡' : '🟢';

          console.log(`\n${urgencyEmoji} [${signal.type.toUpperCase()}] ${signal.payload.description}`);
          console.log(`   Confidence: ${signal.payload.confidence}% | Source: ${signal.source.nodeId}`);

          // Dispatch to handlers
          await this.dispatchSignal(signal);
          this.stats.processed++;
        } catch (error) {
          this.stats.errors++;
          console.error('Failed to process signal:', error);
        }
      });

      console.log(`📡 Subscribed to ${channel}`);
    }
  }

  private async dispatchSignal(signal: Signal): Promise<void> {
    // Call type-specific handler
    switch (signal.type) {
      case 'steam':
        if (this.handlers.onSteamMove) {
          await this.handlers.onSteamMove(signal as SteamSignal);
        }
        break;
      case 'arb':
        if (this.handlers.onArbitrage) {
          await this.handlers.onArbitrage(signal as ArbitrageSignal);
        }
        break;
      case 'ev':
        if (this.handlers.onEV) {
          await this.handlers.onEV(signal as EVSignal);
        }
        break;
      case 'news':
        if (this.handlers.onNews) {
          await this.handlers.onNews(signal as NewsSignal);
        }
        break;
      case 'sentiment':
        if (this.handlers.onSentiment) {
          await this.handlers.onSentiment(signal as SentimentSignal);
        }
        break;
    }

    // Call generic handler
    if (this.handlers.onAny) {
      await this.handlers.onAny(signal);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  async disconnect(): Promise<void> {
    await this.subscriber.quit();
    await this.client.quit();
    this.isConnected = false;
    console.log('Disconnected from Redis');
  }
}

// ============== EXAMPLE AGENT IMPLEMENTATIONS ==============

/**
 * Steam Chaser Agent
 * Reacts to rapid line movements by evaluating follow-the-money strategies
 */
async function handleSteamMove(signal: SteamSignal): Promise<void> {
  const { evidence, payload } = signal;

  console.log('\n🏃 Steam Chaser Processing:');
  console.log(`   Game: ${payload.game}`);
  console.log(`   Movement: ${evidence.oldLine} → ${evidence.newLine} (Δ ${evidence.delta})`);
  console.log(`   Book: ${evidence.books.join(', ')}`);

  // Example logic:
  // - If delta > 3 points in < 60s, this is significant sharp action
  // - Consider placing a bet in the direction of the move
  // - But check if other books have already moved (if so, we're late)

  if (Math.abs(evidence.delta) >= 30) { // 30+ point move in odds
    console.log('   ⚡ SIGNIFICANT SHARP ACTION - Consider following!');
  }
}

/**
 * Arbitrage Sniper Agent
 * Executes on guaranteed profit opportunities
 */
async function handleArbitrage(signal: ArbitrageSignal): Promise<void> {
  const { payload, bets } = signal;

  console.log('\n🎯 Arbitrage Sniper Processing:');
  console.log(`   Game: ${payload.game}`);
  console.log(`   Profit: ${payload.profitPercent.toFixed(2)}%`);
  console.log(`   Bet 1: ${bets.book1.name} - ${bets.book1.bet} @ ${bets.book1.odds} (${bets.book1.stakePercent.toFixed(1)}%)`);
  console.log(`   Bet 2: ${bets.book2.name} - ${bets.book2.bet} @ ${bets.book2.odds} (${bets.book2.stakePercent.toFixed(1)}%)`);

  // Example logic:
  // - Verify odds are still available at both books
  // - Calculate exact stakes for bankroll
  // - Place bets simultaneously if possible
  // - Log execution for tracking

  if (payload.profitPercent >= 2) {
    console.log('   💰 HIGH-VALUE ARB - Priority execution!');
  }
}

/**
 * EV+ Hunter Agent
 * Finds positive expected value bets
 */
async function handleEV(signal: EVSignal): Promise<void> {
  const { payload, analysis } = signal;

  console.log('\n📈 EV+ Hunter Processing:');
  console.log(`   Game: ${payload.game}`);
  console.log(`   Edge: ${analysis.edge.toFixed(2)}%`);
  console.log(`   Fair Odds: ${analysis.fairOdds} vs Current: ${analysis.currentOdds}`);
  console.log(`   Model: ${analysis.model}`);

  // Example logic:
  // - Validate model assumptions
  // - Kelly criterion for stake sizing
  // - Track historical model accuracy
}

/**
 * News Reactor Agent
 * Responds to breaking news before lines adjust
 */
async function handleNews(signal: NewsSignal): Promise<void> {
  const { payload } = signal;

  console.log('\n📰 News Reactor Processing:');
  console.log(`   Headline: ${payload.headline}`);
  console.log(`   Impact: ${payload.impact.toUpperCase()}`);
  console.log(`   Verified: ${signal.source.verified ? 'Yes' : 'No'}`);

  if (payload.impact === 'high' && signal.source.verified) {
    console.log('   ⚡ HIGH-IMPACT VERIFIED NEWS - Act immediately!');
  }
}

/**
 * Sentiment Tracker Agent
 * Monitors public betting sentiment shifts
 */
async function handleSentiment(signal: SentimentSignal): Promise<void> {
  const { payload, analysis } = signal;

  console.log('\n📊 Sentiment Tracker Processing:');
  console.log(`   Game: ${payload.game}`);
  console.log(`   Shift: ${analysis.previousSentiment} → ${analysis.currentSentiment}`);
  console.log(`   Magnitude: ${analysis.shiftMagnitude}%`);
  console.log(`   Sample: ${analysis.sampleSize} data points`);

  // Example logic:
  // - Contrarian plays when public is heavily one-sided
  // - Fade the public in primetime games
}

// ============== MAIN ==============

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        SportIntel Signal Subscriber                        ║
╚════════════════════════════════════════════════════════════╝

🔌 Connecting to Redis: ${REDIS_URL}
  `);

  const subscriber = new SignalSubscriber({
    onSteamMove: handleSteamMove,
    onArbitrage: handleArbitrage,
    onEV: handleEV,
    onNews: handleNews,
    onSentiment: handleSentiment
  });

  await subscriber.connect();
  await subscriber.subscribe([
    SIGNAL_CHANNELS.steam,
    SIGNAL_CHANNELS.arb,
    SIGNAL_CHANNELS.ev,
    SIGNAL_CHANNELS.news,
    SIGNAL_CHANNELS.sentiment
  ]);

  console.log('\n✅ Signal Subscriber running. Press Ctrl+C to stop.\n');
  console.log('Waiting for signals...\n');

  // Stats logging
  setInterval(() => {
    const stats = subscriber.getStats();
    if (stats.received > 0) {
      console.log(`\n📊 Stats: ${stats.processed}/${stats.received} processed, ${stats.errors} errors`);
    }
  }, 60000);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await subscriber.disconnect();
    process.exit(0);
  });
}

// Run if executed directly
main().catch(console.error);

export { handleSteamMove, handleArbitrage, handleEV, handleNews, handleSentiment };
