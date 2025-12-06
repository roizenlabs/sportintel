/**
 * SportIntel Signal Types
 *
 * Defines the core signal types for the real-time betting analytics network.
 * Signals are published to Redis channels and consumed by agents.
 */

// ============== SIGNAL TYPES ==============

export type SignalType = 'steam' | 'arb' | 'ev' | 'news' | 'sentiment';

export interface SignalSource {
  nodeId: string;
  reputation: number;  // 0-100, higher = more reliable
  timestamp: number;
}

export interface BaseSignal {
  id: string;
  type: SignalType;
  source: SignalSource;
  createdAt: number;
  expiresAt?: number;
}

// ============== STEAM MOVE SIGNAL ==============
// Triggered when betting line moves significantly (>1.5 points in 60s)

export interface SteamSignal extends BaseSignal {
  type: 'steam';
  payload: {
    gameId: string;
    game: string;
    sport: string;
    description: string;
    confidence: number;  // 0-100
    ttl: number;         // seconds until signal expires
  };
  evidence: {
    books: string[];
    oldLine: number;
    newLine: number;
    delta: number;
    timestamp: number;
  };
}

// ============== ARBITRAGE SIGNAL ==============
// Triggered when price discrepancy creates guaranteed profit

export interface ArbitrageSignal extends BaseSignal {
  type: 'arb';
  payload: {
    gameId: string;
    game: string;
    sport: string;
    description: string;
    confidence: number;
    ttl: number;
    profitPercent: number;
  };
  bets: {
    book1: {
      name: string;
      bet: string;
      odds: number;
      stakePercent: number;
    };
    book2: {
      name: string;
      bet: string;
      odds: number;
      stakePercent: number;
    };
  };
}

// ============== EXPECTED VALUE SIGNAL ==============
// Triggered when a bet has positive expected value

export interface EVSignal extends BaseSignal {
  type: 'ev';
  payload: {
    gameId: string;
    game: string;
    sport: string;
    description: string;
    confidence: number;
    ttl: number;
    evPercent: number;
    bookmaker: string;
  };
  analysis: {
    fairOdds: number;
    currentOdds: number;
    edge: number;
    model: string;
  };
}

// ============== NEWS SIGNAL ==============
// Triggered by breaking injury/lineup news

export interface NewsSignal extends BaseSignal {
  type: 'news';
  payload: {
    sport: string;
    description: string;
    headline: string;
    confidence: number;
    ttl: number;
    impact: 'high' | 'medium' | 'low';
  };
  source: SignalSource & {
    outlet: string;
    url?: string;
    verified: boolean;
  };
  affectedGames?: string[];
  affectedPlayers?: string[];
}

// ============== SENTIMENT SIGNAL ==============
// Triggered when public sentiment shifts dramatically

export interface SentimentSignal extends BaseSignal {
  type: 'sentiment';
  payload: {
    gameId: string;
    game: string;
    sport: string;
    description: string;
    confidence: number;
    ttl: number;
  };
  analysis: {
    previousSentiment: 'bullish' | 'bearish' | 'neutral';
    currentSentiment: 'bullish' | 'bearish' | 'neutral';
    shiftMagnitude: number;  // 0-100
    sampleSize: number;
    sources: string[];
  };
}

// ============== UNION TYPE ==============

export type Signal = SteamSignal | ArbitrageSignal | EVSignal | NewsSignal | SentimentSignal;

// ============== REDIS CHANNELS ==============

export const SIGNAL_CHANNELS = {
  steam: 'signals:steam',
  arb: 'signals:arb',
  ev: 'signals:ev',
  news: 'signals:news',
  sentiment: 'signals:sentiment',
  all: 'signals:*'
} as const;

// ============== HELPER FUNCTIONS ==============

export function generateSignalId(type: SignalType, gameId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return gameId ? `${type}-${gameId}-${timestamp}-${random}` : `${type}-${timestamp}-${random}`;
}

export function getChannelForSignal(signal: Signal): string {
  return SIGNAL_CHANNELS[signal.type];
}

export function isSignalExpired(signal: Signal): boolean {
  if (!signal.expiresAt) return false;
  return Date.now() > signal.expiresAt;
}

export function getSignalUrgency(signal: Signal): 'critical' | 'high' | 'medium' | 'low' {
  if (signal.type === 'arb' && (signal as ArbitrageSignal).payload.profitPercent > 2) return 'critical';
  if (signal.type === 'steam' && (signal as SteamSignal).evidence.delta > 3) return 'critical';
  if (signal.type === 'news' && (signal as NewsSignal).payload.impact === 'high') return 'high';
  if (signal.payload.confidence > 85) return 'high';
  if (signal.payload.confidence > 70) return 'medium';
  return 'low';
}

// ============== LINE TRACKING ==============

export interface LineSnapshot {
  gameId: string;
  game: string;
  sport: string;
  bookmaker: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  spread?: number;
  total?: number;
  timestamp: number;
}

export interface LineMovement {
  gameId: string;
  game: string;
  bookmaker: string;
  previousValue: number;
  newValue: number;
  delta: number;
  timeElapsed: number;  // ms
  significance: 'steam' | 'high' | 'medium' | 'low';
}
