# Troubleshooting Guide - Redis & Authorization Issues

## Quick Diagnostics

Run this in PowerShell from the project root:

```powershell
Write-Host "=== SportIntel Diagnostics ===" -ForegroundColor Cyan

# 1. Check .env file
Write-Host "`n1. .env Configuration:" -ForegroundColor Green
if (Test-Path .env) {
    $env:DATABASE_URL = (Select-String "DATABASE_URL=" .env | ForEach-Object {$_.Line.Split('=')[1]})
    $env:REDIS_URL = (Select-String "REDIS_URL=" .env | ForEach-Object {$_.Line.Split('=')[1]})
    $env:JWT_SECRET = (Select-String "JWT_SECRET=" .env | ForEach-Object {$_.Line.Split('=')[1]})
    
    Write-Host "   DATABASE_URL: $(if ($env:DATABASE_URL) { '✅ Set' } else { '❌ Missing' })"
    Write-Host "   REDIS_URL: $(if ($env:REDIS_URL) { '✅ Set' } else { '⚠️ Not configured (will use mock)' })"
    Write-Host "   JWT_SECRET: $(if ($env:JWT_SECRET) { '✅ Set' } else { '❌ Missing' })"
} else {
    Write-Host "   ❌ .env file not found!"
}

# 2. Check PostgreSQL
Write-Host "`n2. PostgreSQL Status:" -ForegroundColor Green
try {
    $pgVersion = psql --version 2>&1
    Write-Host "   ✅ Installed: $pgVersion"
    
    # Try to connect
    $pgTest = psql -d sportintel -c "SELECT 1;" 2>&1
    if ($pgTest -match "^(1)$|^(-?1)") {
        Write-Host "   ✅ Connected to sportintel database"
    } else {
        Write-Host "   ❌ Cannot connect to sportintel database"
        Write-Host "   Create it with: psql -U postgres -c 'CREATE DATABASE sportintel;'"
    }
} catch {
    Write-Host "   ❌ PostgreSQL not installed or not in PATH"
}

# 3. Check Redis
Write-Host "`n3. Redis Status:" -ForegroundColor Green
try {
    $redisTest = redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "   ✅ Redis is running"
        $redisInfo = redis-cli INFO server 2>&1
        if ($redisInfo -match "redis_version:(.+)") {
            Write-Host "   Version: $($matches[1])"
        }
    } else {
        Write-Host "   ❌ Redis not responding"
    }
} catch {
    Write-Host "   ⚠️  Redis CLI not found or Redis is not running"
}

# 4. Check API Port
Write-Host "`n4. Port Availability:" -ForegroundColor Green
$port8080 = netstat -ano 2>$null | Select-String ":8080" | Select-String "LISTENING"
if ($port8080) {
    Write-Host "   ⚠️  Port 8080 is in use"
} else {
    Write-Host "   ✅ Port 8080 is available"
}

Write-Host "`n" -ForegroundColor Cyan
```

---

## Redis Not Installing on Windows

### Error: "Redis is not available for Windows"

**Solution 1: Use WSL2 (Recommended)**
```powershell
wsl --install
# In WSL terminal:
sudo apt install redis-server
sudo service redis-server start
```

**Solution 2: Use Memurai (Windows Native)**
1. Download: https://www.memurai.com/
2. Run installer
3. Test: `redis-cli ping`

**Solution 3: Use Docker**
```powershell
docker pull redis:latest
docker run -d -p 6379:6379 redis:latest
```

**Solution 4: Use Upstash (Cloud - No Installation)**
1. Sign up: https://upstash.com
2. Create Redis database
3. Copy connection string to `.env` as `UPSTASH_REDIS_URL=redis://...`

---

## PostgreSQL Connection Issues

### Error: "could not connect to server"

**Check if PostgreSQL is running:**
```powershell
# Windows Services
Get-Service | Select-String postgresql

# Start if not running
Start-Service PostgreSQL-x64-15  # Replace version number
```

**Test connection:**
```powershell
# Try connecting as postgres user
psql -U postgres

# If that works, create database:
CREATE DATABASE sportintel;
\q
```

**Update DATABASE_URL in .env:**
```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

### Error: "database sportintel does not exist"

```powershell
# Create it
psql -U postgres -c "CREATE DATABASE sportintel;"

# Verify
psql -U postgres -l | Select-String sportintel
```

### Error: "password authentication failed"

The password in `DATABASE_URL` is incorrect. To reset PostgreSQL password:

```powershell
# As administrator
# Windows only - use pgAdmin GUI or:
psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'newpassword';"
```

---

## JWT Authentication Errors

### Error: "Invalid or expired token"

**Causes:**
1. Token expired (default 1 hour)
2. `JWT_SECRET` in `.env` doesn't match the one used to generate token
3. Token was tampered with

**Fix:**
```powershell
# Check JWT_SECRET is set
Select-String "JWT_SECRET=" .env

