/**
 * WebSocket Server with Socket.io
 *
 * Real-time push for:
 * - Arbitrage opportunities
 * - Odds updates
 * - Steam moves
 * - System notifications
 */

import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { getSubscriber } from './redis.js'
import type { ArbitrageOpportunity } from './arbitrage-engine.js'

const JWT_SECRET = process.env.JWT_SECRET || 'sportintel-secret-change-in-production'

export interface AuthenticatedSocket extends Socket {
  userId?: number
  userEmail?: string
  userTier?: 'free' | 'pro' | 'premium'
  nodeId?: string
  nodeReputation?: number
}

// Signal types for the network
export interface NetworkSignal {
  id: string
  type: 'steam' | 'arb' | 'dead' | 'ev' | 'news' | 'pattern'
  source: { nodeId: string; reputation: number }
  payload: { gameId: string; sport: string; description: string; confidence: number; ttl: number }
  evidence: { books: string[]; oldLine?: number; newLine?: number; delta?: number; profit?: number; timestamp: number }
  createdAt: number
  expiresAt: number
}

interface ServerToClientEvents {
  'arbitrage:new': (arb: ArbitrageOpportunity) => void
  'arbitrage:expired': (arbId: string) => void
  'arbitrage:list': (arbs: ArbitrageOpportunity[]) => void
  'odds:update': (data: { sport: string; games: any[] }) => void
  'steam:move': (move: any) => void
  'system:notification': (msg: { type: string; message: string }) => void
  'connection:status': (status: { connected: boolean; tier: string; nodeId?: string }) => void
  'error': (error: { code: string; message: string }) => void
  // Network signals
  'signal:new': (signal: NetworkSignal) => void
  'network:stats': (stats: { activeNodes: number; signalsToday: number; avgReputation: number; coverage: { sports: string[]; books: string[] } }) => void
  'node:reputation': (data: { reputation: number }) => void
}

interface ClientToServerEvents {
  'subscribe:sport': (sport: string) => void
  'unsubscribe:sport': (sport: string) => void
  'subscribe:arbitrage': () => void
  'unsubscribe:arbitrage': () => void
  'ping': () => void
  // Network node events
  'node:register': (data: { id: string; watching: { sports: string[]; books: string[] }; agents: { sniper: boolean; steamChaser: boolean; evHunter: boolean } }) => void
  'node:update': (data: { watching?: { sports: string[]; books: string[] }; agents?: { sniper: boolean; steamChaser: boolean; evHunter: boolean } }) => void
  'node:heartbeat': () => void
  'signals:subscribe': () => void
  'signals:unsubscribe': () => void
  'signal:publish': (data: { type: string; payload: any; evidence: any }) => void
}

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null

// Track connected clients and their subscriptions
const clientSports = new Map<string, Set<string>>()
const arbSubscribers = new Set<string>()
const signalSubscribers = new Set<string>()
const registeredNodes = new Map<string, { nodeId: string; watching: { sports: string[]; books: string[] }; agents: any }>()

