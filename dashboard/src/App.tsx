import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Activity, TrendingUp, DollarSign, Bell, RefreshCw, User, LogOut, Users, Brain, Shield, Radio, Target, BarChart3, Wifi } from 'lucide-react'
import Logo from './components/Logo'
import LiveOdds from './components/LiveOdds'
import ArbitrageScanner from './components/ArbitrageScanner'
import LineMovement from './components/LineMovement'
import AlertSettings from './components/AlertSettings'
import PlayerProps from './components/PlayerProps'
import NetworkDashboard from './components/NetworkDashboard'
import AuthModal from './components/AuthModal'
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
type Tab = 'odds' | 'arbitrage' | 'movement' | 'props' | 'alerts' | 'network'

interface AuthUser {
  id: number
  email: string
  name?: string
}

function Dashboard() {
  const [sport, setSport] = useState<Sport>('nba')
  const [activeTab, setActiveTab] = useState<Tab>('odds')
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Check for existing session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('accessToken')
    if (savedToken) {
      setToken(savedToken)
      // Optionally fetch user info here
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAuth = (authUser: AuthUser, accessToken: string) => {
    setUser(authUser)
    setToken(accessToken)
  }

  const handleLogout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="lg" />
              <div>
                <h1 className="text-xl font-bold text-white">RoizenLabs</h1>
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

            {/* Status & Auth */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500 pulse-green"></div>
                <span>Live</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-4 h-4" />
                <span>{lastUpdate.toLocaleTimeString()}</span>
              </div>

              {/* Auth */}
              {user ? (
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-sm text-gray-300">{user.name || user.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="ml-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
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
            onClick={() => setActiveTab('props')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'props'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Player Props
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
          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'network'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Wifi className="w-4 h-4" />
            Network
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === 'odds' && <LiveOdds sport={sport} />}
        {activeTab === 'arbitrage' && <ArbitrageScanner sport={sport} />}
        {activeTab === 'movement' && <LineMovement sport={sport} />}
        {activeTab === 'props' && <PlayerProps sport={sport} token={token} />}
        {activeTab === 'alerts' && <AlertSettings />}
        {activeTab === 'network' && <NetworkDashboard token={token} />}
      </main>

      {/* Value Props Section */}
      <section className="border-t border-gray-800 bg-[#111827]/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Why RoizenLabs?</h2>
            <p className="text-gray-400">Professional-grade tools for serious sports bettors</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* AI-Powered Edge */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-green-500/30 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors">
                <Brain className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">AI-Powered Edge</h3>
              <p className="text-gray-400 text-sm">Machine learning projections with confidence scores, ceilings, and floors that go beyond simple averages.</p>
            </div>

            {/* Professional Risk Management */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Risk Management</h3>
              <p className="text-gray-400 text-sm">Kelly Criterion bankroll management to optimize bet sizing and minimize risk of ruin.</p>
            </div>

            {/* Real-Time Intelligence */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-yellow-500/30 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-4 group-hover:bg-yellow-500/30 transition-colors">
                <Radio className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Real-Time Intel</h3>
              <p className="text-gray-400 text-sm">Live data integration with up-to-the-minute injury alerts and news impact analysis.</p>
            </div>

            {/* Market Efficiency Analysis */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-purple-500/30 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Leverage Plays</h3>
              <p className="text-gray-400 text-sm">Automatic identification of high-confidence opportunities with low projected ownership.</p>
            </div>

            {/* Historical Performance Tracking */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-orange-500/30 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                <BarChart3 className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">ROI Tracking</h3>
              <p className="text-gray-400 text-sm">Detailed analytics on your win rates and accuracy by contest type to refine your strategy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuth={handleAuth}
      />
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