# If missing, generate new:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Error: "Access token required"

**Solution:** Include Authorization header in API requests:
```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_ACCESS_TOKEN"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" `
  -Headers $headers
```

### Error: "Refresh token expired"

**Solution:** Refresh tokens expire after 7 days. Login again:
```powershell
$loginBody = @{
    email = "user@example.com"
    password = "password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $loginBody
```

---

## API Server Not Starting

### Error: "EADDRINUSE: address already in use :::8080"

**Solution:**
```powershell
# Find process using port 8080
$proc = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($proc) {
    Stop-Process -Id $proc.OwningProcess -Force
    Write-Host "Killed process using port 8080"
}

# Or use different port
$env:API_PORT=8081
npm run dev
```

### Error: "Cannot find module 'ioredis'"

```powershell
cd api
npm install ioredis
cd ..
npm run dev
```

### Error: "Cannot find module 'bcryptjs'"

```powershell
cd api
npm install bcryptjs jsonwebtoken pg
cd ..
npm run dev
```

### Error: "ENOENT: no such file or directory"

```powershell
# Make sure you're in the right directory
cd c:\Users\shawn\Documents\sportintel-mcp
cd api
npm run dev
```

---

## CORS Errors in Browser

### Error: "Access to XMLHttpRequest blocked by CORS policy"

**Cause:** Frontend and API on different origins

**Solution:**

1. Update `.env`:
```dotenv
APP_DOMAIN=localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

2. Restart API server
3. Clear browser cache (Ctrl+Shift+Delete)

**For Production:**
```dotenv
APP_DOMAIN=sportintel.roizenlabs.com
CORS_ORIGINS=https://sportintel.roizenlabs.com
```

---

## Testing Auth Endpoints

### Register a new user:
```powershell
$body = @{
    email = "test@sportintel.com"
    password = "SecurePassword123"
    name = "Test User"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

Write-Host $response | ConvertTo-Json
```

### Login:
```powershell
$loginBody = @{
    email = "test@sportintel.com"
    password = "SecurePassword123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $loginBody

Write-Host "Access Token:" $response.accessToken
Write-Host "Refresh Token:" $response.refreshToken
```

### Test protected route:
```powershell
$headers = @{
    "Authorization" = "Bearer $($response.accessToken)"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" `
  -Method GET `
  -Headers $headers
```

---

## Checking Logs

### API Server Logs

Look for these patterns in terminal output:

```
✅ Good signs:
[REDIS] Connected                    # Redis working
[DATABASE] Connected                 # Database working
Server: http://localhost:8080        # Server started

❌ Problems:
[REDIS] No REDIS_URL configured      # Will use mock Redis
Cannot find module 'x'               # Missing dependency
Error: Connection refused            # Database/Redis not running
```

### Database Logs

```powershell
# Check PostgreSQL service status
Get-Service PostgreSQL*

# View recent errors
Get-EventLog -LogName Application -Source PostgreSQL -Newest 10
```

### Enable Debug Mode

Add to `.env`:
```dotenv
ENABLE_DEBUG_MODE=true
LOG_LEVEL=debug
```

Then restart: `npm run dev`

---

## Complete System Check Script

Save as `health-check.ps1`:

```powershell
function Test-SportintelHealth {
    $checks = @(
        @{ name = "Node.js"; cmd = { node --version } },
        @{ name = "npm"; cmd = { npm --version } },
        @{ name = "PostgreSQL"; cmd = { psql --version } },
        @{ name = "Redis"; cmd = { redis-cli ping } },
        @{ name = "Port 8080"; cmd = { 
            if (netstat -ano 2>$null | Select-String ":8080") { "In use" } else { "Available" }
        } },
        @{ name = ".env exists"; cmd = { if (Test-Path .env) { "Yes" } else { "No" } } },
        @{ name = "DATABASE_URL"; cmd = { 
            if (Select-String "DATABASE_URL=" .env) { "Configured" } else { "Missing" }
        } }
    )
    
    $checks | ForEach-Object {
        try {
            $result = & $_.cmd
            Write-Host "$($_.name): ✅ $result" -ForegroundColor Green
        } catch {
            Write-Host "$($_.name): ❌ Error" -ForegroundColor Red
        }
    }
}

Test-SportintelHealth
```

Run with: `./health-check.ps1`

---

## Still Having Issues?

1. **Check the main README**: `./README.md`
2. **Redis Setup Guide**: `./REDIS_SETUP.md`
3. **Auth Configuration**: `./AUTH_SETUP.md`
4. **General Setup**: `./SETUP.md`
5. **Run diagnostics**: `./setup-config.ps1`
