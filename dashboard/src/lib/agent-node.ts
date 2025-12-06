/**
 * Agent Node - Client-Side Network Participant
 *
 * Transforms the dashboard from a passive viewer into an active network node:
 * - Publishes line change observations
 * - Receives signals from other nodes
 * - Runs local agent workflows
 * - Maintains reputation through accurate signals
 */

import { io, Socket } from 'socket.io-client'
import { v4 as uuid } from 'uuid'

// WebSocket connects directly to API server (not through Vite proxy)
const API_URL = 'http://localhost:8080'
const NODE_ID_KEY = 'sportintel_node_id'
const NODE_CONFIG_KEY = 'sportintel_node_config'

// ============================================
// TYPES
// ============================================

export interface Signal {
  id: string
  type: 'steam' | 'arb' | 'dead' | 'ev' | 'news' | 'pattern'
  source: {
    nodeId: string
    reputation: number
  }
  payload: {
    gameId: string
    sport: string
    description: string
    confidence: number
    ttl: number
  }
  evidence: {
    books: string[]
    oldLine?: number
    newLine?: number
    delta?: number
    profit?: number
    timestamp: number
  }
  createdAt: number
  expiresAt: number
}

export interface NodeConfig {
  watching: {
    sports: string[]
    books: string[]
  }
  agents: {
    sniper: boolean
    steamChaser: boolean
    evHunter: boolean
  }
  settings: {
    minArbProfit: number
    minSteamDelta: number
    autoPublish: boolean
  }
}

export interface NetworkStats {
  activeNodes: number
  signalsToday: number
  avgReputation: number
  coverage: {
    sports: string[]
    books: string[]
  }
}

// ============================================
// NODE IDENTITY
// ============================================

function getNodeId(): string {
  const stored = localStorage.getItem(NODE_ID_KEY)
  if (stored) {
    return stored
  }
  const newId = uuid()
  localStorage.setItem(NODE_ID_KEY, newId)
  return newId
}

function getNodeConfig(): NodeConfig {
  const stored = localStorage.getItem(NODE_CONFIG_KEY)
  if (stored) {
    return JSON.parse(stored)
  }

  const defaultConfig: NodeConfig = {
    watching: {
      sports: ['nba', 'nfl'],
      books: ['draftkings', 'fanduel', 'bovada']
    },
    agents: {
      sniper: false,
      steamChaser: true,
      evHunter: false
    },
    settings: {
      minArbProfit: 1.0,
      minSteamDelta: 2.0,
      autoPublish: true
    }
  }

  localStorage.setItem(NODE_CONFIG_KEY, JSON.stringify(defaultConfig))
  return defaultConfig
}

function saveNodeConfig(config: NodeConfig): void {
  localStorage.setItem(NODE_CONFIG_KEY, JSON.stringify(config))
}

// ============================================
// AGENT NODE CLASS
// ============================================

type SignalHandler = (signal: Signal) => void
type StatsHandler = (stats: NetworkStats) => void

export class AgentNode {
  private socket: Socket | null = null
  private nodeId: string
  private config: NodeConfig
  private reputation = 50
  private isConnected = false
  private signalHandlers: Map<string, Set<SignalHandler>> = new Map()
  private statsHandlers: Set<StatsHandler> = new Set()
  private lastOdds: Map<string, Map<string, number>> = new Map() // gameId -> bookmaker -> odds
  private signalHistory: Signal[] = []

  constructor() {
    this.nodeId = getNodeId()
    this.config = getNodeConfig()
  }

  // ============================================
  // CONNECTION
  // ============================================

