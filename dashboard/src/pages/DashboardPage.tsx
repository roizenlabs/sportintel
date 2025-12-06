import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Activity, TrendingUp, DollarSign, Bell, RefreshCw, User, LogOut, Users, Home, Lock } from 'lucide-react'
import Logo from '../components/Logo'
import LiveOdds from '../components/LiveOdds'
import ArbitrageScanner from '../components/ArbitrageScanner'
import LineMovement from '../components/LineMovement'
import AlertSettings from '../components/AlertSettings'
import PlayerProps from '../components/PlayerProps'
import LiveOddsTicker from '../components/LiveOddsTicker'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../hooks/useAuth'

type Sport = 'nba' | 'nfl' | 'mlb' | 'nhl'
type Tab = 'odds' | 'arbitrage' | 'movement' | 'props' | 'alerts'

export default function DashboardPage() {
  const [sport, setSport] = useState<Sport>('nba')
  const [activeTab, setActiveTab] = useState<Tab>('odds')
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const { user, token, logout, showAuthModal, setShowAuthModal, login, isLoading, setAuthMode } = useAuth()

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAuth = (authUser: { id: number | string; email: string; name?: string }, accessToken: string, refreshToken: string) => {
    login({ ...authUser, id: String(authUser.id) }, accessToken, refreshToken)
  }

  const openLogin = () => {
    setAuthMode('login')
    setShowAuthModal(true)
  }

  const openRegister = () => {
    setAuthMode('register')
    setShowAuthModal(true)
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    )
  }

  // Show locked state for unauthenticated users
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0f1a]">
        {/* Header */}
        <header className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <Logo size="lg" />
                <div>
                  <h1 className="text-xl font-bold text-white">RoizenLabs</h1>
                  <p className="text-xs text-gray-400">Real-time Sports Analytics</p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <button
                  onClick={openLogin}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={openRegister}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Live Ticker */}
        <LiveOddsTicker />

        {/* Locked Dashboard Preview */}
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 mb-6">
              <Lock className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Sign in to Access Full Dashboard
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              Get real-time odds, arbitrage opportunities, line movements, and player props across all major sportsbooks.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={openRegister}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                Create Free Account
              </button>
              <button
                onClick={openLogin}
                className="px-6 py-3 border border-gray-600 text-gray-300 font-medium rounded-xl hover:border-gray-500 hover:text-white transition-all"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Feature preview cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-60">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <Activity className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-white font-semibold mb-2">Live Odds</h3>
              <p className="text-gray-400 text-sm">Compare odds across DraftKings, FanDuel, BetMGM, and more</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <DollarSign className="w-8 h-8 text-green-400 mb-4" />
              <h3 className="text-white font-semibold mb-2">Arbitrage Scanner</h3>
              <p className="text-gray-400 text-sm">Find guaranteed profit opportunities in real-time</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <TrendingUp className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-white font-semibold mb-2">Line Movement</h3>
              <p className="text-gray-400 text-sm">Track sharp money and line shifts as they happen</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <Users className="w-8 h-8 text-orange-400 mb-4" />
              <h3 className="text-white font-semibold mb-2">Player Props</h3>
              <p className="text-gray-400 text-sm">AI-powered player prop analysis and predictions</p>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuth={handleAuth}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111827]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <Logo size="lg" />
                <div>
                  <h1 className="text-xl font-bold text-white">RoizenLabs</h1>
                  <p className="text-xs text-gray-400">Real-time Sports Analytics</p>
                </div>
              </Link>
              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm"
              >
                <Home className="w-4 h-4" />
                Home
              </Link>
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
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500 pulse-green"></div>
                <span>Live</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-4 h-4" />
                <span>{lastUpdate.toLocaleTimeString()}</span>
              </div>

              {/* Auth */}
              {user ? (
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-700">
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-sm text-gray-300">{user.name || user.email}</span>
                  </div>
                  <button
                    onClick={logout}
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
        <div className="flex gap-2 border-b border-gray-800 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('odds')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
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
        {activeTab === 'props' && <PlayerProps sport={sport} token={token} />}
        {activeTab === 'alerts' && <AlertSettings />}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuth={handleAuth}
      />
    </div>
  )
}
