import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import axios from 'axios'

interface OddsData {
  id: string
  game: string
  homeTeam: string
  awayTeam: string
  startTime: string
  odds: {
    draftkings?: { home: number; away: number; spread?: number }
    fanduel?: { home: number; away: number; spread?: number }
    bovada?: { home: number; away: number; spread?: number }
  }
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getOddsColor(odds: number): string {
  return odds > 0 ? 'text-green-400' : 'text-red-400'
}

function getBestOdds(game: OddsData, side: 'home' | 'away'): { book: string; odds: number } {
  let best = { book: '', odds: -Infinity }
  for (const [book, bookOdds] of Object.entries(game.odds)) {
    if (bookOdds && bookOdds[side] > best.odds) {
      best = { book, odds: bookOdds[side] }
    }
  }
  return best
}

interface LiveOddsProps {
  sport: string
}

export default function LiveOdds({ sport }: LiveOddsProps) {
  const [odds, setOdds] = useState<OddsData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const fetchOdds = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await axios.get(`/api/odds/${sport}`)
        setOdds(response.data.games || [])
        setRemaining(response.data.remaining)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch odds')
        setOdds([])
      } finally {
        setLoading(false)
      }
    }

    fetchOdds()
    const interval = setInterval(fetchOdds, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [sport])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (odds.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-gray-400">No {sport.toUpperCase()} games available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {remaining !== null && (
        <div className="text-sm text-gray-400 text-right">
          API Requests Remaining: <span className="text-green-400 font-medium">{remaining.toLocaleString()}</span>
        </div>
      )}
      
      {odds.map((game) => {
        const bestHome = getBestOdds(game, 'home')
        const bestAway = getBestOdds(game, 'away')
        
        return (
          <div key={game.id} className="glass-card p-6 hover:border-green-500/30 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{game.game}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>{game.startTime}</span>
                </div>
              </div>
              {game.odds.draftkings?.spread && (
                <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                  Spread: {game.odds.draftkings.spread > 0 ? '+' : ''}{game.odds.draftkings.spread}
                </div>
              )}
            </div>

            {/* Odds Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-sm">
                    <th className="text-left py-2 font-medium">Team</th>
                    <th className="text-center py-2 font-medium">DraftKings</th>
                    <th className="text-center py-2 font-medium">FanDuel</th>
                    <th className="text-center py-2 font-medium">Bovada</th>
                    <th className="text-right py-2 font-medium">Best Odds</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr className="border-t border-gray-700/50">
                    <td className="py-3 font-medium">{game.homeTeam}</td>
                    <td className={`text-center py-3 ${getOddsColor(game.odds.draftkings?.home || 0)}`}>
                      {game.odds.draftkings ? formatOdds(game.odds.draftkings.home) : '-'}
                    </td>
                    <td className={`text-center py-3 ${getOddsColor(game.odds.fanduel?.home || 0)}`}>
                      {game.odds.fanduel ? formatOdds(game.odds.fanduel.home) : '-'}
                    </td>
                    <td className={`text-center py-3 ${getOddsColor(game.odds.bovada?.home || 0)}`}>
                      {game.odds.bovada ? formatOdds(game.odds.bovada.home) : '-'}
                    </td>
                    <td className="text-right py-3">
                      <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-sm font-medium">
                        {formatOdds(bestHome.odds)} ({bestHome.book})
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t border-gray-700/50">
                    <td className="py-3 font-medium">{game.awayTeam}</td>
                    <td className={`text-center py-3 ${getOddsColor(game.odds.draftkings?.away || 0)}`}>
                      {game.odds.draftkings ? formatOdds(game.odds.draftkings.away) : '-'}
                    </td>
                    <td className={`text-center py-3 ${getOddsColor(game.odds.fanduel?.away || 0)}`}>
                      {game.odds.fanduel ? formatOdds(game.odds.fanduel.away) : '-'}
                    </td>
                    <td className={`text-center py-3 ${getOddsColor(game.odds.bovada?.away || 0)}`}>
                      {game.odds.bovada ? formatOdds(game.odds.bovada.away) : '-'}
                    </td>
                    <td className="text-right py-3">
                      <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-sm font-medium">
                        {formatOdds(bestAway.odds)} ({bestAway.book})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
