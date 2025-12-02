import { useState, useEffect } from 'react'
import { DollarSign, AlertTriangle, Calculator } from 'lucide-react'
import axios from 'axios'

interface ArbitrageOpportunity {
  id: string
  game: string
  profit: number
  book1: { name: string; bet: string; odds: number; stake: number }
  book2: { name: string; bet: string; odds: number; stake: number }
  expiresIn: string
}

interface ArbitrageScannerProps {
  sport: string
}

export default function ArbitrageScanner({ sport }: ArbitrageScannerProps) {
  const [arbs, setArbs] = useState<ArbitrageOpportunity[]>([])
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<Date | null>(null)
  const [stakeAmount, setStakeAmount] = useState(1000)
  const [scannedGames, setScannedGames] = useState(0)

  const runScan = async () => {
    setScanning(true)
    try {
      const response = await axios.get(`/api/arbitrage/${sport}`)
      setArbs(response.data.opportunities || [])
      setScannedGames(response.data.scannedGames || 0)
      setLastScan(new Date())
    } catch (err) {
      console.error('Arbitrage scan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    runScan()
    const interval = setInterval(runScan, 30000) // Auto-scan every 30 seconds
    return () => clearInterval(interval)
  }, [sport])

  return (
    <div className="space-y-6">
      {/* Scanner Controls */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-500" />
              Arbitrage Scanner
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Scanning {sport.toUpperCase()} • {scannedGames} games • DraftKings, FanDuel, Bovada
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Stake:</span>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
            </div>
            <button
              onClick={runScan}
              disabled={scanning}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Scanning...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Scan Now
                </>
              )}
            </button>
          </div>
        </div>
        
        {lastScan && (
          <p className="text-xs text-gray-500 mt-4">
            Last scan: {lastScan.toLocaleTimeString()} • Auto-refreshes every 30s
          </p>
        )}
      </div>

      {/* Results */}
      {arbs.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Arbitrage Found</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Scanned {scannedGames} games. Markets are currently efficient - arbitrage opportunities are rare and close within seconds.
          </p>
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg max-w-md mx-auto">
            <p className="text-sm text-gray-300">
              💡 <strong>Pro Tip:</strong> Arbitrage is most common during high-volume betting windows
              (game day, breaking news) when books haven't synced their lines.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-green-400 font-semibold text-lg">
            🎯 Found {arbs.length} arbitrage opportunit{arbs.length === 1 ? 'y' : 'ies'}!
          </div>
          {arbs.map((arb) => (
            <div key={arb.id} className="glass-card p-6 border-green-500/30 border-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{arb.game}</h3>
                  <p className="text-sm text-gray-400">{arb.expiresIn}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">+{arb.profit.toFixed(2)}%</div>
                  <div className="text-sm text-gray-400">
                    ${((arb.profit / 100) * stakeAmount).toFixed(2)} guaranteed profit
                  </div>
                </div>
              </div>
              
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-gray-700">
                    <th className="text-left py-2">Book</th>
                    <th className="text-left py-2">Bet</th>
                    <th className="text-center py-2">Odds</th>
                    <th className="text-right py-2">Stake</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr>
                    <td className="py-2 font-medium capitalize">{arb.book1.name}</td>
                    <td className="py-2">{arb.book1.bet}</td>
                    <td className="py-2 text-center text-green-400">{arb.book1.odds > 0 ? '+' : ''}{arb.book1.odds}</td>
                    <td className="py-2 text-right">${((arb.book1.stake / 100) * stakeAmount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium capitalize">{arb.book2.name}</td>
                    <td className="py-2">{arb.book2.bet}</td>
                    <td className="py-2 text-center text-green-400">{arb.book2.odds > 0 ? '+' : ''}{arb.book2.odds}</td>
                    <td className="py-2 text-right">${((arb.book2.stake / 100) * stakeAmount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
