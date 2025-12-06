/**
 * Network Dashboard - Main hub for the Agentic Network
 *
 * Displays:
 * - Network status and stats
 * - Live signal feed
 * - Node configuration
 * - Reputation tracking
 */

import { useState, useEffect } from 'react'
import {
  Radio,
  Users,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react'
import { getAgentNode, type Signal, type NetworkStats, type NodeConfig } from '../lib/agent-node'

interface NetworkDashboardProps {
  token?: string | null
}

export default function NetworkDashboard({ token }: NetworkDashboardProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [nodeId, setNodeId] = useState<string>('')
  const [reputation, setReputation] = useState(50)
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [config, setConfig] = useState<NodeConfig | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agentNode = getAgentNode()

  // Connect to network on mount
  useEffect(() => {
    connectToNetwork()

    return () => {
      // Cleanup on unmount
      agentNode.disconnect()
    }
  }, [token])

  // Set up signal handlers
  useEffect(() => {
    if (!isConnected) return

    // Listen for all signals
    const unsubscribe = agentNode.onSignal('all', (signal: Signal) => {
      setSignals(prev => [signal, ...prev].slice(0, 50)) // Keep last 50
    })

    // Listen for network stats
    const unsubscribeStats = agentNode.onNetworkStats((stats: NetworkStats) => {
      setNetworkStats(stats)
    })

    return () => {
      unsubscribe()
      unsubscribeStats()
    }
  }, [isConnected])

  async function connectToNetwork() {
    if (isConnecting || isConnected) return

    setIsConnecting(true)
    setError(null)

    try {
      await agentNode.connect(token || undefined)
      setIsConnected(true)
      setNodeId(agentNode.getNodeId())
      setReputation(agentNode.getReputation())
      setConfig(agentNode.getConfig())

      // Load signal history
      setSignals(agentNode.getSignalHistory())
    } catch (err: any) {
      setError(err.message || 'Failed to connect to network')
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  function handleConfigUpdate(updates: Partial<NodeConfig>) {
    if (!config) return

    const newConfig = {
      ...config,
      ...updates,
      watching: { ...config.watching, ...(updates.watching || {}) },
      agents: { ...config.agents, ...(updates.agents || {}) },
      settings: { ...config.settings, ...(updates.settings || {}) }
    }

    agentNode.updateConfig(newConfig)
    setConfig(newConfig)
  }

  function getSignalIcon(type: Signal['type']) {
    switch (type) {
      case 'steam': return <TrendingUp className="w-4 h-4 text-yellow-400" />
      case 'arb': return <Zap className="w-4 h-4 text-green-400" />
      case 'dead': return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'ev': return <CheckCircle className="w-4 h-4 text-blue-400" />
      case 'news': return <Radio className="w-4 h-4 text-purple-400" />
      case 'pattern': return <Activity className="w-4 h-4 text-orange-400" />
      default: return <Zap className="w-4 h-4 text-gray-400" />
    }
  }

  function getSignalColor(type: Signal['type']) {
    switch (type) {
      case 'steam': return 'border-yellow-500/30 bg-yellow-500/10'
      case 'arb': return 'border-green-500/30 bg-green-500/10'
      case 'dead': return 'border-red-500/30 bg-red-500/10'
      case 'ev': return 'border-blue-500/30 bg-blue-500/10'
      case 'news': return 'border-purple-500/30 bg-purple-500/10'
      case 'pattern': return 'border-orange-500/30 bg-orange-500/10'
      default: return 'border-gray-500/30 bg-gray-500/10'
    }
  }

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <div className="space-y-6">
      {/* Network Status Banner */}
      <div className={`rounded-xl p-4 border ${isConnected ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isConnected ? (
              <Wifi className="w-6 h-6 text-green-400" />
            ) : (
              <WifiOff className="w-6 h-6 text-gray-500" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isConnected ? 'Connected to Network' : 'Network Offline'}
              </h2>
              <p className="text-sm text-gray-400">
                {isConnected
                  ? `Node: ${nodeId.slice(0, 8)}... | Reputation: ${reputation}`
                  : 'Click to join the RoizenLabs signal network'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && (
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            {!isConnected && (
              <button
                onClick={connectToNetwork}
                disabled={isConnecting}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    Join Network
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Config Panel */}
      {showConfig && config && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Node Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Watching */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Watching Sports</h4>
              <div className="flex flex-wrap gap-2">
                {['nba', 'nfl', 'mlb', 'nhl'].map(sport => (
                  <button
                    key={sport}
                    onClick={() => {
                      const sports = config.watching.sports.includes(sport)
                        ? config.watching.sports.filter(s => s !== sport)
                        : [...config.watching.sports, sport]
                      handleConfigUpdate({ watching: { ...config.watching, sports } })
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      config.watching.sports.includes(sport)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {sport.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Agents */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Active Agents</h4>
              <div className="space-y-2">
                {[
                  { key: 'steamChaser', label: 'Steam Chaser', desc: 'Track sharp line moves' },
                  { key: 'sniper', label: 'Arb Sniper', desc: 'Auto-validate arbs' },
                  { key: 'evHunter', label: 'EV Hunter', desc: 'Find +EV plays' }
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={config.agents[key as keyof typeof config.agents]}
                      onChange={(e) => handleConfigUpdate({
                        agents: { ...config.agents, [key]: e.target.checked }
                      })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-green-500"
                    />
                    <div>
                      <span className="text-white text-sm">{label}</span>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Thresholds</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Min Arb Profit (%)</label>
                  <input
                    type="number"
                    value={config.settings.minArbProfit}
                    onChange={(e) => handleConfigUpdate({
                      settings: { ...config.settings, minArbProfit: parseFloat(e.target.value) || 0 }
                    })}
                    step="0.1"
                    min="0"
                    className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Min Steam Delta (pts)</label>
                  <input
                    type="number"
                    value={config.settings.minSteamDelta}
                    onChange={(e) => handleConfigUpdate({
                      settings: { ...config.settings, minSteamDelta: parseFloat(e.target.value) || 0 }
                    })}
                    step="0.5"
                    min="0"
                    className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.autoPublish}
                    onChange={(e) => handleConfigUpdate({
                      settings: { ...config.settings, autoPublish: e.target.checked }
                    })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-white text-sm">Auto-publish signals</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">Active Nodes</span>
            </div>
            <p className="text-2xl font-bold text-white">{networkStats?.activeNodes || 0}</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Zap className="w-4 h-4" />
              <span className="text-sm">Signals Today</span>
            </div>
            <p className="text-2xl font-bold text-white">{networkStats?.signalsToday || 0}</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Avg Reputation</span>
            </div>
            <p className="text-2xl font-bold text-white">{networkStats?.avgReputation || 0}</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Your Reputation</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{reputation}</p>
          </div>
        </div>
      )}

      {/* Signal Feed */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Live Signal Feed
          </h3>
          <span className="text-sm text-gray-400">{signals.length} signals</span>
        </div>

        <div className="divide-y divide-gray-700/50 max-h-[500px] overflow-y-auto">
          {signals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {isConnected
                ? 'No signals yet. Waiting for network activity...'
                : 'Connect to the network to receive signals'
              }
            </div>
          ) : (
            signals.map((signal) => (
              <div
                key={signal.id}
                className={`p-4 hover:bg-gray-700/30 transition-colors ${getSignalColor(signal.type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getSignalIcon(signal.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400 uppercase">{signal.type}</span>
                      <span className="text-xs text-gray-500">|</span>
                      <span className="text-xs text-gray-500">{signal.payload.sport.toUpperCase()}</span>
                      <span className="text-xs text-gray-500">|</span>
                      <span className="text-xs text-gray-500">
                        Confidence: {signal.payload.confidence}%
                      </span>
                    </div>
                    <p className="text-white text-sm">{signal.payload.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(signal.createdAt)}
                      </span>
                      <span>
                        Node: {signal.source.nodeId.slice(0, 8)}... (rep: {signal.source.reputation})
                      </span>
                      {signal.evidence.books.length > 0 && (
                        <span>Books: {signal.evidence.books.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  {signal.evidence.profit && (
                    <div className="text-green-400 font-bold">
                      +{signal.evidence.profit.toFixed(2)}%
                    </div>
                  )}
                  {signal.evidence.delta && (
                    <div className="text-yellow-400 font-bold">
                      {signal.evidence.delta > 0 ? '+' : ''}{signal.evidence.delta.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Network Coverage */}
      {isConnected && networkStats?.coverage && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Network Coverage</h3>
          <div className="flex flex-wrap gap-2">
            {networkStats.coverage.sports.map(sport => (
              <span key={sport} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                {sport.toUpperCase()}
              </span>
            ))}
            {networkStats.coverage.books.map(book => (
              <span key={book} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                {book}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
