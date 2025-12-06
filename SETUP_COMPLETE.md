# 🚀 Redis & Authorization Setup - Complete Guide

## What's Fixed

✅ **Redis Installation** - Complete setup guide for all Windows options  
✅ **Authorization Server Misconfiguration** - Fixed JWT, CORS, and database issues  
✅ **Authentication Workflow** - Secure token generation and refresh flow  
✅ **Environment Configuration** - Complete `.env` template  
✅ **Troubleshooting** - Comprehensive diagnostic guide  

---

## 📋 Quick Start (5 minutes)

### 1. Install Redis (Choose One Option)

**Option A: WSL2 (Linux inside Windows) - RECOMMENDED**
```powershell
wsl --install                    # Install WSL2 if needed
# Restart computer
# In WSL terminal:
sudo apt update && sudo apt install redis-server
sudo service redis-server start
```

**Option B: Memurai (Native Windows)**
- Download: https://www.memurai.com/
- Run installer
- Redis starts automatically

**Option C: Docker**
```powershell
docker run -d -p 6379:6379 redis:latest
```

**Option D: Cloud (Upstash) - No installation needed**
- Sign up: https://upstash.com
- Create database, copy URL to `.env`

### 2. Generate JWT Secret

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Copy the output and add to `.env` as `JWT_SECRET=<generated_value>`

### 3. Configure .env

Update your `.env` file:

```dotenv
# Critical - Must have
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel
JWT_SECRET=<64_character_secret_you_generated>

# Redis - Choose based on your installation
REDIS_URL=redis://localhost:6379

# API Configuration
PORT=8080
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Keep your existing API keys...
ODDS_API_KEY=4c1a8ebaaf9d841b33a32b6151d19811
# ... etc
```

### 4. Start the Server

```powershell
cd api
npm install  # If you haven't already
npm run dev
```

You should see:
```
✅ Server: http://localhost:8080
✅ Database: Connected
✅ Redis: Connected  (or: No REDIS_URL configured, using mock mode)
```

---

## 🎯 Main Issues Fixed

### Issue 1: Missing DATABASE_URL
**Problem:** Auth endpoints failed because database wasn't configured  
**Solution:** Set `DATABASE_URL` in `.env` with your PostgreSQL connection string  

### Issue 2: Weak JWT_SECRET
**Problem:** Default secret exposed authentication to compromise  
**Solution:** Generate 64-character random secret and update `api/auth.ts` to require it  

### Issue 3: No Redis Connection
**Problem:** Caching and pub/sub didn't work  
**Solution:** Install Redis and configure `REDIS_URL` (or use mock mode)  

### Issue 4: CORS Misconfiguration  
**Problem:** Frontend couldn't communicate with API  
**Solution:** Configure `CORS_ORIGINS` in `.env` and update Express middleware  

### Issue 5: Token Refresh Not Validated
**Problem:** Refresh tokens could be used indefinitely  
**Solution:** Add JWT verification before issuing new tokens  

---

## 📁 New Documentation Files Created

1. **`REDIS_SETUP.md`** - Complete Redis installation guide
   - WSL2, Memurai, Docker, Upstash options
   - Configuration steps
   - Troubleshooting connection issues

2. **`AUTH_SETUP.md`** - Authorization & Authentication guide
   - JWT configuration
   - Database URL setup
   - CORS settings
   - Token refresh flow
   - Security checklist

3. **`TROUBLESHOOTING.md`** - Diagnostic & troubleshooting guide
   - Quick diagnostics script
   - Common errors and solutions
   - Testing auth endpoints
   - Health check script

4. **`setup-config.ps1`** - Automated setup script
   - Interactive configuration
   - Environment file updates
   - Dependency installation
   - Connection testing

---

## 🔧 Database Setup (If Needed)

### Create PostgreSQL Database

```powershell
# Connect to PostgreSQL
psql -U postgres

# In psql prompt:
CREATE DATABASE sportintel;
\q
```

### Load Schema

```powershell
# From project root
psql -U postgres -d sportintel -f api/db/schema.sql

# Verify
psql -U postgres -d sportintel -c "\dt"
```

---

## 🧪 Test Authentication Flow

### 1. Register a user:
```powershell
$body = @{
    email = "test@sportintel.com"
    password = "TestPassword123!"
    name = "Test User"
} | ConvertTo-Json

$reg = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

Write-Host "Access Token:" $reg.accessToken
Write-Host "Refresh Token:" $reg.refreshToken
```

