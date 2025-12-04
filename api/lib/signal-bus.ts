/**
 * Signal Bus - Distributed Intelligence Layer
 *
 * Enables nodes to publish and subscribe to network signals:
 * - Steam moves (rapid line changes)
 * - Arbitrage opportunities
 * - Dead arbs (failed executions)
 * - +EV opportunities
 * - Unpriced news/information
 */

import { getRedis, getSubscriber } from './redis.js'
import { v4 as uuid } from 'uuid'

// Signal Types
export type SignalType = 'steam' | 'arb' | 'dead' | 'ev' | 'news' | 'pattern'

export interface Signal {
  id: string
  type: SignalType
  source: {
    nodeId: string
    reputation: number
  }
  payload: {
    gameId: string
    sport: string
    description: string
    confidence: number  // 0-100
    ttl: number         // Seconds until stale
  }
  evidence: {
    books: string[]
    oldLine?: number
    newLine?: number
    delta?: number
    profit?: number     // For arb signals
    timestamp: number
  }
  createdAt: number
  expiresAt: number
}

export interface Node {
  id: string
  watching: {
    sports: string[]
    books: string[]
  }
  agents: {
    sniper: boolean
    steamChaser: boolean
    evHunter: boolean
  }
  reputation: number
  signalsPublished: number
  lastSeen: number
}

// Signal TTLs by type (seconds)
const SIGNAL_TTL: Record<SignalType, number> = {
  steam: 60,
  arb: 30,
  dead: 300,
  ev: 120,
  news: 600,
  pattern: 300
}

// Channels
const CHANNELS = {
  steam: 'signals:steam',
  arb: 'signals:arb',
  dead: 'signals:dead',
  ev: 'signals:ev',
  news: 'signals:news',
  pattern: 'signals:pattern',
  all: 'signals:*'
}

// In-memory signal deduplication
const recentSignals = new Map<string, number>()
const DEDUP_WINDOW = 5000 // 5 seconds

// Signal handlers
type SignalHandler = (signal: Signal) => void
const handlers: Map<SignalType | 'all', Set<SignalHandler>> = new Map()

/**
 * Initialize the signal bus subscriber
 */
export async function initSignalBus(): Promise<void> {
  const subscriber = getSubscriber()

  // Subscribe to all signal channels
  await subscriber.subscribe(
    CHANNELS.steam,
    CHANNELS.arb,
    CHANNELS.dead,
    CHANNELS.ev,
    CHANNELS.news,
    CHANNELS.pattern
  )

  subscriber.on('message', (channel: string, message: string) => {
    try {
      const signal = JSON.parse(message) as Signal

      // Skip if expired
      if (Date.now() > signal.expiresAt) return

      // Deduplicate
      const dedupKey = `${signal.type}:${signal.payload.gameId}:${signal.source.nodeId}`
      if (recentSignals.has(dedupKey)) return
      recentSignals.set(dedupKey, Date.now())

      // Dispatch to handlers
      const type = channel.split(':')[1] as SignalType
      dispatch(type, signal)
      dispatch('all', signal)

    } catch (err) {
      console.error('[SIGNAL BUS] Failed to parse signal:', err)
    }
  })

  // Cleanup old dedup entries
  setInterval(() => {
    const now = Date.now()
    for (const [key, time] of recentSignals) {
      if (now - time > DEDUP_WINDOW) {
        recentSignals.delete(key)
      }
    }
  }, 10000)

  console.log('[SIGNAL BUS] Initialized, listening on all channels')
}

/**
 * Dispatch signal to registered handlers
 */
function dispatch(type: SignalType | 'all', signal: Signal): void {
  const typeHandlers = handlers.get(type)
  if (typeHandlers) {
    for (const handler of typeHandlers) {
      try {
        handler(signal)
      } catch (err) {
        console.error('[SIGNAL BUS] Handler error:', err)
      }
    }
  }
}

/**
 * Subscribe to signals
 */
export function onSignal(type: SignalType | 'all', handler: SignalHandler): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set())
  }
  handlers.get(type)!.add(handler)

  // Return unsubscribe function
  return () => {
    handlers.get(type)?.delete(handler)
  }
}

