# SportIntel: Agentic Network Architecture

## Vision: "Waze for Sports Betting"

Transform from a single-player dashboard into a **distributed intelligence network** where every user node contributes to shared alpha.

---

## Core Concept: Data Network Effects (DNE)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPORTINTEL FABRIC                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SIGNAL BUS (Redis Pub/Sub)                      │   │
│  │                                                                      │   │
│  │   Channels:                                                          │   │
│  │   • signals:steam          - Line movement alerts                    │   │
│  │   • signals:arb            - Arbitrage opportunities                 │   │
│  │   • signals:dead           - Dead arbs (failed executions)           │   │
│  │   • signals:ev             - +EV opportunities                       │   │
│  │   • signals:news           - Unpriced news/injuries                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                           │                                                  │
│  ┌────────────────────────┴────────────────────────────────────────────┐   │
│  │                      CONTEXT LEDGER (Postgres + pgvector)            │   │
│  │                                                                      │   │
│  │   • Historical line movements (vectorized for similarity search)     │   │
│  │   • Pattern embeddings ("Mahomes + rain + away game")               │   │
│  │   • Network-contributed signals                                      │   │
│  │   • Agent execution outcomes                                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │   NODE A     │    │   NODE B     │    │   NODE C     │
            │   (User 1)   │    │   (User 2)   │    │   (User 3)   │
            │              │    │              │    │              │
            │ Watching:    │    │ Watching:    │    │ Watching:    │
            │ • NBA        │    │ • NFL        │    │ • MLB        │
            │ • DraftKings │    │ • FanDuel    │    │ • Bovada     │
            │              │    │              │    │              │
            │ Local Agent: │    │ Local Agent: │    │ Local Agent: │
            │ • Sniper     │    │ • EV Hunter  │    │ • Steam Chase│
            └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Network Value Proposition

### Single-Player (Current)
```
Value(User N) = API_Data
# Linear. User 10,000 = User 1
```

### Multi-Player (Target)
```
Value(User N) = API_Data + Σ(Signals from Users 1..N-1)
# Exponential. Each user adds value to all others
```

---

## Three Core Agents

### 1. Arbitrage Sniper (Execution Agent)
```
Trigger: Arb detected >1.5% profit

Flow:
1. Validate odds still live (sub-second)
2. Pre-flight checks:
   - Bankroll strategy compliance
   - Account limits
   - Risk parameters
3. Execute via browser automation (MCP)
4. Report outcome to network:
   - Success → "Arb confirmed live"
   - Failure → "Dead arb" signal (save others time)
```

### 2. Steam Chaser (Signal Agent)
```
Trigger: Steam move detected (2+ points, 3+ books, <10s)

Flow:
1. Query Context Ledger for historical patterns
2. Calculate confidence score
3. Push recommendation:
   "STEAM ALERT: Sharp money on Denver
    Historical pattern: 60% cover rate
    Recommended action: Bet within 45s"
```

### 3. EV+ Hunter (Analysis Agent)
```
Trigger: New game data or news event

Flow:
1. Ingest unstructured data (injuries, weather, social)
2. Detect "information edge" (news not priced in)
3. Calculate theoretical +EV
4. Alert network before books adjust
```

---

## Signal Types

| Signal | Source | TTL | Priority |
|--------|--------|-----|----------|
| `steam` | Any node detects rapid line move | 60s | HIGH |
| `arb` | Arbitrage opportunity found | 30s | CRITICAL |
| `dead` | Arb execution failed | 5min | HIGH |
| `ev` | +EV opportunity identified | 2min | MEDIUM |
| `news` | Unpriced information detected | 10min | MEDIUM |
| `pattern` | Historical pattern matched | 5min | LOW |

---

## Data Model