  async connect(authToken?: string): Promise<void> {
    if (this.socket?.connected) return

    this.socket = io(API_URL, {
      auth: { token: authToken, nodeId: this.nodeId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000)

      this.socket!.on('connect', () => {
        clearTimeout(timeout)
        this.isConnected = true
        console.log(`[AGENT NODE] Connected as ${this.nodeId.slice(0, 8)}...`)

        // Register node
        this.socket!.emit('node:register', {
          id: this.nodeId,
          watching: this.config.watching,
          agents: this.config.agents
        })

        // Subscribe to signals
        this.socket!.emit('signals:subscribe')

        resolve()
      })

      this.socket!.on('disconnect', () => {
        this.isConnected = false
        console.log('[AGENT NODE] Disconnected')
      })

      this.socket!.on('connect_error', (err) => {
        console.error('[AGENT NODE] Connection error:', err.message)
      })

      // Signal handlers
      this.socket!.on('signal:new', (signal: Signal) => {
        this.handleIncomingSignal(signal)
      })

      this.socket!.on('node:reputation', (data: { reputation: number }) => {
        this.reputation = data.reputation
      })

      this.socket!.on('network:stats', (stats: NetworkStats) => {
        this.statsHandlers.forEach(handler => handler(stats))
      })
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  // ============================================
  // SIGNAL HANDLING
  // ============================================

  private handleIncomingSignal(signal: Signal): void {
    // Skip if expired
    if (Date.now() > signal.expiresAt) return

    // Skip if from self
    if (signal.source.nodeId === this.nodeId) return

    // Skip if not watching this sport
    if (!this.config.watching.sports.includes(signal.payload.sport)) return

    // Store in history
    this.signalHistory.unshift(signal)
    if (this.signalHistory.length > 100) {
      this.signalHistory.pop()
    }

    // Dispatch to handlers
    const typeHandlers = this.signalHandlers.get(signal.type)
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(signal)
        } catch (err) {
          console.error('[AGENT NODE] Handler error:', err)
        }
      })
    }

