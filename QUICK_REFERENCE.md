# 🎯 SportIntel Setup Reference Card

## Installation (Choose One)

| Method | Command | Best For |
|--------|---------|----------|
| **WSL2 (Recommended)** | `wsl --install` then `sudo apt install redis-server` | Windows developers |
| **Memurai** | Download from memurai.com | Native Windows |
| **Docker** | `docker run -d -p 6379:6379 redis:latest` | Containerized setup |
| **Upstash** | Sign up, create DB, copy URL | Production/Serverless |

## Environment Variables

### Required (Critical)
```dotenv
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/sportintel
JWT_SECRET=<64_char_random_secret>
```

### Optional (Recommended)
```dotenv
REDIS_URL=redis://localhost:6379
UPSTASH_REDIS_URL=redis://<token>@<host>:<port>
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### API Keys (from your .env)
```dotenv
ODDS_API_KEY=your_odds_api_key_here
APIFY_TOKEN=your_apify_token_here
HUGGINGFACE_API_KEY=your_huggingface_key_here
BALLDONTLIE_API_KEY=your_balldontlie_key_here
```

## Generate JWT Secret

### PowerShell
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Bash/Linux
```bash
openssl rand -base64 64 | tr -d '\n'
```

## Port Checks

```powershell
# Check if port 8080 is in use
netstat -ano | findstr :8080

# Kill process (if needed)
taskkill /PID <PID> /F

# Check Redis port 6379
netstat -ano | findstr :6379
```

## PostgreSQL Commands

```powershell
# Create database
psql -U postgres -c "CREATE DATABASE sportintel;"

# Load schema
psql -d sportintel -U postgres -f api/db/schema.sql

# Test connection
psql -U postgres -d sportintel -c "SELECT version();"

# Connect to database
psql -U postgres -d sportintel
```

## Redis Commands

```powershell
# Test connection
redis-cli ping

# Check Redis version
redis-cli INFO server

# List all keys
redis-cli KEYS *

# Clear all data
redis-cli FLUSHALL

# Monitor commands (debug)
redis-cli MONITOR
```

## API Testing

### Register User
```powershell
$body = @{
    email = "test@sportintel.com"
    password = "Password123"
    name = "Test User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

### Login
```powershell
$body = @{
    email = "test@sportintel.com"
    password = "Password123"
} | ConvertTo-Json

$token = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

Write-Host $token.accessToken
```

### Call Protected Route
```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN_HERE"
}

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" `
  -Method GET `
  -Headers $headers
```

### Check Health
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/health"
```

## Common Errors & Quick Fixes

| Error | Quick Fix |
|-------|-----------|
| `Cannot find module 'ioredis'` | `cd api && npm install ioredis` |
| `Port 8080 already in use` | `netstat -ano \| findstr :8080` then kill PID |
| `Invalid token` | Regenerate JWT_SECRET and restart |
| `Connection refused` | Start PostgreSQL/Redis services |
| `database "sportintel" does not exist` | `psql -U postgres -c "CREATE DATABASE sportintel;"` |
| `CORS error in browser` | Update CORS_ORIGINS in .env |

## Startup Checklist

- [ ] PostgreSQL running (`psql -U postgres -c "SELECT 1"`)
- [ ] Redis running (`redis-cli ping` = PONG)
- [ ] `.env` file has DATABASE_URL, JWT_SECRET, REDIS_URL
- [ ] Dependencies installed (`npm install` in api, dashboard)
- [ ] Port 8080 available (`netstat -ano \| findstr :8080`)
- [ ] API server starting (`cd api && npm run dev`)
- [ ] Dashboard server starting (`cd dashboard && npm run dev`)

## File Locations

```
api/
├── auth.ts          (JWT implementation)
├── server.ts        (Express server)
└── lib/
    └── redis.ts     (Redis client)

.env                 (Configuration - UPDATE THIS!)
REDIS_SETUP.md       (Detailed Redis guide)
AUTH_SETUP.md        (Detailed Auth guide)
TROUBLESHOOTING.md   (Error solutions)
setup-config.ps1     (Auto-setup script)
```

## Running Services

### Start Everything (Terminal 1)
```powershell
cd c:\Users\shawn\Documents\sportintel-mcp\api
npm run dev
```

### Start Dashboard (Terminal 2)
```powershell
cd c:\Users\shawn\Documents\sportintel-mcp\dashboard
npm run dev
```

### Access Points
- API: http://localhost:8080
- Dashboard: http://localhost:5173
- Health: http://localhost:8080/api/health
- Auth: http://localhost:8080/api/auth/me (requires token)

## Environment Examples

### Local Development
```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/sportintel
REDIS_URL=redis://localhost:6379
JWT_SECRET=abc123def456...
API_PORT=8080
CORS_ORIGINS=http://localhost:5173
```

### Production (Railway/Vercel)
```dotenv
DATABASE_URL=postgresql://user:pass@prod-server:5432/sportintel
UPSTASH_REDIS_URL=redis://token@host:port
JWT_SECRET=super_secret_production_key
APP_DOMAIN=sportintel.roizenlabs.com
CORS_ORIGINS=https://sportintel.roizenlabs.com
```

## Logs to Watch For

✅ **Good startup logs:**
```
[REDIS] Connected
[DATABASE] Connected
Server: http://localhost:8080
```

❌ **Bad startup logs:**
```
[REDIS] No REDIS_URL configured, using mock mode
Cannot find module
Error: Connection refused
Error: database does not exist
```

## Package Dependencies

### Required in `/api`
```json
"dependencies": {
  "express": "latest",
  "cors": "latest",
  "jsonwebtoken": "latest",
  "bcryptjs": "latest",
  "ioredis": "latest",
  "pg": "latest"
}
```

### Install missing:
```powershell
cd api
npm install express cors jsonwebtoken bcryptjs ioredis pg
```

## Next Steps

1. **Just installed?** → Run `./setup-config.ps1`
2. **Need Redis help?** → Read `REDIS_SETUP.md`
3. **Auth issues?** → Read `AUTH_SETUP.md`
4. **Debugging?** → Check `TROUBLESHOOTING.md`
5. **Got it working?** → Start servers and test!

---

**💡 Pro Tips:**
- Keep a terminal window open with `npm run dev` in `/api`
- Keep another terminal window open with `npm run dev` in `/dashboard`
- Use `redis-cli` for debugging cache issues
- Check `.env` first when things break
- Always restart API server after changing `.env`