// Rate limiting for free tier
const FREE_TIER_DELAY = 5000 // 5 second delay for free users
const lastArbSent = new Map<string, number>()

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 5000
  })

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token

    if (token) {
      try {
        const decoded = jwt.verify(token as string, JWT_SECRET) as any
        socket.userId = decoded.id
        socket.userEmail = decoded.email
        socket.userTier = decoded.tier || 'free'
      } catch (err) {
        // Invalid token, continue as anonymous
        socket.userTier = 'free'
      }
    } else {
      socket.userTier = 'free'
    }

    next()
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[WS] Client connected: ${socket.id} (tier: ${socket.userTier})`)

    // Initialize client tracking
    clientSports.set(socket.id, new Set())

    // Send connection status
    socket.emit('connection:status', {
      connected: true,
      tier: socket.userTier || 'free'
    })

    // Subscribe to sport updates
    socket.on('subscribe:sport', (sport: string) => {
      const sports = clientSports.get(socket.id)
      if (sports) {
        sports.add(sport.toLowerCase())
        socket.join(`sport:${sport.toLowerCase()}`)
        console.log(`[WS] ${socket.id} subscribed to ${sport}`)
      }
    })

    // Unsubscribe from sport
    socket.on('unsubscribe:sport', (sport: string) => {
      const sports = clientSports.get(socket.id)
      if (sports) {
        sports.delete(sport.toLowerCase())
        socket.leave(`sport:${sport.toLowerCase()}`)
      }
    })

    // Subscribe to arbitrage alerts
    socket.on('subscribe:arbitrage', () => {
      arbSubscribers.add(socket.id)
      socket.join('arbitrage')
      console.log(`[WS] ${socket.id} subscribed to arbitrage`)
    })

    // Unsubscribe from arbitrage
    socket.on('unsubscribe:arbitrage', () => {
      arbSubscribers.delete(socket.id)
      socket.leave('arbitrage')
    })

    // Ping/pong for latency measurement
    socket.on('ping', () => {
      socket.emit('system:notification', { type: 'pong', message: 'pong' })
    })

    // ============================================
    // NETWORK NODE HANDLERS
    // ============================================

    // Register as network node
    socket.on('node:register', async (data) => {
      try {
        socket.nodeId = data.id
        socket.nodeReputation = 50 // Default starting reputation

        registeredNodes.set(socket.id, {
          nodeId: data.id,
          watching: data.watching,
          agents: data.agents
        })

        console.log(`[WS] Node registered: ${data.id.slice(0, 8)}... watching ${data.watching.sports.join(', ')}`)

        // Send confirmation
        socket.emit('connection:status', {
          connected: true,
          tier: socket.userTier || 'free',
          nodeId: data.id
        })
      } catch (err) {
        socket.emit('error', { code: 'NODE_REGISTER_FAILED', message: 'Failed to register node' })
      }
    })

    // Update node configuration
    socket.on('node:update', async (data) => {
      const nodeInfo = registeredNodes.get(socket.id)
      if (nodeInfo) {
        if (data.watching) nodeInfo.watching = data.watching
        if (data.agents) nodeInfo.agents = data.agents
        registeredNodes.set(socket.id, nodeInfo)
        console.log(`[WS] Node ${socket.nodeId?.slice(0, 8)} updated config`)
      }
    })

    // Node heartbeat
    socket.on('node:heartbeat', () => {
      // Just acknowledge - presence is tracked by socket connection
      socket.emit('system:notification', { type: 'heartbeat', message: 'ack' })
    })

    // Subscribe to network signals
    socket.on('signals:subscribe', () => {
      signalSubscribers.add(socket.id)
      socket.join('signals')
      console.log(`[WS] ${socket.nodeId?.slice(0, 8) || socket.id} subscribed to signals`)
    })

    // Unsubscribe from signals
    socket.on('signals:unsubscribe', () => {
      signalSubscribers.delete(socket.id)
      socket.leave('signals')
    })

    // Publish signal (from client node)
    socket.on('signal:publish', async (data) => {
      if (!socket.nodeId) {
        socket.emit('error', { code: 'NOT_REGISTERED', message: 'Must register as node first' })
        return
      }

      // Broadcast to all signal subscribers
      const signal: NetworkSignal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: data.type as NetworkSignal['type'],
        source: {
          nodeId: socket.nodeId,
          reputation: socket.nodeReputation || 50
        },
        payload: data.payload,
        evidence: data.evidence,
        createdAt: Date.now(),
        expiresAt: Date.now() + (data.payload.ttl || 60) * 1000
      }

      // Emit to all signal subscribers
      io?.to('signals').emit('signal:new', signal)

      console.log(`[WS] Signal published by ${socket.nodeId.slice(0, 8)}: ${data.type}`)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}${socket.nodeId ? ` (node: ${socket.nodeId.slice(0, 8)})` : ''}`)
      clientSports.delete(socket.id)
      arbSubscribers.delete(socket.id)
      signalSubscribers.delete(socket.id)
      registeredNodes.delete(socket.id)
      lastArbSent.delete(socket.id)
    })
  })

  // Subscribe to Redis pub/sub for cross-instance communication
  setupRedisPubSub()

  console.log('[WS] WebSocket server initialized')
  return io
}

async function setupRedisPubSub(): Promise<void> {
  const subscriber = getSubscriber()

  try {
    await subscriber.subscribe('arbitrage:new')
    await subscriber.subscribe('odds:nfl')
    await subscriber.subscribe('odds:nba')
    await subscriber.subscribe('odds:mlb')
    await subscriber.subscribe('odds:nhl')
    await subscriber.subscribe('steam:move')

    subscriber.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message)

        if (channel === 'arbitrage:new') {
          broadcastArbitrage(data)
        } else if (channel.startsWith('odds:')) {
          const sport = channel.split(':')[1]
          broadcastOddsUpdate(sport, data)
        } else if (channel === 'steam:move') {
          broadcastSteamMove(data)
        }
      } catch (err) {
        console.error('[WS] Failed to parse pub/sub message:', err)
      }
    })

    console.log('[WS] Redis pub/sub connected')
  } catch (err) {
    console.warn('[WS] Redis pub/sub unavailable, using local broadcasting only')
  }
}

