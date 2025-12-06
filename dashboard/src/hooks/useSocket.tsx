/**
 * WebSocket Hook for Real-Time Updates
 *
 * Provides real-time arbitrage, odds, and steam move updates
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// WebSocket connects directly to API server (not through Vite proxy)
const SOCKET_URL = 'http://localhost:8080'

export interface ArbitrageOpportunity {
  id: string
  type: 'moneyline' | 'spread' | 'total' | 'prop'
  game: string
  gameId: string
  sport: string
  profit: number
  book1: {
    name: string
    bet: string
    odds: number
    stake: number
    decimalOdds: number
  }
  book2: {
    name: string
    bet: string
    odds: number
    stake: number
    decimalOdds: number
  }
  totalImplied: number
  detectedAt: number
  expiresAt: number
  delayed?: boolean
}

export interface SteamMove {
  gameId: string
  game: string
  book: string
  oldLine: number
  newLine: number
  change: number
  significance: 'low' | 'medium' | 'high' | 'steam'
}

export interface SocketState {
  connected: boolean
  tier: 'free' | 'pro' | 'premium'
  latency: number
}

export function useSocket(token?: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [state, setState] = useState<SocketState>({
    connected: false,
    tier: 'free',
    latency: 0
  })
  const [arbitrages, setArbitrages] = useState<ArbitrageOpportunity[]>([])
  const [lastArbitrage, setLastArbitrage] = useState<ArbitrageOpportunity | null>(null)
  const [steamMoves, setSteamMoves] = useState<SteamMove[]>([])
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPingRef = useRef<number>(0)

  // Connect to WebSocket
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    })

    socketRef.current = socket

    // Connection events
    socket.on('connect', () => {
      console.log('[WS] Connected')
      setState(prev => ({ ...prev, connected: true }))

      // Subscribe to arbitrage updates
      socket.emit('subscribe:arbitrage')
    })

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected')
      setState(prev => ({ ...prev, connected: false }))
    })

    socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message)
    })

    // Connection status from server
    socket.on('connection:status', (status) => {
      setState(prev => ({
        ...prev,
        tier: status.tier || 'free'
      }))
    })

    // Arbitrage events
    socket.on('arbitrage:new', (arb: ArbitrageOpportunity) => {
      console.log('[WS] New arbitrage:', arb.game, `+${arb.profit}%`)
      setLastArbitrage(arb)
      setArbitrages(prev => {
        // Add to front, remove duplicates, limit to 50
        const filtered = prev.filter(a => a.id !== arb.id)
        return [arb, ...filtered].slice(0, 50)
      })
    })

    socket.on('arbitrage:list', (arbs: ArbitrageOpportunity[]) => {
      setArbitrages(arbs)
    })

    socket.on('arbitrage:expired', (arbId: string) => {
      setArbitrages(prev => prev.filter(a => a.id !== arbId))
    })

    // Steam move events
    socket.on('steam:move', (move: SteamMove) => {
      console.log('[WS] Steam move:', move.game, move.change)
      setSteamMoves(prev => [move, ...prev].slice(0, 20))
    })

    // System notifications
    socket.on('system:notification', (msg) => {
      if (msg.type === 'pong') {
        const latency = Date.now() - lastPingRef.current
        setState(prev => ({ ...prev, latency }))
      }
    })

    // Error handling
    socket.on('error', (err) => {
      console.error('[WS] Error:', err)
    })

    // Ping for latency measurement
    pingIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        lastPingRef.current = Date.now()
        socket.emit('ping')
      }
    }, 5000)

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      socket.disconnect()
    }
  }, [token])

  // Subscribe to sport
  const subscribeSport = useCallback((sport: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:sport', sport)
    }
  }, [])

  // Unsubscribe from sport
  const unsubscribeSport = useCallback((sport: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:sport', sport)
    }
  }, [])

  // Clear arbitrages
  const clearArbitrages = useCallback(() => {
    setArbitrages([])
    setLastArbitrage(null)
  }, [])

  // Clear steam moves
  const clearSteamMoves = useCallback(() => {
    setSteamMoves([])
  }, [])

  return {
    ...state,
    arbitrages,
    lastArbitrage,
    steamMoves,
    subscribeSport,
    unsubscribeSport,
    clearArbitrages,
    clearSteamMoves
  }
}

export default useSocket
