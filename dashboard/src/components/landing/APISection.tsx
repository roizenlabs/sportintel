import { Code, Zap, Lock, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'

const endpoints = [
  { method: 'GET', path: '/api/v1/odds/:sport', description: 'Live odds from all books' },
  { method: 'GET', path: '/api/v1/arbitrage/:sport', description: 'Current arbitrage opportunities' },
  { method: 'GET', path: '/api/v1/props/:sport', description: 'Player props comparison' },
  { method: 'GET', path: '/api/v1/steam-moves/:sport', description: 'Line movement alerts' },
]

const codeExample = `// Fetch live NBA odds
const response = await fetch(
  'https://api.sportintel.roizenlabs.com/v1/odds/nba',
  {
    headers: {
      'X-API-Key': 'si_live_your_api_key_here'
    }
  }
);

const { games } = await response.json();

// games: [{
//   homeTeam: "Lakers",
//   awayTeam: "Celtics",
//   odds: {
//     draftkings: { home: -110, away: +105 },
//     fanduel: { home: -108, away: +102 },
//     ...
//   }
// }]`

export default function APISection() {
  return (
    <section id="api" className="py-24 relative bg-[#111827]/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Info */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Code className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">Developer API</span>
            </div>

            <h2 className="text-4xl font-bold text-white mb-6">
              Build with RoizenLabs API
            </h2>

            <p className="text-xl text-gray-400 mb-8">
              Integrate real-time odds, arbitrage data, and AI projections into your applications.
              RESTful API with comprehensive documentation.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-white font-medium">Fast</div>
                  <div className="text-gray-400 text-sm">&lt;100ms response</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-medium">Secure</div>
                  <div className="text-gray-400 text-sm">API key auth</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-white font-medium">RESTful</div>
                  <div className="text-gray-400 text-sm">JSON responses</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Code className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-white font-medium">Documented</div>
                  <div className="text-gray-400 text-sm">OpenAPI spec</div>
                </div>
              </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-3 mb-8">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.path}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                >
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded">
                    {endpoint.method}
                  </span>
                  <code className="text-gray-300 font-mono text-sm">{endpoint.path}</code>
                  <span className="text-gray-500 text-sm ml-auto hidden sm:block">
                    {endpoint.description}
                  </span>
                </div>
              ))}
            </div>

            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
            >
              <Code className="w-5 h-5" />
              View API Documentation
            </Link>
          </div>

          {/* Right Side - Code Example */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl blur-xl" />
            <div className="relative bg-[#1e1e1e] rounded-2xl border border-gray-700/50 overflow-hidden">
              {/* Code Header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-gray-400 text-sm ml-2">example.js</span>
              </div>
              {/* Code Content */}
              <div className="p-4 overflow-x-auto">
                <pre className="text-sm font-mono">
                  <code className="text-gray-300">{codeExample}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
