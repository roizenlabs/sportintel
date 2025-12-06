/**
 * Real-Time Arbitrage Scanner Component
 *
 * Shows live arbitrage opportunities via WebSocket
 * No polling - instant updates pushed from server
 */

import { useState, useEffect } from 'react'
import { DollarSign, Zap, Clock, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../hooks/useAuth'

interface RealTimeArbitrageProps {
  sport?: string
}

export default function RealTimeArbitrage({ sport }: RealTimeArbitrageProps) {
  const { token } = useAuth()
  const {
    connected,
    tier,
    latency,
    arbitrages,
    lastArbitrage,
    subscribeSport,
    clearArbitrages
  } = useSocket(token)

  const [stakeAmount, setStakeAmount] = useState(1000)
  const [showNotification, setShowNotification] = useState(false)

  // Subscribe to sport when it changes
  useEffect(() => {
    if (sport && connected) {
      subscribeSport(sport)
    }
  }, [sport, connected, subscribeSport])

  // Show notification when new arb arrives
  useEffect(() => {
    if (lastArbitrage) {
      setShowNotification(true)
      const timer = setTimeout(() => setShowNotification(false), 3000)

      // Play sound for high-value arbs
      if (lastArbitrage.profit >= 1.5) {
        try {
          const audio = new Audio('/notification.mp3')
          audio.volume = 0.3
          audio.play().catch(() => {})
        } catch {}
      }

      return () => clearTimeout(timer)
    }
  }, [lastArbitrage])

  // Filter by sport if specified
  const filteredArbs = sport
    ? arbitrages.filter(a => a.sport === sport)
    : arbitrages

  // Format time ago
  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 5) return 'Just now'
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <div className="space-y-6">
      {/* Header with Connection Status */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              Real-Time Arbitrage
              {tier !== 'free' && (
                <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-0.5 rounded-full">
                  {tier.toUpperCase()}
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Live updates via WebSocket • No refresh needed
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {connected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm">Connected</span>
                  {latency > 0 && (
                    <span className="text-xs opacity-70">{latency}ms</span>
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm">Disconnected</span>
                </>
              )}
            </div>

            {/* Stake Input */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Stake:</span>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tier Warning for Free Users */}
        {tier === 'free' && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚡ Free tier: 5 second delay on arbitrage alerts.
              <a href="/pricing" className="underline ml-1">Upgrade to Pro</a> for instant alerts.
            </p>
          </div>
        )}
      </div>

      {/* New Arbitrage Notification Toast */}
      {showNotification && lastArbitrage && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="glass-card p-4 border-2 border-green-500/50 shadow-xl shadow-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white font-semibold">New Arbitrage Found!</p>
                <p className="text-green-400 text-sm">
                  {lastArbitrage.game} • +{lastArbitrage.profit.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Arbitrage List */}
      {filteredArbs.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Scanning for Opportunities</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            {connected
              ? 'Watching live odds across all bookmakers. Arbitrage opportunities will appear here instantly.'
              : 'Connecting to real-time feed...'}
          </p>
          {connected && (
            <div className="mt-4 flex items-center justify-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm">Live monitoring active</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-green-400 font-semibold text-lg">
              🎯 {filteredArbs.length} Active Opportunit{filteredArbs.length === 1 ? 'y' : 'ies'}
            </div>
            <button
              onClick={clearArbitrages}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Clear all
            </button>
          </div>

          {filteredArbs.map((arb) => (
            <div
              key={arb.id}
              className={`glass-card p-6 border-2 transition-all ${
                arb.profit >= 2
                  ? 'border-red-500/50 shadow-lg shadow-red-500/10'
                  : arb.profit >= 1
                  ? 'border-yellow-500/30'
                  : 'border-green-500/30'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{arb.game}</h3>
                    <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300 uppercase">
                      {arb.type}
                    </span>
                    {arb.delayed && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                        Delayed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(arb.detectedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    arb.profit >= 2 ? 'text-red-400' : arb.profit >= 1 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    +{arb.profit.toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-400">
                    ${((arb.profit / 100) * stakeAmount).toFixed(2)} profit
                  </div>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-gray-700">
                    <th className="text-left py-2">Book</th>
                    <th className="text-left py-2">Bet</th>
                    <th className="text-center py-2">Odds</th>
                    <th className="text-right py-2">Stake</th>
                    <th className="text-right py-2">Returns</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr>
                    <td className="py-2 font-medium capitalize">{arb.book1.name}</td>
                    <td className="py-2">{arb.book1.bet}</td>
                    <td className="py-2 text-center text-green-400">
                      {arb.book1.odds > 0 ? '+' : ''}{arb.book1.odds}
                    </td>
                    <td className="py-2 text-right">
                      ${((arb.book1.stake / 100) * stakeAmount).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-400">
                      ${(((arb.book1.stake / 100) * stakeAmount) * arb.book1.decimalOdds).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium capitalize">{arb.book2.name}</td>
                    <td className="py-2">{arb.book2.bet}</td>
                    <td className="py-2 text-center text-green-400">
                      {arb.book2.odds > 0 ? '+' : ''}{arb.book2.odds}
                    </td>
                    <td className="py-2 text-right">
                      ${((arb.book2.stake / 100) * stakeAmount).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-400">
                      ${(((arb.book2.stake / 100) * stakeAmount) * arb.book2.decimalOdds).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="border-t border-gray-700">
                  <tr className="text-white font-semibold">
                    <td className="py-2" colSpan={3}>Total</td>
                    <td className="py-2 text-right">${stakeAmount.toFixed(2)}</td>
                    <td className="py-2 text-right text-green-400">
                      ${(stakeAmount * (1 + arb.profit / 100)).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Action hint */}
              <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Combined implied: {arb.totalImplied}%
                </span>
                <span className="text-yellow-400">
                  ⚡ Act fast - odds change quickly
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {filteredArbs.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>
              Best opportunity: +{Math.max(...filteredArbs.map(a => a.profit)).toFixed(2)}%
            </span>
            <span>
              Avg profit: +{(filteredArbs.reduce((sum, a) => sum + a.profit, 0) / filteredArbs.length).toFixed(2)}%
            </span>
            <span>
              Potential: ${filteredArbs.reduce((sum, a) => sum + (a.profit / 100) * stakeAmount, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
