# Test Signal Subscriber

A simple Node.js script that subscribes to Redis signals and displays them in real-time.

## Quick Start (Windows PowerShell)

```powershell
# From your sportintel-mcp directory
cd C:\Users\shawn\Documents\sportintel-mcp\windows-gateway

# Run the subscriber
node test-subscriber.js
```

## What You'll See

```
╔════════════════════════════════════════════════════════╗
║      SportIntel Test Signal Subscriber                 ║
╚════════════════════════════════════════════════════════╝

Redis: redis://localhost:6379

Subscribing to channels:
  • signals:steam     - Line movement alerts
  • signals:arb       - Arbitrage opportunities
  • signals:ev        - +EV opportunities
  • signals:news      - Breaking news/injuries
  • signals:sentiment - Sentiment shifts

Waiting for signals...

✅ Subscribed to 5 channels

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌊 STEAM SIGNAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Description: Steam move detected: -3.5 → -5.0
Confidence:  85%
TTL:         60s
Source:      sportintel-wsl-SonnierVenture (rep: 85)
Game:        nba-lakers-celtics-20241204
Sport:       basketball
Old Line:    -3.5
New Line:    -5.0
Delta:       -1.5
Books:       DraftKings
Timestamp:   12/4/2024, 3:45:23 AM

   → Would route to Steam Chaser Agent
```

## Testing the Full Pipeline

### 1. WSL → Windows → Redis → Subscriber

With the subscriber running, send a test signal from WSL:

```bash
# In WSL
curl -X POST http://172.28.64.1:8081/signals \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-'$(date +%s)'",
    "type": "arb",
    "source": {"nodeId": "test-node", "reputation": 90},
    "payload": {
      "gameId": "nba-test-game",
      "sport": "basketball",
      "description": "Test arbitrage: 2.5% guaranteed profit",
      "confidence": 95,
      "ttl": 30
    },
    "evidence": {
      "books": ["DraftKings", "FanDuel"],
      "timestamp": '$(date +%s000)'
    },
    "createdAt": '$(date +%s000)'
  }'
```

You should see the signal appear instantly in the subscriber!

### 2. Monitor All Signal Traffic

Leave the subscriber running and watch as the WSL Signal Publisher sends real signals:

- **Every 60s**: Betting line checks
- **Every 10min**: Sentiment analysis (if Apify token is set)
- **Every 3min**: Breaking news checks (if Apify token is set)

## Using in Your Agents

This is just a test subscriber. To integrate with your revenue agents:

```javascript
// In your Arbitrage Sniper agent
const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379');

redis.subscribe('signals:arb');

redis.on('message', async (channel, message) => {
  const signal = JSON.parse(message);

  if (signal.type === 'arb') {
    // Validate arbitrage is still live
    const isValid = await validateArbitrage(signal);

    if (isValid) {
      // Execute the trade
      await executeArbitrageTrade(signal);

      // Report success to network
      await publishOutcome(signal.id, 'success');
    } else {
      // Report dead arb to save others time
      await publishOutcome(signal.id, 'dead');
    }
  }
});
```

## Troubleshooting

### "Redis connection refused"

Make sure Redis is running:
```powershell
redis-cli ping
# Should return: PONG
```

If not running:
```powershell
# Start Redis Stack
redis-server

# Or Docker
docker start redis
```

### No signals appearing

1. **Check WSL Signal Publisher is running**:
   - In WSL: `ps aux | grep signal-publisher`
   - If not: `cd ~/projects/openconductor/packages/mcp-servers/sportintel && npm run start:publisher`

2. **Check Windows Gateway is running**:
   - Should see it in another PowerShell window
   - Check stats: `curl http://localhost:8081/stats`

3. **Send manual test signal**:
   ```bash
   # From WSL
   curl -X POST http://172.28.64.1:8081/signals \
     -H "Content-Type: application/json" \
     -d '{"id":"test","type":"steam","source":{"nodeId":"test","reputation":85},"payload":{"sport":"basketball","description":"Manual test","confidence":100,"ttl":60},"evidence":{"timestamp":1234567890},"createdAt":1234567890}'
   ```

## Next Steps

1. **Enable Premium Signals**: Add `APIFY_API_TOKEN` to WSL `.env` file
2. **Build Revenue Agents**: Create Arbitrage Sniper, Steam Chaser, EV+ Hunter
3. **Add Reputation Tracking**: Store signal outcomes in Postgres
4. **Scale the Network**: Add more WSL nodes watching different sports/books