/**
 * Publish a signal to the network
 */
export async function publishSignal(
  type: SignalType,
  nodeId: string,
  payload: Signal['payload'],
  evidence: Signal['evidence']
): Promise<Signal> {
  const redis = getRedis()

  // Get node reputation
  const nodeData = await redis.get(`node:${nodeId}`)
  const node = nodeData ? JSON.parse(nodeData) : { reputation: 50 }

  const signal: Signal = {
    id: uuid(),
    type,
    source: {
      nodeId,
      reputation: node.reputation
    },
    payload,
    evidence,
    createdAt: Date.now(),
    expiresAt: Date.now() + (payload.ttl || SIGNAL_TTL[type]) * 1000
  }

  // Publish to channel
  const channel = CHANNELS[type]
  await redis.publish(channel, JSON.stringify(signal))

  // Store in signal history
  await redis.setex(
    `signal:${signal.id}`,
    SIGNAL_TTL[type],
    JSON.stringify(signal)
  )

  // Increment node's signal count
  await incrementNodeSignals(nodeId)

  console.log(`[SIGNAL BUS] Published ${type} signal from ${nodeId.slice(0, 8)}...`)

  return signal
}

/**
 * Publish a Steam Move signal
 */
export async function publishSteamSignal(
  nodeId: string,
  gameId: string,
  sport: string,
  books: string[],
  oldLine: number,
  newLine: number
): Promise<Signal> {
  const delta = Math.abs(newLine - oldLine)
  const confidence = Math.min(100, delta * 10 + books.length * 10)

  return publishSignal('steam', nodeId, {
    gameId,
    sport,
    description: `Line moved ${delta > 0 ? '+' : ''}${(newLine - oldLine).toFixed(1)} across ${books.length} books`,
    confidence,
    ttl: SIGNAL_TTL.steam
  }, {
    books,
    oldLine,
    newLine,
    delta,
    timestamp: Date.now()
  })
}

/**
 * Publish an Arbitrage signal
 */
export async function publishArbSignal(
  nodeId: string,
  gameId: string,
  sport: string,
  book1: string,
  book2: string,
  profit: number
): Promise<Signal> {
  return publishSignal('arb', nodeId, {
    gameId,
    sport,
    description: `${profit.toFixed(2)}% arb between ${book1} and ${book2}`,
    confidence: Math.min(100, profit * 20),
    ttl: SIGNAL_TTL.arb
  }, {
    books: [book1, book2],
    profit,
    timestamp: Date.now()
  })
}

/**
 * Publish a Dead Arb signal (arb no longer available)
 */
export async function publishDeadArbSignal(
  nodeId: string,
  originalSignalId: string,
  reason: string
): Promise<Signal> {
  const redis = getRedis()
  const originalData = await redis.get(`signal:${originalSignalId}`)

  if (!originalData) {
    throw new Error('Original signal not found')
  }

  const original = JSON.parse(originalData) as Signal

  return publishSignal('dead', nodeId, {
    gameId: original.payload.gameId,
    sport: original.payload.sport,
    description: `Arb dead: ${reason}`,
    confidence: 100,
    ttl: SIGNAL_TTL.dead
  }, {
    books: original.evidence.books,
    timestamp: Date.now()
  })
}

/**
 * Publish an EV+ opportunity signal
 */
export async function publishEvSignal(
  nodeId: string,
  gameId: string,
  sport: string,
  description: string,
  confidence: number,
  books: string[]
): Promise<Signal> {
  return publishSignal('ev', nodeId, {
    gameId,
    sport,
    description,
    confidence,
    ttl: SIGNAL_TTL.ev
  }, {
    books,
    timestamp: Date.now()
  })
}

/**
 * Register a node in the network
 */
export async function registerNode(node: Omit<Node, 'signalsPublished' | 'lastSeen'>): Promise<Node> {
  const redis = getRedis()

  const fullNode: Node = {
    ...node,
    signalsPublished: 0,
    lastSeen: Date.now()
  }

  await redis.set(`node:${node.id}`, JSON.stringify(fullNode))

  // Add to active nodes set
  await redis.setex(`node:active:${node.id}`, 300, '1') // 5 min TTL

  console.log(`[SIGNAL BUS] Node registered: ${node.id.slice(0, 8)}...`)

  return fullNode
}

