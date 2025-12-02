import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Activity, TrendingUp, DollarSign, Bell, Zap, RefreshCw } from 'lucide-react'
import LiveOdds from './components/LiveOdds'
import ArbitrageScanner from './components/ArbitrageScanner'
import LineMovement from './components/LineMovement'
import AlertSettings from './components/AlertSettings'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 10000,
    },
  },
})

type Sport = 'nba' | 'nfl' | 'mlb' | 'nhl'
type Tab = 'odds' | 'arbitrage' | 'movement' | 'alerts'

function Dashboard() {
  const [sport, setSport] = useState<Sport>('nba')
  const [activeTab, setActiveTab] = useState<Tab>('odds')
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SportIntel</h1>
                <p className="text-xs text-gray-400">Real-time Sports Analytics</p>
              </div>
            </div>
            
            {/* Sport Selector */}
            <div className="flex gap-2">
              {(['nba', 'nfl', 'mlb', 'nhl'] as Sport[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    sport === s
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500 pulse-green"></div>
                <span>Live</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-4 h-4" />
                <span>{lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 border-b border-gray-800 pb-4">
          <button
            onClick={() => setActiveTab('odds')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'odds'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Odds
          </button>
          <button
            onClick={() => setActiveTab('arbitrage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'arbitrage'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Arbitrage
          </button>
          <button
            onClick={() => setActiveTab('movement')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'movement'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Line Movement
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'alerts'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            Alerts
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === 'odds' && <LiveOdds sport={sport} />}
        {activeTab === 'arbitrage' && <ArbitrageScanner sport={sport} />}
        {activeTab === 'movement' && <LineMovement sport={sport} />}
        {activeTab === 'alerts' && <AlertSettings />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
