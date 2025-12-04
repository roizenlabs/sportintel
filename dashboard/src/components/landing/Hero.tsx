import { ArrowRight, TrendingUp, DollarSign, Zap } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Link } from 'react-router-dom'

export default function Hero() {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth()

  const handleGetStarted = () => {
    setAuthMode('register')
    setShowAuthModal(true)
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
          <Zap className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm font-medium">Real-time Sports Analytics Platform</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Professional Sports
          <br />
          <span className="gradient-text">Data Intelligence</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Real-time odds comparison, market analysis, and AI-powered insights
          for sports analysts. Track line movements and make data-driven decisions.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 group"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <>
              <button
                onClick={handleGetStarted}
                className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 group"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                to="/dashboard"
                className="px-8 py-4 border border-gray-700 hover:border-gray-600 text-white font-semibold rounded-xl transition-all hover:bg-gray-800/50"
              >
                View Live Demo
              </Link>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-3xl font-bold text-white">6+</span>
            </div>
            <p className="text-gray-400">Sportsbooks Tracked</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-3xl font-bold text-white">150+</span>
            </div>
            <p className="text-gray-400">Daily Market Insights</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-3xl font-bold text-white">&lt;1s</span>
            </div>
            <p className="text-gray-400">Real-time Updates</p>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1a] via-transparent to-transparent z-10 pointer-events-none" />
          <div className="glass-card p-2 rounded-2xl border border-gray-700/50 shadow-2xl max-w-5xl mx-auto">
            <div className="bg-[#111827] rounded-xl p-4">
              {/* Mock Dashboard Header */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-800">
                <div className="flex gap-2">
                  {['NBA', 'NFL', 'MLB', 'NHL'].map((sport, i) => (
                    <div
                      key={sport}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        i === 0 ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {sport}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-gray-400">Live</span>
                </div>
              </div>
              {/* Mock Data Rows */}
              <div className="space-y-3">
                {[
                  { team1: 'Lakers', team2: 'Celtics', odds1: '-110', odds2: '+105', edge: 'Value' },
                  { team1: 'Warriors', team2: 'Heat', odds1: '-125', odds2: '+115', edge: null },
                  { team1: 'Bucks', team2: '76ers', odds1: '-105', odds2: '-105', edge: 'Steam' },
                ].map((game, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-white font-medium">{game.team1} @ {game.team2}</div>
                    <div className="flex items-center gap-6">
                      <div className="text-gray-400">{game.odds1}</div>
                      <div className="text-gray-400">{game.odds2}</div>
                      {game.edge && (
                        <div className="px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded font-medium">
                          {game.edge}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