/**
 * Update node's last seen and watching config
 */
export async function heartbeatNode(nodeId: string, watching?: Node['watching']): Promise<void> {
  const redis = getRedis()

  const nodeData = await redis.get(`node:${nodeId}`)
  if (!nodeData) {
    console.warn(`[SIGNAL BUS] Unknown node heartbeat: ${nodeId}`)
    return
  }

  const node = JSON.parse(nodeData) as Node
  node.lastSeen = Date.now()
  if (watching) {
    node.watching = watching
  }

  await redis.set(`node:${nodeId}`, JSON.stringify(node))
  await redis.setex(`node:active:${nodeId}`, 300, '1')
}

/**
 * Increment node's published signal count
 */
async function incrementNodeSignals(nodeId: string): Promise<void> {
  const redis = getRedis()

  const nodeData = await redis.get(`node:${nodeId}`)
  if (!nodeData) return

  const node = JSON.parse(nodeData) as Node
  node.signalsPublished++

  await redis.set(`node:${nodeId}`, JSON.stringify(node))
}

/**
 * Update node reputation based on signal outcome
 */
export async function updateNodeReputation(
  nodeId: string,
  delta: number,
  reason: string
): Promise<number> {
  const redis = getRedis()

  const nodeData = await redis.get(`node:${nodeId}`)
  if (!nodeData) return 0

  const node = JSON.parse(nodeData) as Node
  node.reputation = Math.max(0, Math.min(100, node.reputation + delta))

  await redis.set(`node:${nodeId}`, JSON.stringify(node))

  console.log(`[SIGNAL BUS] Node ${nodeId.slice(0, 8)} reputation: ${node.reputation} (${delta > 0 ? '+' : ''}${delta}: ${reason})`)

  return node.reputation
}

/**
 * Get network statistics
 */
export async function getNetworkStats(): Promise<{
  activeNodes: number
  signalsToday: number
  avgReputation: number
  coverage: { sports: string[]; books: string[] }
}> {
  const redis = getRedis()

  // Count active nodes
  const activeKeys = await redis.keys('node:active:*')
  const activeNodes = activeKeys.length

  // Get all active node data
  const sports = new Set<string>()
  const books = new Set<string>()
  let totalReputation = 0

  for (const key of activeKeys) {
    const nodeId = key.replace('node:active:', '')
    const nodeData = await redis.get(`node:${nodeId}`)
    if (nodeData) {
      const node = JSON.parse(nodeData) as Node
      totalReputation += node.reputation
      node.watching.sports.forEach(s => sports.add(s))
      node.watching.books.forEach(b => books.add(b))
    }
  }

  return {
    activeNodes,
    signalsToday: 0, // TODO: Implement daily counter
    avgReputation: activeNodes > 0 ? Math.round(totalReputation / activeNodes) : 0,
    coverage: {
      sports: Array.from(sports),
      books: Array.from(books)
    }
  }
}

/**
 * Get recent signals of a type
 */
export async function getRecentSignals(type?: SignalType, limit = 20): Promise<Signal[]> {
  const redis = getRedis()

  const pattern = type ? `signal:*` : `signal:*`
  const keys = await redis.keys(pattern)

  const signals: Signal[] = []
  for (const key of keys.slice(0, limit * 2)) { // Fetch extra in case some are wrong type
    const data = await redis.get(key)
    if (data) {
      const signal = JSON.parse(data) as Signal
      if (!type || signal.type === type) {
        if (Date.now() < signal.expiresAt) {
          signals.push(signal)
        }
      }
    }
    if (signals.length >= limit) break
  }

  return signals.sort((a, b) => b.createdAt - a.createdAt)
}

export default {
  initSignalBus,
  onSignal,
  publishSignal,
  publishSteamSignal,
  publishArbSignal,
  publishDeadArbSignal,
  publishEvSignal,
  registerNode,
  heartbeatNode,
  updateNodeReputation,
  getNetworkStats,
  getRecentSignals
}
