import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

interface SteamMove {
  gameId: string
  book: string
  oldLine: number
  newLine: number
  change: number
  time: string
  significance: 'low' | 'medium' | 'high' | 'steam'
}

interface LineMovementProps {
  sport: string
}

function getSignificanceColor(sig: SteamMove['significance']): string {
  switch (sig) {
    case 'steam': return 'bg-red-500/20 text-red-400 border-red-500/50'
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
  }
}

export default function LineMovement({ sport }: LineMovementProps) {
  const [steamMoves, setSteamMoves] = useState<SteamMove[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '24h' | '7d'>('24h')

  useEffect(() => {
    const fetchSteamMoves = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/api/steam-moves/${sport}`)
        const data = response.ok ? await response.json() : { movements: [], steamSignals: [] }

        // Transform API response to component format
        const moves: SteamMove[] = []

        // Add line movements from database
        for (const m of data.movements || []) {
          moves.push({
            gameId: m.game_id,
            book: m.bookmaker,
            oldLine: m.old_line || m.old_odds,
            newLine: m.new_line || m.new_odds,
            change: m.delta,
            time: new Date(m.captured_at).toLocaleTimeString(),
            significance: Math.abs(m.delta) >= 20 ? 'steam' : Math.abs(m.delta) >= 10 ? 'high' : Math.abs(m.delta) >= 5 ? 'medium' : 'low'
          })
        }

        // Add steam signals from network
        for (const s of data.steamSignals || []) {
          moves.push({
            gameId: s.payload.gameId,
            book: s.evidence.books?.join(', ') || 'multiple',
            oldLine: s.evidence.oldLine || 0,
            newLine: s.evidence.newLine || 0,
            change: s.evidence.delta || 0,
            time: new Date(s.createdAt).toLocaleTimeString(),
            significance: 'steam'
          })
        }

        setSteamMoves(moves)
      } catch (err) {
        console.error('Failed to fetch steam moves:', err)
        setSteamMoves([])
      } finally {
        setLoading(false)
      }
    }

    fetchSteamMoves()
    const interval = setInterval(fetchSteamMoves, 30000)
    return () => clearInterval(interval)
  }, [sport])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Steam Move Alerts */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-500" />
          Steam Moves
          <span className="text-sm font-normal text-gray-400">
            (Significant line movements)
          </span>
        </h2>
        
        {steamMoves.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">No significant line movements detected yet</p>
            <p className="text-sm text-gray-500">
              Line tracking begins when odds are fetched. Check the Live Odds tab first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {steamMoves.map((move, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${getSignificanceColor(move.significance)}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-white">Game ID: {move.gameId.slice(0, 8)}...</div>
                    <div className="text-sm opacity-80 capitalize">{move.book}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{move.oldLine > 0 ? '+' : ''}{move.oldLine}</span>
                      <span className="text-white">→</span>
                      <span className="font-bold">{move.newLine > 0 ? '+' : ''}{move.newLine}</span>
                      {move.change < 0 ? (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div className="text-xs opacity-60 flex items-center gap-1 justify-end mt-1">
                      <Clock className="w-3 h-3" />
                      {move.time}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6 text-blue-500" />
          Line Movement Tracking
        </h2>
        
        <div className="flex gap-2 mb-4">
          {(['1h', '4h', '24h', '7d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                timeframe === tf
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="p-4 bg-gray-800/50 rounded-lg">
          <p className="text-gray-300 text-sm">
            📊 <strong>How it works:</strong> Every time you view Live Odds, we snapshot the lines. 
            When odds move significantly (10+ points), it appears here as a "steam move."
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Steam moves indicate sharp money or breaking news. The more you refresh Live Odds, 
            the more data points we collect for trend analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
