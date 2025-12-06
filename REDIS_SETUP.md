# Redis Setup Guide for SportIntel

## Installation on Windows

### Option 1: Using Windows Subsystem for Linux (WSL2) - **RECOMMENDED**

Redis has native support on Linux but doesn't have an official Windows build. WSL2 is the best option for Windows development.

#### Step 1: Install WSL2

1. Open PowerShell as Administrator
2. Run:
```powershell
wsl --install
```
3. Restart your computer
4. Choose a Linux distribution (Ubuntu 22.04 LTS recommended)

#### Step 2: Install Redis on WSL2

1. Open WSL2 terminal
2. Update package list:
```bash
sudo apt update
sudo apt upgrade -y
```
3. Install Redis:
```bash
sudo apt install redis-server -y
```
4. Start Redis:
```bash
sudo service redis-server start
```
5. Verify installation:
```bash
redis-cli ping
# Should return: PONG
```

#### Step 3: Auto-start Redis (Optional)

To automatically start Redis when WSL boots:
```bash
sudo nano /etc/wsl.conf
```
Add:
```ini
[boot]
command=/etc/init.d/redis-server start
```

---

### Option 2: Using Memurai (Windows-Native Alternative)

Memurai is a native Windows Redis build maintained by Microsoft and the Redis community.

1. Download from: https://www.memurai.com/
2. Run the installer (accept defaults)
3. Redis will start automatically as a Windows service
4. Test connection:
```powershell
redis-cli ping
# Should return: PONG
```

---

### Option 3: Using Docker

If you have Docker installed:

```powershell
# Pull Redis image
docker pull redis:latest

# Run Redis container
docker run -d -p 6379:6379 --name redis-sportintel redis:latest

# Test connection
redis-cli ping
```

---

## Configure SportIntel for Redis

### Step 1: Install Redis Client Library

Your `api/package.json` already has `ioredis` configured. Ensure it's installed:

```powershell
cd api
npm install ioredis
```

### Step 2: Update .env File

Add Redis configuration to your root `.env` file:

```dotenv
# Redis Configuration
# Local development (default Redis port)
REDIS_URL=redis://localhost:6379

# OR if using Memurai on Windows:
REDIS_URL=redis://127.0.0.1:6379

# OR if using WSL2:
REDIS_URL=redis://127.0.0.1:6379

# OR for Upstash Cloud Redis (production):
# UPSTASH_REDIS_URL=redis://<token>@<host>:<port>
```

### Step 3: Verify Redis Connection

Your `api/lib/redis.ts` already handles fallback to mock Redis if unavailable. To verify it's working:

1. Start your API server:
```powershell
cd api
npm run dev
```

2. Check the startup logs for:
```
[REDIS] Connected
```

If you see `[REDIS] No REDIS_URL configured, using mock mode`, the app will still work but use in-memory storage (not persistent).

---

## Usage in SportIntel

Your Redis setup is already integrated in the codebase:

```typescript
import { cache, getRedis, getSubscriber } from './lib/redis.ts'

// Cache odds data (5 second TTL)
await cache.setOdds('nfl', oddsData, 5)
const cached = await cache.getOdds('nfl')

// Pub/Sub for real-time updates
await cache.publishArbitrage(arbOpportunity)
await cache.publishOddsUpdate('nba', newOdds)

// Get subscriber for listening
const subscriber = getSubscriber()
await subscriber.subscribe('arbitrage:new')
```

---

## Troubleshooting

### Connection Refused
```powershell
# Check if Redis is running
redis-cli ping

# If it fails:
# 1. Verify installation (see above)
# 2. Check port 6379 is not blocked
# 3. Try connecting explicitly:
redis-cli -h 127.0.0.1 -p 6379
```

### Port Already in Use
```powershell
# Find process using port 6379
netstat -ano | findstr :6379

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or use different port in .env
REDIS_URL=redis://localhost:6380
```

### WSL2 Connection Issues
If you can't connect from Windows PowerShell to WSL2 Redis:

1. Find WSL2 IP address in WSL:
```bash
ip addr show eth0 | grep "inet "
```

2. Update .env with WSL IP:
```dotenv
REDIS_URL=redis://<WSL_IP>:6379
```

### Verify Mock vs Real Redis
Add this debug code to your server:
```typescript
import { getRedis, cache } from './lib/redis.ts'

const redis = getRedis()
const test = await cache.setOdds('test', { game: 'test' }, 60)
console.log('Redis set result:', test)
```

---

## Production Deployment

### Upstash (Recommended for Serverless)

1. Create account: https://upstash.com
2. Create a Redis database
3. Copy the Redis URL from the dashboard
4. Set environment variable:
```
UPSTASH_REDIS_URL=redis://...
```

Your code already checks `UPSTASH_REDIS_URL` as fallback.

---

## Next Steps

1. ✅ Install Redis (choose Option 1, 2, or 3 above)
2. ✅ Add `REDIS_URL` to `.env`
3. ✅ Start API server and verify connection
4. ✅ Test cache operations in your routes
5. ✅ For production, use Upstash or managed Redis service
