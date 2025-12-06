# Authorization & Authentication Misconfiguration Fix

## Issue: Authorization Server Misconfiguration

Your SportIntel backend has JWT-based authentication configured, but there are several setup issues that need fixing:

---

## Problem 1: Missing Database URL (CRITICAL)

The `.env` file is missing `DATABASE_URL`, which prevents:
- User registration and login
- Token storage and refresh
- Watchlist persistence

### Fix:

Add to `.env`:

```dotenv
# ============================================
# Database (PostgreSQL)
# ============================================
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel
```

Replace `YOUR_PASSWORD` with your PostgreSQL password set during installation.

---

## Problem 2: JWT Secret in Production

Your code has a default JWT secret which is a security risk:

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'sportintel-secret-change-in-production'
```

### Fix:

1. Generate a strong secret:
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

2. Add to `.env`:
```dotenv
JWT_SECRET=<YOUR_GENERATED_SECRET>
```

3. Update `api/auth.ts` to REQUIRE environment variable:
```typescript
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set in environment')
```

---

## Problem 3: CORS Configuration Missing

Your API has CORS enabled but no specific origins defined. In production, this is insecure.

### Current Code (api/server.ts):
```typescript
app.use(cors())  // ⚠️ Allows ALL origins
```

### Fix:

Update `api/server.ts`:

```typescript
const allowedOrigins = [
  'http://localhost:5173',           // Local development
  'http://localhost:3000',            // Alternative port
  process.env.APP_DOMAIN,            // Production domain from .env
  `https://${process.env.APP_DOMAIN}` // Production HTTPS
].filter(Boolean)

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
```

Add to `.env`:
```dotenv
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## Problem 4: Missing Database URL Causes Auth Failure

The `db/index.ts` likely fails to initialize without `DATABASE_URL`.

### Check Your Connection String Format

Valid PostgreSQL URLs:
```
postgresql://username:password@host:port/database
postgresql://username:password@host/database          (uses default 5432)
postgres://username:password@host:port/database       (also valid)
```

**Troubleshoot connection:**
```powershell
# Test PostgreSQL connection
psql -U postgres -d sportintel -c "SELECT version();"

# If successful, your DATABASE_URL should be:
# postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel
```

---

## Problem 5: Token Refresh Flow Not Secured

Your refresh endpoint doesn't validate the refresh token properly before issuing a new token.

### Current Issue:
```typescript
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body
  // ⚠️ No verification that refreshToken is still valid before new token issued
}
```

### Recommended Fix (api/auth.ts):

Add token validation:
```typescript
async refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' })
    }

    // Verify the token is valid JWT format
    let decoded: any
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET)
    } catch (err) {
      return res.status(403).json({ error: 'Invalid refresh token' })
    }

    // Find valid refresh token in database
    const tokenRecord = await db.getRefreshToken(refreshToken)
    if (!tokenRecord || new Date() > new Date(tokenRecord.expires_at)) {
      await db.deleteRefreshToken(refreshToken)
      return res.status(403).json({ error: 'Refresh token expired' })
    }

    // Rest of the logic...
  } catch (error: any) {
    console.error('Refresh error:', error)
    res.status(500).json({ error: 'Token refresh failed' })
  }
}
```

---

## Complete .env Configuration

Update your `.env` file with all required values:

```dotenv
# ============================================
# Database (PostgreSQL) - REQUIRED
# ============================================
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel

# ============================================
# Redis Configuration
# ============================================
REDIS_URL=redis://localhost:6379
# OR for Upstash:
# UPSTASH_REDIS_URL=redis://<token>@<host>:<port>

# ============================================
# API Keys
# ============================================
ODDS_API_KEY=your_odds_api_key_here
APIFY_TOKEN=your_apify_token_here
HUGGINGFACE_API_KEY=your_huggingface_key_here
BALLDONTLIE_API_KEY=your_balldontlie_key_here

# ============================================
# Alert Configuration
# ============================================
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
DISCORD_WEBHOOK_URL=

# ============================================
# Authentication & Security
# ============================================
JWT_SECRET=<GENERATE_STRONG_SECRET_64_CHARS>
JWT_EXPIRES_IN=1h

# ============================================
# API Server
# ============================================
PORT=8080
API_PORT=8080

# ============================================
# CORS Configuration
# ============================================
APP_DOMAIN=localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# ============================================
# Data Sources
# ============================================
BALLDONTLIE_API_URL=https://api.balldontlie.io/v1
ODDS_API_URL=https://api.the-odds-api.com/v4

# ============================================
# Caching
# ============================================
ENABLE_CACHE=true
CACHE_TTL_SECONDS=300

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
ENABLE_DEBUG_MODE=false
```

---

## Step-by-Step Fix Implementation

### 1. Setup PostgreSQL (if not already done)
```powershell
psql -U postgres -c "CREATE DATABASE sportintel;"
psql -d sportintel -U postgres -f api/db/schema.sql
```

### 2. Update `.env` File
- Set `DATABASE_URL`
- Set strong `JWT_SECRET`
- Set `REDIS_URL` (see REDIS_SETUP.md)

### 3. Test Auth Endpoints

```powershell
# Register
$body = @{
    email = "test@sportintel.com"
    password = "SecurePass123!"
    name = "Test User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Login
$loginBody = @{
    email = "test@sportintel.com"
    password = "SecurePass123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $loginBody
```

### 4. Verify API Health
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/health"
```

Should show:
```json
{
  "status": "ok",
  "timestamp": "2025-12-03T...",
  "lineHistorySize": 0
}
```

---

## Security Checklist

- [ ] `DATABASE_URL` set in `.env`
- [ ] `JWT_SECRET` is strong (64+ random characters)
- [ ] `REDIS_URL` configured (see REDIS_SETUP.md)
- [ ] CORS restricted to specific origins
- [ ] API running on HTTPS in production (use Railway, Vercel, or reverse proxy)
- [ ] Never commit `.env` to Git (add to `.gitignore`)
- [ ] Telegram/Discord tokens are valid and protected
- [ ] PostgreSQL connections encrypted in production

---

## Troubleshooting Authentication Issues

### "Invalid or expired token" on Login
- Verify `DATABASE_URL` is correct
- Verify PostgreSQL is running and accessible
- Check database schema was created: `psql -d sportintel -c "\dt users;"`

### "Access token required" on Protected Routes
- Ensure `Authorization: Bearer <token>` header is sent
- Verify token is not expired (default 1h)
- Use refresh endpoint to get new token

### "Registration failed"
- Check PostgreSQL connection
- Verify `users` table exists
- Check bcrypt is installed: `cd api && npm install bcryptjs`

### CORS Errors in Browser
- Update `.env` `APP_DOMAIN` to match frontend domain
- Restart API server after .env changes
- Check browser console for full error message