### Signal (Published to Network)
```typescript
interface Signal {
  id: string
  type: 'steam' | 'arb' | 'dead' | 'ev' | 'news' | 'pattern'
  source: {
    nodeId: string      // Anonymous node identifier
    reputation: number  // 0-100 based on signal accuracy
  }
  payload: {
    gameId: string
    sport: string
    description: string
    confidence: number  // 0-100
    ttl: number        // Seconds until stale
  }
  evidence: {
    books: string[]
    oldLine: number
    newLine: number
    delta: number
    timestamp: number
  }
  createdAt: number
}
```

### Node (Local Client)
```typescript
interface Node {
  id: string           // Unique, anonymous
  watching: {
    sports: string[]
    books: string[]
    markets: string[]
  }
  agents: {
    sniper: boolean
    steamChaser: boolean
    evHunter: boolean
  }
  reputation: number   // Earned from accurate signals
  signalsPublished: number
  signalsConsumed: number
}
```

### Pattern (Context Ledger)
```typescript
interface Pattern {
  id: string
  embedding: number[]  // pgvector
  description: string  // "Heavy sharp action on home underdog"
  conditions: {
    sport: string
    lineMovement: number
    timeToGame: number
    weather?: string
    injuries?: string[]
  }
  outcomes: {
    coverRate: number
    sampleSize: number
    avgROI: number
  }
}
```

---

## Reputation System

Nodes earn reputation by publishing accurate signals:

```
reputation = Σ(signal_accuracy × signal_importance)

signal_accuracy:
  - Arb confirmed live by others: +10
  - Steam move followed by cover: +5
  - Dead arb reported early: +3
  - False signal: -10

signal_importance:
  - First to report: 2x multiplier
  - Unique (no duplicates): 1.5x multiplier
```

High-reputation nodes:
- Receive signals faster
- Unlock premium agent features
- Contribute to "consensus" calculations

---

## Trojan Horse Adoption Funnel

### Phase 1: The Dashboard (Current)
```
Free, useful visualization tool
- Live odds comparison
- Arbitrage scanner
- Line movement tracker

Value: Solves immediate problem
Network: None yet
```

### Phase 2: The Network
```
"Join the Sharp Network" button
- Crowdsourced steam alerts
- Dead arb warnings
- Pattern matching

Value: 10x faster than solo
Network: Passive participation (consume only)
```

### Phase 3: The Agent
```
"Enable Auto-Sniper Mode"
- Install OpenConductor client
- Connect local LLM
- Enable browser automation

Value: Automated execution
Network: Active participation (publish + consume)
```

### Phase 4: The Ecosystem
```
"Your agent made $500 this month"
- Cross-sell other verticals
- Calendar, crypto, productivity
- Full OpenConductor adoption

Value: Universal AI assistant
Network: Full agentic mesh
```

---

## Technical Requirements

### 1. Signal Bus
- Redis Pub/Sub for real-time
- <10ms latency between nodes
- Deduplication (same signal from multiple nodes)

### 2. Context Ledger
- Postgres + pgvector extension
- Store line movement history
- Semantic search for pattern matching

### 3. Local Agent Runtime
- OpenConductor or Claude Desktop
- MCP servers for browser automation
- Local LLM for privacy-sensitive analysis

### 4. Browser Automation MCP
- Playwright/Puppeteer based
- Navigate to bet slips
- Populate stakes
- Await human confirmation (or auto-execute)

---

## Privacy & Trust Model

### What Stays Local
- Login credentials
- Bankroll information
- Execution decisions
- Personal betting history

### What's Shared (Anonymous)
- Line change observations
- Pattern detections
- Signal accuracy outcomes
- Aggregate statistics

### Node Identity
- Cryptographic ID (no PII)
- Reputation tied to ID
- Portable across devices

---

## Success Metrics

### Network Health
- Active nodes
- Signals per minute
- Signal accuracy rate
- Coverage (% of lines being watched)

### User Value
- Time to signal (how fast alerts arrive)
- Arb capture rate
- +EV opportunities identified
- Network advantage (vs solo user)

### Business
- Conversion: Dashboard → Network
- Conversion: Network → Agent
- Retention by tier
- Revenue per user (premium features)
