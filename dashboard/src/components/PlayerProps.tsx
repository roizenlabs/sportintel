import { useState, useEffect } from 'react'
import { Search, TrendingUp, Star, StarOff, Filter } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

interface PropComparison {
  player: string
  game: string
  market: string
  line: number
  books: { name: string; over: number; under: number }[]
  bestOver: { book: string; odds: number }
  bestUnder: { book: string; odds: number }
}

interface PlayerPropsProps {
  sport: string
  token?: string | null
}

export default function PlayerProps({ sport, token }: PlayerPropsProps) {
  const [props, setProps] = useState<PropComparison[]>([])
  const [markets, setMarkets] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchProps()
  }, [sport, selectedMarket])

  const fetchProps = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedMarket) params.set('market', selectedMarket)
      const queryString = params.toString() ? `?${params.toString()}` : ''

      const response = await fetch(`${API_BASE}/api/props/${sport}${queryString}`)
      const data = response.ok ? await response.json() : { props: [], markets: [] }
      setProps(data.props || [])
      setMarkets(data.markets || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch props')
    } finally {
      setLoading(false)
    }
  }

  const toggleWatchlist = async (prop: PropComparison) => {
    const key = `${prop.player}|${prop.market}`
    const newWatchlist = new Set(watchlist)

    if (watchlist.has(key)) {
      newWatchlist.delete(key)
    } else {
      newWatchlist.add(key)

      // If logged in, save to backend
      if (token) {
        try {
          await fetch(`${API_BASE}/api/watchlist`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              playerName: prop.player,
              sport,
              propType: prop.market,
              targetLine: prop.line
            })
          })
        } catch (err) {
          console.error('Failed to save to watchlist:', err)
        }
      }
    }

    setWatchlist(newWatchlist)
  }

  const formatOdds = (odds: number) => {
    if (odds === 0) return '-'
    return odds > 0 ? `+${odds}` : odds.toString()
  }

  const filteredProps = props.filter(p =>
    p.player.toLowerCase().includes(search.toLowerCase()) ||
    p.game.toLowerCase().includes(search.toLowerCase())
  )

  const formatMarketLabel = (market: string) => {
    return market.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-400">Loading player props...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchProps} className="mt-4 px-4 py-2 bg-red-500 rounded-lg text-white">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Player Props</h2>
          <p className="text-gray-400 text-sm mt-1">
            Compare odds across {props.length} props from multiple sportsbooks
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search player or game..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 w-64"
            />
          </div>

          {/* Market Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-orange-500"
            >
              <option value="">All Markets</option>
              {markets.map(m => (
                <option key={m} value={m}>{formatMarketLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Props Table */}
      {filteredProps.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No player props available for {sport.toUpperCase()}</p>
          <p className="text-gray-500 text-sm mt-2">Props may not be available for this sport right now</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Prop</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Line</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Best Over</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Best Under</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Books</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Watch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredProps.map((prop, idx) => {
                const key = `${prop.player}|${prop.market}`
                const isWatched = watchlist.has(key)

                return (
                  <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{prop.player}</div>
                      <div className="text-xs text-gray-400">{prop.game}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                        {prop.market}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg font-bold text-white">{prop.line}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-green-400 font-medium">{formatOdds(prop.bestOver.odds)}</div>
                      <div className="text-xs text-gray-500">{prop.bestOver.book}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-red-400 font-medium">{formatOdds(prop.bestUnder.odds)}</div>
                      <div className="text-xs text-gray-500">{prop.bestUnder.book}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {prop.books.map((book, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                            title={`O: ${formatOdds(book.over)} / U: ${formatOdds(book.under)}`}
                          >
                            {book.name.slice(0, 3).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleWatchlist(prop)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isWatched
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-700 text-gray-400 hover:text-yellow-400'
                        }`}
                      >
                        {isWatched ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full"></span>
          <span>Best Over odds (take the over at this book)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span>
          <span>Best Under odds (take the under at this book)</span>
        </div>
      </div>
    </div>
  )
}
