import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Zap, Target } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

interface TickerItem {
  id: string
  type: 'arb' | 'edge' | 'value' | 'steam' | 'scan'
  sport: string
  title: string
  detail: string
  value?: string
  icon: 'arb' | 'edge' | 'value' | 'steam' | 'scan'
  timestamp: number
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getTeamAbbrev(team: string): string {
  const abbrevs: Record<string, string> = {
    'Los Angeles Lakers': 'LAL', 'Los Angeles Clippers': 'LAC', 'Golden State Warriors': 'GSW',
    'Boston Celtics': 'BOS', 'Miami Heat': 'MIA', 'New York Knicks': 'NYK', 'Chicago Bulls': 'CHI',
    'Dallas Mavericks': 'DAL', 'Phoenix Suns': 'PHX', 'Milwaukee Bucks': 'MIL', 'Denver Nuggets': 'DEN',
    'Philadelphia 76ers': 'PHI', 'Brooklyn Nets': 'BKN', 'Atlanta Hawks': 'ATL', 'Toronto Raptors': 'TOR',
    'Cleveland Cavaliers': 'CLE', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP',
    'Sacramento Kings': 'SAC', 'Orlando Magic': 'ORL', 'Indiana Pacers': 'IND', 'Portland Trail Blazers': 'POR',
    'Detroit Pistons': 'DET', 'Charlotte Hornets': 'CHA', 'Washington Wizards': 'WAS', 'Utah Jazz': 'UTA',
    'San Antonio Spurs': 'SAS', 'Oklahoma City Thunder': 'OKC', 'Memphis Grizzlies': 'MEM', 'Houston Rockets': 'HOU',
  }
  return abbrevs[team] || team.split(' ').pop()?.slice(0, 3).toUpperCase() || team.slice(0, 3).toUpperCase()
}

function getIconComponent(type: TickerItem['icon']) {
  switch (type) {
    case 'arb': return <DollarSign className="w-3 h-3" />
    case 'edge': return <Target className="w-3 h-3" />
    case 'value': return <TrendingUp className="w-3 h-3" />
    case 'steam': return <Zap className="w-3 h-3" />
    default: return <TrendingUp className="w-3 h-3" />
  }
}

function getTypeColor(type: TickerItem['type']) {
  switch (type) {
    case 'arb': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'edge': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'value': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'steam': return 'bg-red-500/20 text-red-400 border-red-500/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

function getValueColor(type: TickerItem['type']) {
  switch (type) {
    case 'arb': return 'text-green-400'
    case 'edge': return 'text-blue-400'
    case 'value': return 'text-yellow-400'
    case 'steam': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

export default function LiveOddsTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ scanned: 0, sports: 0 })

  useEffect(() => {
    const fetchScannerData = async () => {
      try {
        const tickerItems: TickerItem[] = []
        const sports = ['nba', 'nfl', 'nhl', 'mlb']
        let totalScanned = 0
        let activeSports = 0

        // Fetch arbitrage opportunities
        const arbResponses = await Promise.all(
          sports.map(sport =>
            fetch(`${API_BASE}/api/arbitrage/${sport}`)
              .then(r => r.ok ? r.json() : { opportunities: [], scannedGames: 0 })
              .catch(() => ({ opportunities: [], scannedGames: 0 }))
          )
        )

        arbResponses.forEach((data, idx) => {
          const sport = sports[idx].toUpperCase()
          totalScanned += data.scannedGames || 0
          if (data.scannedGames > 0) activeSports++

          // Add arbitrage opportunities
          if (data.opportunities?.length > 0) {
            data.opportunities.forEach((arb: any) => {
              tickerItems.push({
                id: arb.id,
                type: 'arb',
                sport,
                title: `ARB +${arb.profit.toFixed(1)}%`,
                detail: `${arb.book1?.name} vs ${arb.book2?.name}`,
                value: `+${arb.profit.toFixed(2)}%`,
                icon: 'arb',
                timestamp: arb.detectedAt || Date.now()
              })
            })
          }
        })

        // Fetch odds to find best value picks
        const oddsResponses = await Promise.all(
          sports.map(sport =>
            fetch(`${API_BASE}/api/odds/${sport}`)
              .then(r => r.ok ? r.json() : { games: [] })
              .catch(() => ({ games: [] }))
          )
        )

        oddsResponses.forEach((data, idx) => {
          const sport = sports[idx].toUpperCase()
          if (!data.games) return

          data.games.forEach((game: any) => {
            if (!game.books || game.books.length < 2) return

            // Find best odds difference between books (edge detection)
            let maxHomeDiff = 0, maxAwayDiff = 0
            let bestHomeBook = '', bestAwayBook = ''
            let bestHomeOdds = -Infinity, bestAwayOdds = -Infinity
            let worstHomeOdds = Infinity, worstAwayOdds = Infinity

            game.books.forEach((book: any) => {
              if (book.homeOdds > bestHomeOdds) {
                bestHomeOdds = book.homeOdds
                bestHomeBook = book.bookmaker
              }
              if (book.awayOdds > bestAwayOdds) {
                bestAwayOdds = book.awayOdds
                bestAwayBook = book.bookmaker
              }
              if (book.homeOdds < worstHomeOdds) worstHomeOdds = book.homeOdds
              if (book.awayOdds < worstAwayOdds) worstAwayOdds = book.awayOdds
            })

            maxHomeDiff = bestHomeOdds - worstHomeOdds
            maxAwayDiff = bestAwayOdds - worstAwayOdds

            // Show significant edges (15+ point difference)
            if (maxHomeDiff >= 15 || maxAwayDiff >= 15) {
              const isHome = maxHomeDiff >= maxAwayDiff
              const team = isHome ? game.homeTeam : game.awayTeam
              const book = isHome ? bestHomeBook : bestAwayBook
              const odds = isHome ? bestHomeOdds : bestAwayOdds
              const diff = isHome ? maxHomeDiff : maxAwayDiff

              tickerItems.push({
                id: `edge-${game.gameId}-${isHome ? 'home' : 'away'}`,
                type: 'edge',
                sport,
                title: `${getTeamAbbrev(team)} Edge`,
                detail: `${book.toUpperCase()} ${formatOdds(odds)}`,
                value: `+${diff.toFixed(0)} pts`,
                icon: 'edge',
                timestamp: Date.now() - Math.random() * 300000
              })
            }

            // Show big underdogs with good value (positive odds > +200)
            if (bestAwayOdds >= 200 || bestHomeOdds >= 200) {
              const isHome = bestHomeOdds >= bestAwayOdds
              const team = isHome ? game.homeTeam : game.awayTeam
              const book = isHome ? bestHomeBook : bestAwayBook
              const odds = isHome ? bestHomeOdds : bestAwayOdds

              tickerItems.push({
                id: `value-${game.gameId}-${isHome ? 'home' : 'away'}`,
                type: 'value',
                sport,
                title: `${getTeamAbbrev(team)} Value`,
                detail: `${book.toUpperCase()} ${formatOdds(odds)}`,
                value: formatOdds(odds),
                icon: 'value',
                timestamp: Date.now() - Math.random() * 300000
              })
            }
          })
        })

        // Add scan status items if we have scanned games
        if (totalScanned > 0) {
          sports.forEach((sport, idx) => {
            const count = arbResponses[idx].scannedGames || 0
            if (count > 0) {
              tickerItems.push({
                id: `scan-${sport}`,
                type: 'scan',
                sport: sport.toUpperCase(),
                title: `${count} Games`,
                detail: 'Scanning live',
                icon: 'scan',
                timestamp: Date.now() - idx * 1000
              })
            }
          })
        }

        // Sort by timestamp (newest first) and limit
        tickerItems.sort((a, b) => b.timestamp - a.timestamp)

        setItems(tickerItems.slice(0, 30))
        setStats({ scanned: totalScanned, sports: activeSports })
      } catch (err) {
        console.error('Failed to fetch ticker data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchScannerData()
    const interval = setInterval(fetchScannerData, 30000) // Update every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0d1421] border-b border-gray-800 py-2 overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Scanning {stats.scanned || 60}+ games across 4 sports...</span>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-[#0d1421] border-b border-gray-800 py-2 overflow-hidden">
        <div className="flex items-center justify-center gap-3 text-gray-400 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Scanner Active</span>
          </div>
          <span className="text-gray-600">|</span>
          <span>{stats.scanned} games monitored</span>
          <span className="text-gray-600">|</span>
          <span>Waiting for opportunities...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0d1421] border-b border-gray-800 py-2 overflow-hidden">
      <div className="ticker-wrapper">
        <div className="ticker-content">
          {/* Duplicate content for seamless loop */}
          {[...items, ...items].map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="inline-flex items-center gap-2 px-4 border-r border-gray-700/50"
            >
              {/* Type badge with icon */}
              <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${getTypeColor(item.type)}`}>
                {getIconComponent(item.icon)}
                {item.sport}
              </span>

              {/* Title and detail */}
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">
                  {item.title}
                </span>
                <span className="text-gray-500 text-xs">
                  {item.detail}
                </span>
                {item.value && (
                  <span className={`text-sm font-mono font-bold ${getValueColor(item.type)}`}>
                    {item.value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