    // Dispatch to 'all' handlers
    const allHandlers = this.signalHandlers.get('all')
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler(signal)
        } catch (err) {
          console.error('[AGENT NODE] Handler error:', err)
        }
      })
    }

    // Run agent workflows if enabled
    this.runAgentWorkflows(signal)
  }

  onSignal(type: string, handler: SignalHandler): () => void {
    if (!this.signalHandlers.has(type)) {
      this.signalHandlers.set(type, new Set())
    }
    this.signalHandlers.get(type)!.add(handler)

    return () => {
      this.signalHandlers.get(type)?.delete(handler)
    }
  }

  onNetworkStats(handler: StatsHandler): () => void {
    this.statsHandlers.add(handler)
    return () => {
      this.statsHandlers.delete(handler)
    }
  }

  // ============================================
  // SIGNAL PUBLISHING
  // ============================================

  async publishSignal(
    type: Signal['type'],
    payload: Signal['payload'],
    evidence: Signal['evidence']
  ): Promise<void> {
    if (!this.socket?.connected) {
      console.warn('[AGENT NODE] Cannot publish - not connected')
      return
    }

    if (!this.config.settings.autoPublish) {
      console.log('[AGENT NODE] Auto-publish disabled, skipping')
      return
    }

    this.socket.emit('signal:publish', {
      type,
      payload,
      evidence
    })
  }

  // ============================================
  // LINE CHANGE DETECTION
  // ============================================

  /**
   * Call this when new odds data is received
   * Automatically detects and publishes line changes
   */
  processOddsUpdate(
    gameId: string,
    sport: string,
    odds: Record<string, { home: number; away: number }>
  ): void {
    const previousOdds = this.lastOdds.get(gameId)

    if (previousOdds) {
      // Check for significant line changes
      for (const [book, newOdds] of Object.entries(odds)) {
        const oldOdds = previousOdds.get(book)
        if (oldOdds !== undefined) {
          const delta = Math.abs(newOdds.home - oldOdds)

          // Significant change detected
          if (delta >= this.config.settings.minSteamDelta) {
            console.log(`[AGENT NODE] Line change detected: ${book} ${oldOdds} -> ${newOdds.home}`)

            this.publishSignal('steam', {
              gameId,
              sport,
              description: `${book} line moved ${delta > 0 ? '+' : ''}${(newOdds.home - oldOdds).toFixed(1)}`,
              confidence: Math.min(100, delta * 20),
              ttl: 60
            }, {
              books: [book],
              oldLine: oldOdds,
              newLine: newOdds.home,
              delta,
              timestamp: Date.now()
            })
          }
        }
      }
    }

    // Store current odds for next comparison
    const bookOdds = new Map<string, number>()
    for (const [book, o] of Object.entries(odds)) {
      bookOdds.set(book, o.home)
    }
    this.lastOdds.set(gameId, bookOdds)
  }

  /**
   * Call this when an arbitrage is detected
   */
  publishArbDetected(
    gameId: string,
    sport: string,
    book1: string,
    book2: string,
    profit: number
  ): void {
    if (profit < this.config.settings.minArbProfit) return

    this.publishSignal('arb', {
      gameId,
      sport,
      description: `${profit.toFixed(2)}% arb: ${book1} vs ${book2}`,
      confidence: Math.min(100, profit * 20),
      ttl: 30
    }, {
      books: [book1, book2],
      profit,
      timestamp: Date.now()
    })
  }

  /**
   * Call this when an arb execution fails
   */
  publishDeadArb(
    originalSignalId: string,
    reason: string
  ): void {
    const original = this.signalHistory.find(s => s.id === originalSignalId)
    if (!original) return

    this.publishSignal('dead', {
      gameId: original.payload.gameId,
      sport: original.payload.sport,
      description: `Dead arb: ${reason}`,
      confidence: 100,
      ttl: 300
    }, {
      books: original.evidence.books,
      timestamp: Date.now()
    })
  }

  // ============================================
  // AGENT WORKFLOWS
  // ============================================

  private runAgentWorkflows(signal: Signal): void {
    // Steam Chaser workflow
    if (signal.type === 'steam' && this.config.agents.steamChaser) {
      this.steamChaserWorkflow(signal)
    }

    // Sniper workflow (for arb signals)
    if (signal.type === 'arb' && this.config.agents.sniper) {
      this.sniperWorkflow(signal)
    }
  }

  private steamChaserWorkflow(signal: Signal): void {
    // TODO: Query historical patterns
    // TODO: Calculate confidence based on history
    // TODO: Push notification to user

    console.log(`[STEAM CHASER] Processing steam signal: ${signal.payload.description}`)

    // For now, just log high-confidence steam moves
    if (signal.payload.confidence >= 70) {
      console.log(`[STEAM CHASER] HIGH CONFIDENCE: ${signal.payload.description}`)
      // Could trigger browser notification here
    }
  }

  private sniperWorkflow(signal: Signal): void {
    // TODO: Validate odds still live
    // TODO: Check bankroll strategy
    // TODO: Execute via browser automation

    console.log(`[SNIPER] Processing arb signal: ${signal.payload.description}`)

    if (signal.evidence.profit && signal.evidence.profit >= 2) {
      console.log(`[SNIPER] HIGH VALUE ARB: ${signal.evidence.profit}%`)
      // Could trigger execution workflow here
    }
  }

  // ============================================
  // CONFIG & STATE
  // ============================================

  getNodeId(): string {
    return this.nodeId
  }

  getReputation(): number {
    return this.reputation
  }

  getConfig(): NodeConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<NodeConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      watching: {
        ...this.config.watching,
        ...(updates.watching || {})
      },
      agents: {
        ...this.config.agents,
        ...(updates.agents || {})
      },
      settings: {
        ...this.config.settings,
        ...(updates.settings || {})
      }
    }

    saveNodeConfig(this.config)

    // Update server
    if (this.socket?.connected) {
      this.socket.emit('node:update', {
        watching: this.config.watching,
        agents: this.config.agents
      })
    }
  }

  isNodeConnected(): boolean {
    return this.isConnected
  }

  getSignalHistory(): Signal[] {
    return [...this.signalHistory]
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let nodeInstance: AgentNode | null = null

export function getAgentNode(): AgentNode {
  if (!nodeInstance) {
    nodeInstance = new AgentNode()
  }
  return nodeInstance
}

export default {
  AgentNode,
  getAgentNode
}
