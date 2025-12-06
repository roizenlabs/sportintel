import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

interface TickerGame {
  id: string
  homeTeam: string
  awayTeam: string
  startTime: string
  sport: string
  odds: {
    draftkings?: { home: number; away: number; spread?: number }
    fanduel?: { home: number; away: number; spread?: number }
    bovada?: { home: number; away: number; spread?: number }
  }
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getTeamAbbrev(team: string): string {
  // Common abbreviations
  const abbrevs: Record<string, string> = {
    'Los Angeles Lakers': 'LAL',
    'Los Angeles Clippers': 'LAC',
    'Golden State Warriors': 'GSW',
    'Boston Celtics': 'BOS',
    'Miami Heat': 'MIA',
    'New York Knicks': 'NYK',
    'Chicago Bulls': 'CHI',
    'Dallas Mavericks': 'DAL',
    'Phoenix Suns': 'PHX',
    'Milwaukee Bucks': 'MIL',
    'Denver Nuggets': 'DEN',
    'Philadelphia 76ers': 'PHI',
    'Brooklyn Nets': 'BKN',
    'Atlanta Hawks': 'ATL',
    'Toronto Raptors': 'TOR',
    'Cleveland Cavaliers': 'CLE',
    'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP',
    'Sacramento Kings': 'SAC',
    'Orlando Magic': 'ORL',
    'Indiana Pacers': 'IND',
    'Portland Trail Blazers': 'POR',
    'Detroit Pistons': 'DET',
    'Charlotte Hornets': 'CHA',
    'Washington Wizards': 'WAS',
    'Utah Jazz': 'UTA',
    'San Antonio Spurs': 'SAS',
    'Oklahoma City Thunder': 'OKC',
    'Memphis Grizzlies': 'MEM',
    'Houston Rockets': 'HOU',
  }
  return abbrevs[team] || team.slice(0, 3).toUpperCase()
}

function getBestOdds(game: TickerGame, side: 'home' | 'away'): number | null {
  if (!game.odds) return null
  let best: number | null = null
  for (const bookOdds of Object.values(game.odds)) {
    if (bookOdds && bookOdds[side] != null) {
      if (best === null || bookOdds[side] > best) {
        best = bookOdds[side]
      }
    }
  }
  return best
}

export default function LiveOddsTicker() {
  const [games, setGames] = useState<TickerGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAllOdds = async () => {
      try {
        // Fetch odds for multiple sports
        const sports = ['nba', 'nfl', 'nhl', 'mlb']
        const responses = await Promise.all(
          sports.map(sport =>
            fetch(`${API_BASE}/api/odds/${sport}`)
              .then(r => r.ok ? r.json() : { games: [] })
              .catch(() => ({ games: [] }))
          )
        )

        const allGames: TickerGame[] = []
        responses.forEach((data, idx) => {
          if (data.games) {
            data.games.forEach((game: any) => {
              // Transform API format to component format
              const odds: TickerGame['odds'] = {}
              if (game.books) {
                game.books.forEach((book: any) => {
                  odds[book.bookmaker as keyof typeof odds] = {
                    home: book.homeOdds,
                    away: book.awayOdds,
                    spread: book.homeSpread
                  }
                })
              }
              allGames.push({
                id: game.gameId || game.id,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                startTime: game.startTime,
                sport: sports[idx].toUpperCase(),
                odds
              })
            })
          }
        })

        setGames(allGames.slice(0, 20)) // Limit to 20 games
      } catch (err) {
        console.error('Failed to fetch ticker odds:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAllOdds()
    const interval = setInterval(fetchAllOdds, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading || games.length === 0) {
    return (
      <div className="bg-[#0d1421] border-b border-gray-800 py-2 overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Loading live odds...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0d1421] border-b border-gray-800 py-2 overflow-hidden">
      <div className="ticker-wrapper">
        <div className="ticker-content">
          {/* Duplicate content for seamless loop */}
          {[...games, ...games].map((game, idx) => {
            const homeOdds = getBestOdds(game, 'home')
            const awayOdds = getBestOdds(game, 'away')

            return (
              <div
                key={`${game.id}-${idx}`}
                className="inline-flex items-center gap-3 px-4 border-r border-gray-700/50"
              >
                {/* Sport badge */}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                  {game.sport}
                </span>

                {/* Teams and odds */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm font-medium">
                    {getTeamAbbrev(game.awayTeam)}
                  </span>
                  {awayOdds !== null && (
                    <span className={`text-sm font-mono ${awayOdds > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatOdds(awayOdds)}
                    </span>
                  )}
                  <span className="text-gray-600 text-xs">@</span>
                  <span className="text-white text-sm font-medium">
                    {getTeamAbbrev(game.homeTeam)}
                  </span>
                  {homeOdds !== null && (
                    <span className={`text-sm font-mono ${homeOdds > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatOdds(homeOdds)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