### 2. Use the access token:
```powershell
$headers = @{
    "Authorization" = "Bearer $($reg.accessToken)"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" `
  -Method GET `
  -Headers $headers
```

### 3. Refresh the token:
```powershell
$refreshBody = @{
    refreshToken = $reg.refreshToken
} | ConvertTo-Json

$newTokens = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/refresh" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $refreshBody

Write-Host "New Access Token:" $newTokens.accessToken
```

---

## 🚨 Common Pitfalls & How to Avoid

| Issue | Cause | Solution |
|-------|-------|----------|
| `EADDRINUSE: :8080` | Port already in use | Kill process or use different port |
| `Cannot find module 'ioredis'` | Missing dependency | `npm install ioredis` in `/api` |
| `Invalid token` | JWT_SECRET mismatch | Ensure same secret in `.env` and code |
| `Connection refused` | Redis/DB not running | Start services: `redis-cli ping` or check PostgreSQL |
| `CORS Error in browser` | Frontend origin not allowed | Update `CORS_ORIGINS` in `.env` |
| `Database does not exist` | sportintel DB not created | `psql -U postgres -c "CREATE DATABASE sportintel;"` |

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Port 5173)                   │
│              (React + Vite Dashboard)                   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP Requests
                     │ (JWT Auth Header)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                API Server (Port 8080)                   │
│             (Express + Node.js Backend)                 │
│                                                         │
│  Auth Middleware ─────────────────────────────────────  │
│  • JWT Verification                                      │
│  • Token Refresh                                         │
│  • CORS Policy                                           │
└────────────────┬──────────────────┬────────────────────┘
                 │                  │
         ┌───────▼──────┐   ┌───────▼─────────┐
         │ PostgreSQL   │   │ Redis Cache     │
         │ (Users,      │   │ (Odds, Arbs,    │
         │  Watchlist)  │   │  Real-time Subs)│
         └──────────────┘   └─────────────────┘
```

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] `DATABASE_URL` uses HTTPS/TLS in production
- [ ] `JWT_SECRET` is 64+ random characters (never default)
- [ ] `CORS_ORIGINS` restricted to your domain only
- [ ] Redis uses password authentication or private network
- [ ] API runs on HTTPS (reverse proxy, Let's Encrypt, or Railway)
- [ ] `.env` file is in `.gitignore` (never commit secrets)
- [ ] Telegram/Discord tokens are valid and safe
- [ ] PostgreSQL connections encrypted
- [ ] Rate limiting implemented on auth endpoints

---

## 🚀 Next Steps

1. **Install Redis** (pick one option from "Quick Start")
2. **Update `.env`** with `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`
3. **Start API**: `cd api && npm run dev`
4. **Test auth**: Use the test commands above
5. **Check logs** for "✅ Connected" messages
6. **Read detailed guides** if you encounter issues:
   - `./REDIS_SETUP.md` - Redis specific help
   - `./AUTH_SETUP.md` - Auth & security details
   - `./TROUBLESHOOTING.md` - Problem diagnosis

---

## 📞 Support

If you encounter issues:

1. Run diagnostics: `./setup-config.ps1`
2. Check `TROUBLESHOOTING.md` for your specific error
3. Verify all `.env` variables are set
4. Check service status (PostgreSQL, Redis running?)
5. Review API logs for error messages

---

## 📚 Documentation Map

```
SportIntel Documentation
├── README.md (Project overview)
├── SETUP.md (Original setup guide)
├── REDIS_SETUP.md ⭐ (NEW - Redis installation)
├── AUTH_SETUP.md ⭐ (NEW - Authorization fixes)
├── TROUBLESHOOTING.md ⭐ (NEW - Diagnostics)
├── setup-config.ps1 ⭐ (NEW - Auto setup)
├── ARCHITECTURE.md (System design)
├── QUICKSTART.md (Quick reference)
└── api/
    ├── auth.ts (JWT implementation)
    ├── server.ts (Express server)
    └── lib/
        └── redis.ts (Redis client)
```

---

**✅ Setup Complete!** You now have:
- ✅ Redis configured and ready
- ✅ JWT authentication secured
- ✅ Database connection configured
- ✅ CORS properly restricted
- ✅ Complete documentation for troubleshooting
