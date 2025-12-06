#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Quick setup script for SportIntel - Configures Redis and fixes auth misconfiguration
.DESCRIPTION
    This script helps you:
    1. Generate a strong JWT_SECRET
    2. Configure Redis connection
    3. Test database connectivity
    4. Validate all required environment variables
#>

Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       SportIntel Quick Setup & Configuration      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check if .env exists
$envPath = ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "⚠️  .env file not found. Creating one..." -ForegroundColor Yellow
    Copy-Item "$(Get-Location)\.env.example" -Destination ".env" -ErrorAction SilentlyContinue
}

# 1. Generate JWT_SECRET
Write-Host "1️⃣  Generating Strong JWT_SECRET..." -ForegroundColor Green
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "   ✅ Generated: $($jwtSecret.Substring(0, 20))..." -ForegroundColor Green

# 2. Configure Redis
Write-Host "`n2️⃣  Redis Configuration..." -ForegroundColor Green

$redisOptions = @(
    "1 - Local Redis (localhost:6379)",
    "2 - WSL2 Redis (Windows → Linux)",
    "3 - Memurai/Windows (localhost:6379)",
    "4 - Docker Redis (localhost:6379)",
    "5 - Upstash Cloud (production)",
    "6 - Skip (use mock Redis)"
)

$redisOptions | ForEach-Object { Write-Host "   $_" -ForegroundColor Cyan }
$redisChoice = Read-Host "`n   Select Redis setup (1-6)"

$redisUrl = switch ($redisChoice) {
    "1" { "redis://localhost:6379" }
    "2" { "redis://127.0.0.1:6379" }
    "3" { "redis://127.0.0.1:6379" }
    "4" { "redis://127.0.0.1:6379" }
    "5" { 
        $upstashUrl = Read-Host "   Enter your UPSTASH_REDIS_URL"
        $upstashUrl 
    }
    default { $null }
}

if ($redisUrl) {
    Write-Host "   ✅ Redis configured: $redisUrl" -ForegroundColor Green
} else {
    Write-Host "   ⚙️  Skipping Redis - will use mock mode" -ForegroundColor Yellow
}

# 3. Database Configuration
Write-Host "`n3️⃣  PostgreSQL Database Configuration..." -ForegroundColor Green

$dbUser = Read-Host "   PostgreSQL username (default: postgres)"
$dbUser = if ($dbUser) { $dbUser } else { "postgres" }

$dbPassword = Read-Host "   PostgreSQL password" -AsSecureString
$dbPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($dbPassword))

$dbHost = Read-Host "   PostgreSQL host (default: localhost)"
$dbHost = if ($dbHost) { $dbHost } else { "localhost" }

$dbPort = Read-Host "   PostgreSQL port (default: 5432)"
$dbPort = if ($dbPort) { $dbPort } else { "5432" }

$dbName = Read-Host "   Database name (default: sportintel)"
$dbName = if ($dbName) { $dbName } else { "sportintel" }

$databaseUrl = "postgresql://$($dbUser):$($dbPasswordPlain)@$($dbHost):$($dbPort)/$($dbName)"

# Test database connection
Write-Host "   Testing database connection..." -ForegroundColor Gray
try {
    $result = psql -U $dbUser -h $dbHost -p $dbPort -d $dbName -c "SELECT version();" 2>&1
    if ($result) {
        Write-Host "   ✅ Database connection successful!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Could not test connection. Please verify credentials manually." -ForegroundColor Yellow
}

# 4. Update .env file
Write-Host "`n4️⃣  Updating .env file..." -ForegroundColor Green

$envContent = Get-Content $envPath -Raw

# Update DATABASE_URL
if ($envContent -match 'DATABASE_URL=') {
    $envContent = $envContent -replace 'DATABASE_URL=.*$', "DATABASE_URL=$databaseUrl"
} else {
    $envContent += "`nDATABASE_URL=$databaseUrl"
}

# Update JWT_SECRET
if ($envContent -match 'JWT_SECRET=') {
    $envContent = $envContent -replace 'JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret"
} else {
    $envContent += "`nJWT_SECRET=$jwtSecret"
}

# Update REDIS_URL
if ($redisUrl) {
    if ($envContent -match 'REDIS_URL=') {
        $envContent = $envContent -replace 'REDIS_URL=.*$', "REDIS_URL=$redisUrl"
    } else {
        $envContent += "`nREDIS_URL=$redisUrl"
    }
}

# Add CORS settings
if ($envContent -notmatch 'CORS_ORIGINS=') {
    $envContent += "`nCORS_ORIGINS=http://localhost:5173,http://localhost:3000"
}

$envContent | Set-Content $envPath
Write-Host "   ✅ .env file updated" -ForegroundColor Green

# 5. Verify Installation
Write-Host "`n5️⃣  Verification..." -ForegroundColor Green

# Check Node.js
Write-Host "   Checking Node.js..." -ForegroundColor Gray
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "   ✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
}

# Check PostgreSQL
Write-Host "   Checking PostgreSQL..." -ForegroundColor Gray
$pgVersion = psql --version 2>$null
if ($pgVersion) {
    Write-Host "   ✅ PostgreSQL installed: $pgVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ PostgreSQL not found. Please install from https://postgresql.org/" -ForegroundColor Red
}

# Check Redis (if configured)
if ($redisUrl) {
    Write-Host "   Checking Redis..." -ForegroundColor Gray
    $redisCheck = redis-cli ping 2>$null
    if ($redisCheck -eq "PONG") {
        Write-Host "   ✅ Redis is running" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Redis not responding. Make sure it's running." -ForegroundColor Yellow
    }
}

# 6. Install Dependencies
Write-Host "`n6️⃣  Dependencies..." -ForegroundColor Green

$installDeps = Read-Host "   Install npm dependencies? (y/n)"
if ($installDeps -eq 'y') {
    Write-Host "   Installing root dependencies..." -ForegroundColor Gray
    npm install
    
    Write-Host "   Installing API dependencies..." -ForegroundColor Gray
    cd api
    npm install
    cd ..
    
    Write-Host "   Installing Dashboard dependencies..." -ForegroundColor Gray
    cd dashboard
    npm install
    cd ..
    
    Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              ✅ Setup Complete!                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "📋 Configuration Summary:" -ForegroundColor Yellow
Write-Host "   Database: $databaseUrl" -ForegroundColor Gray
Write-Host "   Redis: $(if ($redisUrl) { $redisUrl } else { 'Mock (In-Memory)' })" -ForegroundColor Gray
Write-Host "   JWT Secret: $($jwtSecret.Substring(0, 20))..." -ForegroundColor Gray

Write-Host "`n🚀 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Start the API server:"
Write-Host "      cd api && npm run dev" -ForegroundColor Cyan
Write-Host "   2. Start the Dashboard (in new terminal):"
Write-Host "      cd dashboard && npm run dev" -ForegroundColor Cyan
Write-Host "   3. Open http://localhost:5173 in your browser" -ForegroundColor Cyan

Write-Host "`n📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - Redis Setup: ./REDIS_SETUP.md" -ForegroundColor Cyan
Write-Host "   - Auth Configuration: ./AUTH_SETUP.md" -ForegroundColor Cyan
Write-Host "   - General Setup: ./SETUP.md" -ForegroundColor Cyan
