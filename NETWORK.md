# SportIntel Agentic Network

**"Waze for Sports Betting"** - A distributed intelligence network where independent agent nodes share real-time signals.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPORTINTEL NETWORK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │ Agent Node  │    │ Agent Node  │    │ Agent Node  │        │
│   │  (Desktop)  │    │  (Server)   │    │   (Edge)    │        │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│          │                  │                  │                │
│          └──────────────────┼──────────────────┘                │
│                             │                                   │
│                     ┌───────▼───────┐                           │
│                     │  SIGNAL BUS   │                           │
│                     │   (Redis)     │                           │
│                     └───────┬───────┘                           │
│                             │                                   │
│          ┌──────────────────┼──────────────────┐                │
│          │                  │                  │                │
│   ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐        │
│   │   CONTEXT   │    │  ARBITRAGE  │    │  WEBSOCKET  │        │
│   │   LEDGER    │    │   ENGINE    │    │   SERVER    │        │
│   │ (PostgreSQL)│    │   O(n)      │    │ (Socket.io) │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Signal Types

| Type | Description | TTL | Priority |
|------|-------------|-----|----------|
| `steam` | Sharp line movement across 3+ books | 60s | HIGH |
| `arb` | Live arbitrage opportunity | 30s | CRITICAL |
| `dead` | Expired arbitrage (verify before betting) | 300s | HIGH |
| `ev` | Positive expected value situation | 120s | MEDIUM |
| `news` | Breaking news affecting lines | 600s | MEDIUM |
| `pattern` | Historical pattern match detected | 300s | LOW |

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local or Railway/Supabase)
- Redis (local or Upstash)

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Required variables:
DATABASE_URL=postgresql://user:pass@localhost:5432/sportintel
REDIS_URL=redis://localhost:6379
ODDS_API_KEY=your_key_from_the-odds-api.com
JWT_SECRET=generate-a-strong-secret
```

### 3. Run Migrations

```bash
# Install API dependencies
cd api && npm install

# Run database migrations (creates all network tables)
npm run migrate

# Should output:
# ✅ Database "sportintel" exists
# 📝 Running 000_base_schema.sql...
# 📝 Running 001_realtime_system.sql...
# 📝 Running 002_context_ledger.sql...
# ✅ Ran 3 migration(s) successfully!
```

### 4. Start the Network

```bash
# Terminal 1 - Start API Server (with Signal Bus)
cd api && npm run dev

# Terminal 2 - Start Dashboard
cd dashboard && npm run dev
```

API will be at: http://localhost:8080
Dashboard at: http://localhost:3000

## Network Endpoints

### Node Registration
```bash
POST /api/network/register
{
  "id": "node-uuid",
  "watching": { "sports": ["nba", "nfl"], "books": ["draftkings", "fanduel"] },
  "agents": { "sniper": true, "steamChaser": true, "evHunter": false }
}
```

### Signal Publishing
```bash
POST /api/signals/publish
{
  "type": "steam",
  "nodeId": "your-node-id",
  "payload": { 
    "gameId": "game123", 
    "sport": "nba", 
    "description": "Lakers ML moved 3pts across DK/FD/BetMGM",
    "confidence": 85,
    "ttl": 60
  },
  "evidence": {
    "books": ["draftkings", "fanduel", "betmgm"],
    "oldLine": -150,
    "newLine": -180,
    "delta": 30,
    "timestamp": 1701619200000
  }
}
```

### WebSocket Events

```javascript
// Connect to network
const socket = io('http://localhost:8080')

// Register as node
socket.emit('node:register', {
  id: 'your-node-uuid',
  watching: { sports: ['nba'], books: ['draftkings'] },
  agents: { sniper: true, steamChaser: true, evHunter: false }
})

// Subscribe to signals
socket.emit('signals:subscribe')

// Receive signals
socket.on('signal:new', (signal) => {
  console.log(`${signal.type} from ${signal.source.nodeId}: ${signal.payload.description}`)
})

// Publish signal
socket.emit('signal:publish', {
  type: 'arb',
  payload: { gameId: '123', sport: 'nba', description: '2.3% arb', confidence: 95, ttl: 30 },
  evidence: { books: ['dk', 'fd'], profit: 2.3, timestamp: Date.now() }
})
```

## Database Tables (Created by Migration 002)

| Table | Purpose |
|-------|---------|
| `network_nodes` | Node registration, reputation, configuration |
| `line_movements` | Historical line tracking for steam detection |
| `betting_patterns` | Pattern storage with optional pgvector embeddings |
| `signal_outcomes` | Track signal accuracy for reputation |
| `game_context` | Game metadata (weather, injuries, public %) |

## Reputation System

Starting reputation: **50**

| Action | Reputation Change |
|--------|-------------------|
| Arb confirmed live | +10 |
| Steam move followed by cover | +5 |
| Dead arb reported early | +3 |
| First to report (multiplier) | 2x |
| Unique signal (multiplier) | 1.5x |
| False signal | -10 |

## Agent Workflows (Client-Side)

### Steam Chaser
1. Receives `steam` signal
2. Queries context ledger for similar patterns
3. If pattern has >55% cover rate, suggests bet
4. Tracks outcome for learning

### Arb Sniper
1. Receives `arb` signal
2. Validates odds still live
3. Calculates optimal stake
4. If profit > threshold, executes (or alerts)

### EV Hunter
1. Monitors for `ev` signals
2. Compares to closing line value
3. Identifies +EV situations
4. Builds long-term edge tracking

## Production Deployment

### Railway (Recommended)
```bash
# API
railway login
railway init
railway add --redis
railway up

# Environment
railway variables set DATABASE_URL=xxx
railway variables set REDIS_URL=xxx
railway variables set ODDS_API_KEY=xxx
```

### Vercel (Dashboard)
```bash
cd dashboard
vercel
vercel env pull
vercel --prod
```

## File Structure

```
sportintel-mcp/
├── api/
│   ├── lib/
│   │   ├── signal-bus.ts      # Redis pub/sub for signals
│   │   ├── context-ledger.ts  # Pattern matching & history
│   │   ├── arbitrage-engine.ts # O(n) arb detection
│   │   ├── websocket.ts       # Socket.io handlers
│   │   └── redis.ts           # Cache layer
│   ├── db/
│   │   └── migrations/
│   │       ├── 000_base_schema.sql
│   │       ├── 001_realtime_system.sql
│   │       └── 002_context_ledger.sql  # ← Network tables
│   └── server-realtime.ts     # Main API with network endpoints
│
├── dashboard/
│   └── src/
│       ├── lib/
│       │   └── agent-node.ts  # Client-side node implementation
│       └── components/
│           └── NetworkDashboard.tsx  # Network UI
│
└── src/
    └── index.ts               # MCP Server (7 tools)
```

## Status: 95% Complete

✅ Signal Bus (Redis pub/sub)
✅ Context Ledger (PostgreSQL)
✅ Arbitrage Engine (O(n))
✅ WebSocket Server (Socket.io)
✅ Agent Node Client (Browser)
✅ Network Dashboard UI
✅ Database Migrations
✅ API Endpoints
⏳ pgvector (optional, for semantic search)
⏳ Browser Automation (future: Playwright)

**Total: ~8-10 hours of work saved by existing implementation!**