/**
 * Broadcast arbitrage opportunity to all subscribers
 * Applies rate limiting for free tier users
 */
export function broadcastArbitrage(arb: ArbitrageOpportunity): void {
  if (!io) return

  const sockets = io.sockets.sockets
  const room = io.sockets.adapter.rooms.get('arbitrage')

  if (!room) return

  for (const socketId of room) {
    const socket = sockets.get(socketId) as AuthenticatedSocket
    if (!socket) continue

    // Apply delay for free tier
    if (socket.userTier === 'free') {
      const lastSent = lastArbSent.get(socketId) || 0
      const now = Date.now()

      if (now - lastSent < FREE_TIER_DELAY) {
        // Queue for later (simplified - just skip for now)
        continue
      }

      // Delay free tier notifications
      setTimeout(() => {
        socket.emit('arbitrage:new', {
          ...arb,
          delayed: true,
          originalDetectedAt: arb.detectedAt,
          detectedAt: Date.now()
        })
        lastArbSent.set(socketId, Date.now())
      }, FREE_TIER_DELAY)
    } else {
      // Instant for paid tiers
      socket.emit('arbitrage:new', arb)
      lastArbSent.set(socketId, Date.now())
    }
  }

  console.log(`[WS] Broadcast arb to ${room.size} clients: ${arb.game} +${arb.profit}%`)
}

/**
 * Broadcast odds update to sport subscribers
 */
export function broadcastOddsUpdate(sport: string, data: any): void {
  if (!io) return

  io.to(`sport:${sport.toLowerCase()}`).emit('odds:update', {
    sport,
    games: data.games || data
  })
}

/**
 * Broadcast steam move alert
 */
export function broadcastSteamMove(move: any): void {
  if (!io) return

  io.to('arbitrage').emit('steam:move', move)
}

/**
 * Send arbitrage list to specific socket
 */
export function sendArbitrageList(socketId: string, arbs: ArbitrageOpportunity[]): void {
  if (!io) return

  const socket = io.sockets.sockets.get(socketId)
  if (socket) {
    socket.emit('arbitrage:list', arbs)
  }
}

/**
 * Get WebSocket server instance
 */
export function getIO(): Server | null {
  return io
}

/**
 * Get connected client count
 */
export function getClientCount(): number {
  if (!io) return 0
  return io.sockets.sockets.size
}

/**
 * Get arbitrage subscriber count
 */
export function getArbSubscriberCount(): number {
  return arbSubscribers.size
}

/**
 * Get signal subscriber count
 */
export function getSignalSubscriberCount(): number {
  return signalSubscribers.size
}

/**
 * Get registered node count
 */
export function getRegisteredNodeCount(): number {
  return registeredNodes.size
}

/**
 * Broadcast a network signal to all subscribers
 */
export function broadcastSignal(signal: NetworkSignal): void {
  if (!io) return
  io.to('signals').emit('signal:new', signal)
}

/**
 * Broadcast network stats to all signal subscribers
 */
export function broadcastNetworkStats(stats: { activeNodes: number; signalsToday: number; avgReputation: number; coverage: { sports: string[]; books: string[] } }): void {
  if (!io) return
  io.to('signals').emit('network:stats', stats)
}

/**
 * Update reputation for a specific node
 */
export function updateNodeReputation(nodeId: string, reputation: number): void {
  if (!io) return

  // Find socket by nodeId and update
  for (const [socketId, nodeInfo] of registeredNodes.entries()) {
    if (nodeInfo.nodeId === nodeId) {
      const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket
      if (socket) {
        socket.nodeReputation = reputation
        socket.emit('node:reputation', { reputation })
      }
      break
    }
  }
}

export default {
  initWebSocket,
  broadcastArbitrage,
  broadcastOddsUpdate,
  broadcastSteamMove,
  sendArbitrageList,
  getIO,
  getClientCount,
  getArbSubscriberCount,
  getSignalSubscriberCount,
  getRegisteredNodeCount,
  broadcastSignal,
  broadcastNetworkStats,
  updateNodeReputation
}
