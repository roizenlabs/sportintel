# 🏈 SportIntel - Real-Time Sports Analytics Platform

A professional-grade sports betting analytics dashboard with live odds comparison, arbitrage detection, and steam move alerts.

![SportIntel Dashboard](https://img.shields.io/badge/Status-Live-green) ![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 📊 Live Odds Comparison
- Real-time odds from DraftKings, FanDuel, and Bovada
- Automatic best odds highlighting
- Spread tracking for each game
- Auto-refresh every 60 seconds

### 💰 Arbitrage Scanner
- Automatic detection of arbitrage opportunities
- Calculated stake distribution for guaranteed profit
- Configurable minimum profit threshold
- Push alerts via Telegram/Discord

### 📈 Line Movement Tracker
- Steam move detection (significant line changes)
- Historical line tracking in-memory
- Severity classification (Steam/High/Medium/Low)
- Customizable alert thresholds

### 🔔 Alert System
- Telegram bot integration
- Discord webhook support
- Configurable alert preferences
- Test connections from dashboard

## 🛠️ Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite 7 (build tool)
- Tailwind CSS 4 (styling)
- React Query (data fetching)
- Recharts (visualizations)
- Lucide Icons

**Backend:**
- Node.js + Express
- TypeScript + tsx
- The Odds API (data source)
- In-memory line history storage

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- The Odds API key ([get one free](https://the-odds-api.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/sportintel.git
cd sportintel

# Install API dependencies
cd api
npm install

# Install Dashboard dependencies
cd ../dashboard
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
# Required
ODDS_API_KEY=your_odds_api_key_here

# Optional - Alerts
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
DISCORD_WEBHOOK_URL=your_webhook_url

# Server
API_PORT=8080
```

### Running Locally

```bash
# Terminal 1: Start API server
cd api
npm run dev

# Terminal 2: Start Dashboard
cd dashboard
npm run dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:8080

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/odds/:sport` | GET | Live odds (nba, nfl, mlb, nhl) |
| `/api/arbitrage/:sport` | GET | Find arbitrage opportunities |
| `/api/steam-moves/:sport` | GET | Detect line movements |
| `/api/alerts/status` | GET | Alert configuration status |
| `/api/alerts/telegram` | POST | Configure Telegram |
| `/api/alerts/discord` | POST | Configure Discord |
| `/api/alerts/test` | POST | Test alert connections |
| `/api/health` | GET | Health check |


## 🚢 Deployment

### Dashboard → Vercel

```bash
cd dashboard
npm install -g vercel
vercel --prod
```

Update `vercel.json` with your API URL after deploying the API.

### API → Railway

```bash
cd api
npm install -g @railway/cli
railway login
railway up
```

Set environment variables in Railway dashboard:
- `ODDS_API_KEY`
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)
- `DISCORD_WEBHOOK_URL` (optional)

## 🔔 Setting Up Alerts

### Telegram

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token
4. Message [@userinfobot](https://t.me/userinfobot) to get your Chat ID
5. Add both to your `.env` or configure via dashboard

### Discord

1. Go to Server Settings → Integrations → Webhooks
2. Click "New Webhook"
3. Copy the webhook URL
4. Add to your `.env` or configure via dashboard

## 📊 Arbitrage Example

When the scanner finds an opportunity like:

```
Game: Dallas Mavericks @ Denver Nuggets
Profit: 5.4%

Bet 1: DraftKings - Denver Nuggets ML @ -160 (64.9% of stake)
Bet 2: FanDuel - Dallas Mavericks ML @ +200 (35.1% of stake)
```

With a $1,000 total stake:
- Bet $649 on Denver (DraftKings)
- Bet $351 on Dallas (FanDuel)
- **Guaranteed profit: ~$54 regardless of outcome**

## 🗺️ Roadmap

- [ ] Player props integration
- [ ] Historical odds database (TimescaleDB)
- [ ] User authentication
- [ ] Subscription tiers (Free/Pro/Whale)
- [ ] Mobile app (React Native)
- [ ] More sportsbooks (BetMGM, Caesars, PointsBet)

## 📄 License

MIT License - feel free to use for personal or commercial projects.

---

Built with ⚡ by [Sonnier Ventures](https://github.com/sonnierventures)
