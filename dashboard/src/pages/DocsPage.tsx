import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Copy, Check, ArrowLeft } from 'lucide-react'
import Logo from '../components/Logo'

const API_BASE = 'https://sport-intel-production.up.railway.app'

interface Endpoint {
  method: 'GET' | 'POST'
  path: string
  description: string
  auth: boolean
  params?: { name: string; type: string; description: string }[]
  response: string
}

const endpoints: { category: string; items: Endpoint[] }[] = [
  {
    category: 'Authentication',
    items: [
      {
        method: 'POST',
        path: '/api/auth/register',
        description: 'Create a new user account',
        auth: false,
        params: [
          { name: 'email', type: 'string', description: 'User email address' },
          { name: 'password', type: 'string', description: 'Password (min 8 characters)' },
          { name: 'name', type: 'string', description: 'Display name (optional)' },
        ],
        response: `{
  "user": { "id": "uuid", "email": "user@example.com" },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}`,
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Authenticate and receive tokens',
        auth: false,
        params: [
          { name: 'email', type: 'string', description: 'User email address' },
          { name: 'password', type: 'string', description: 'User password' },
        ],
        response: `{
  "user": { "id": "uuid", "email": "user@example.com" },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}`,
      },
      {
        method: 'GET',
        path: '/api/auth/me',
        description: 'Get current authenticated user',
        auth: true,
        response: `{
  "user": { "id": "uuid", "email": "user@example.com", "name": "John" }
}`,
      },
    ],
  },
  {
    category: 'Live Odds',
    items: [
      {
        method: 'GET',
        path: '/api/odds/live',
        description: 'Get real-time odds across all sportsbooks',
        auth: true,
        params: [
          { name: 'sport', type: 'string', description: 'Sport filter: nba, nfl, mlb, nhl (optional)' },
        ],
        response: `{
  "odds": [
    {
      "gameId": "abc123",
      "sport": "nba",
      "homeTeam": "Lakers",
      "awayTeam": "Celtics",
      "commence": "2024-01-15T19:00:00Z",
      "books": {
        "draftkings": { "spread": -3.5, "total": 220.5, "moneyline": -150 },
        "fanduel": { "spread": -3, "total": 221, "moneyline": -145 }
      }
    }
  ],
  "remaining": 4950
}`,
      },
    ],
  },
  {
    category: 'Arbitrage',
    items: [
      {
        method: 'GET',
        path: '/api/arbitrage',
        description: 'Get current arbitrage opportunities',
        auth: true,
        response: `{
  "opportunities": [
    {
      "id": "arb-123",
      "sport": "nba",
      "game": "Lakers vs Celtics",
      "type": "moneyline",
      "profit": 2.3,
      "legs": [
        { "book": "draftkings", "side": "Lakers", "odds": -110 },
        { "book": "fanduel", "side": "Celtics", "odds": +125 }
      ],
      "expires": "2024-01-15T18:55:00Z"
    }
  ]
}`,
      },
    ],
  },
  {
    category: 'Player Props',
    items: [
      {
        method: 'GET',
        path: '/api/props',
        description: 'Get player prop lines with projections',
        auth: true,
        params: [
          { name: 'sport', type: 'string', description: 'Sport filter (optional)' },
          { name: 'player', type: 'string', description: 'Player name search (optional)' },
        ],
        response: `{
  "props": [
    {
      "player": "LeBron James",
      "team": "LAL",
      "opponent": "BOS",
      "prop": "points",
      "line": 25.5,
      "projection": 28.2,
      "edge": 10.6,
      "books": {
        "draftkings": { "over": -110, "under": -110 },
        "fanduel": { "over": -108, "under": -112 }
      }
    }
  ]
}`,
      },
    ],
  },
  {
    category: 'Subscriptions',
    items: [
      {
        method: 'GET',
        path: '/api/subscription/tiers',
        description: 'Get available subscription tiers and features',
        auth: false,
        response: `{
  "tiers": {
    "free": { "name": "Free", "price": 0, "features": {...} },
    "pro": { "name": "Pro", "price": 49, "features": {...} },
    "enterprise": { "name": "Enterprise", "price": 199, "features": {...} }
  }
}`,
      },
      {
        method: 'GET',
        path: '/api/subscription',
        description: 'Get current user subscription status',
        auth: true,
        response: `{
  "tier": "pro",
  "features": { "apiCallsPerDay": 5000, "alerts": true },
  "subscription": { "status": "active", "currentPeriodEnd": "2024-02-15" }
}`,
      },
    ],
  },
]

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className={`bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm language-${language}`}>
        <code className="text-gray-300">{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded bg-gray-800 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-bold ${
        method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
      }`}
    >
      {method}
    </span>
  )
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('Authentication')

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0a0f1a]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <Link to="/" className="flex items-center gap-2">
              <Logo size="md" />
              <span className="text-white font-bold">RoizenLabs</span>
            </Link>
          </div>
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <h3 className="text-gray-400 text-sm font-medium mb-4">API Reference</h3>
            {endpoints.map((section) => (
              <button
                key={section.category}
                onClick={() => setActiveSection(section.category)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                  activeSection === section.category
                    ? 'bg-green-500/10 text-green-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {section.category}
                <ChevronRight className={`w-4 h-4 transition-transform ${activeSection === section.category ? 'rotate-90' : ''}`} />
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">API Documentation</h1>
            <p className="text-gray-400 text-lg">
              RoizenLabs provides a RESTful API for accessing real-time sports odds, arbitrage opportunities, and player props.
            </p>
          </div>

          {/* Base URL */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Base URL</h2>
            <CodeBlock code={API_BASE} />
          </section>

          {/* Authentication */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
            <p className="text-gray-400 mb-4">
              All authenticated endpoints require a Bearer token in the Authorization header:
            </p>
            <CodeBlock code={`Authorization: Bearer <your-access-token>`} />
          </section>

          {/* Rate Limits */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Rate Limits</h2>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-4">Tier</th>
                    <th className="pb-4">Daily Requests</th>
                    <th className="pb-4">Price</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-t border-gray-700">
                    <td className="py-4">Free</td>
                    <td className="py-4">100</td>
                    <td className="py-4">$0</td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="py-4">Pro</td>
                    <td className="py-4">5,000</td>
                    <td className="py-4">$49/mo</td>
                  </tr>
                  <tr className="border-t border-gray-700">
                    <td className="py-4">Enterprise</td>
                    <td className="py-4">Unlimited</td>
                    <td className="py-4">$199/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Endpoints */}
          {endpoints.map((section) => (
            <section key={section.category} id={section.category.toLowerCase()} className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">{section.category}</h2>
              <div className="space-y-8">
                {section.items.map((endpoint) => (
                  <div key={endpoint.path} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-3 mb-4">
                      <MethodBadge method={endpoint.method} />
                      <code className="text-white font-mono">{endpoint.path}</code>
                      {endpoint.auth && (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">Auth Required</span>
                      )}
                    </div>
                    <p className="text-gray-400 mb-4">{endpoint.description}</p>

                    {endpoint.params && (
                      <div className="mb-4">
                        <h4 className="text-white font-medium mb-2">Parameters</h4>
                        <div className="bg-gray-900 rounded-lg p-4">
                          {endpoint.params.map((param) => (
                            <div key={param.name} className="flex gap-4 py-2 border-b border-gray-800 last:border-0">
                              <code className="text-green-400">{param.name}</code>
                              <span className="text-gray-500">{param.type}</span>
                              <span className="text-gray-400">{param.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-white font-medium mb-2">Response</h4>
                      <CodeBlock code={endpoint.response} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* WebSocket */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Real-Time Updates (WebSocket)</h2>
            <p className="text-gray-400 mb-4">
              Connect to our WebSocket server for real-time odds updates and alerts:
            </p>
            <CodeBlock
              code={`const socket = io('${API_BASE}', {
  auth: { token: 'your-access-token' }
})

socket.on('odds:update', (data) => {
  console.log('New odds:', data)
})

socket.on('arbitrage:alert', (data) => {
  console.log('Arbitrage opportunity:', data)
})`}
              language="javascript"
            />
          </section>
        </main>
      </div>
    </div>
  )
}
