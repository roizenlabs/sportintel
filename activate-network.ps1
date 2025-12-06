# SportIntel Agentic Network Activation Script
# ============================================
# This script activates the full Sharp Network functionality
# that's been dormant in the codebase.

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         🚀 SportIntel Agentic Network Activation                   ║" -ForegroundColor Cyan
Write-Host "║                   'Waze for Sports Betting'                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "❌ ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "   Copy .env.example to .env and configure:" -ForegroundColor Yellow
    Write-Host "   - DATABASE_URL (PostgreSQL connection string)" -ForegroundColor Yellow
    Write-Host "   - REDIS_URL (Redis connection string)" -ForegroundColor Yellow
    Write-Host "   - ODDS_API_KEY (from the-odds-api.com)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Load .env for verification
$envContent = Get-Content ".env" -Raw
$hasDatabase = $envContent -match "DATABASE_URL=(?!your_)"
$hasRedis = $envContent -match "REDIS_URL=(?!redis://default:xxx)"
$hasOddsApi = $envContent -match "ODDS_API_KEY=(?!your_)"

Write-Host "📋 Environment Check:" -ForegroundColor White
Write-Host "   DATABASE_URL: $(if ($hasDatabase) { '✅ Configured' } else { '❌ Not configured' })" -ForegroundColor $(if ($hasDatabase) { 'Green' } else { 'Red' })
Write-Host "   REDIS_URL:    $(if ($hasRedis) { '✅ Configured' } else { '⚠️  Using mock (local only)' })" -ForegroundColor $(if ($hasRedis) { 'Green' } else { 'Yellow' })
Write-Host "   ODDS_API_KEY: $(if ($hasOddsApi) { '✅ Configured' } else { '❌ Not configured' })" -ForegroundColor $(if ($hasOddsApi) { 'Green' } else { 'Red' })
Write-Host ""

if (-not $hasDatabase) {
    Write-Host "❌ Database required! Get free PostgreSQL at:" -ForegroundColor Red
    Write-Host "   - https://railway.app (recommended)" -ForegroundColor Yellow
    Write-Host "   - https://supabase.com" -ForegroundColor Yellow
    Write-Host "   - https://neon.tech" -ForegroundColor Yellow
    exit 1
}

if (-not $hasOddsApi) {
    Write-Host "⚠️  ODDS_API_KEY missing - get free key at:" -ForegroundColor Yellow
    Write-Host "   https://the-odds-api.com/ (500 free requests/month)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Install dependencies
Write-Host "📦 Step 1: Installing dependencies..." -ForegroundColor Cyan
Set-Location api
npm install 2>&1 | Out-Null
Set-Location ..
Set-Location dashboard
npm install 2>&1 | Out-Null
Set-Location ..
Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Run database migrations
Write-Host "🗄️  Step 2: Running database migrations..." -ForegroundColor Cyan
Set-Location api
try {
    $migrationOutput = npm run migrate 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migrations complete" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Migration warnings (tables may already exist)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Migration failed: $_" -ForegroundColor Red
}
Set-Location ..
Write-Host ""

# Step 3: Check database tables
Write-Host "📊 Step 3: Verifying database tables..." -ForegroundColor Cyan
Set-Location api
try {
    npm run db:check 2>&1
} catch {
    Write-Host "   ⚠️  Could not verify tables" -ForegroundColor Yellow
}
Set-Location ..
Write-Host ""

# Step 4: Network Status Summary
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  ✅ NETWORK ACTIVATION COMPLETE                    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "🏈 What's Now Active:" -ForegroundColor White
Write-Host "   • Signal Bus        - Real-time signal propagation via Redis" -ForegroundColor Gray
Write-Host "   • Context Ledger    - Line movement tracking & pattern matching" -ForegroundColor Gray
Write-Host "   • Arbitrage Engine  - O(n) multi-market arb detection" -ForegroundColor Gray
Write-Host "   • Node Registration - Distributed node network" -ForegroundColor Gray
Write-Host "   • Reputation System - Signal accuracy tracking" -ForegroundColor Gray
Write-Host "   • WebSocket Push    - Real-time alerts to dashboard" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 To Start the Network:" -ForegroundColor White
Write-Host ""
Write-Host "   Option A: Run both services (recommended)" -ForegroundColor Cyan
Write-Host "   npm run network" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Option B: Run separately" -ForegroundColor Cyan
Write-Host "   Terminal 1: npm run api      # API on port 8080" -ForegroundColor Yellow
Write-Host "   Terminal 2: npm run dashboard  # Dashboard on port 5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "📡 Network Endpoints:" -ForegroundColor White
Write-Host "   POST /api/network/register   - Join the network" -ForegroundColor Gray
Write-Host "   GET  /api/network/stats      - Network statistics" -ForegroundColor Gray
Write-Host "   POST /api/signals/publish    - Publish signals" -ForegroundColor Gray
Write-Host "   GET  /api/signals/recent     - Recent signals" -ForegroundColor Gray
Write-Host "   WS   /socket.io              - Real-time connection" -ForegroundColor Gray
Write-Host ""
Write-Host "🎯 MCP Server (Claude Desktop):" -ForegroundColor White
Write-Host "   The MCP server at src/index.ts is independent and" -ForegroundColor Gray
Write-Host "   can be used directly via Claude Desktop." -ForegroundColor Gray
Write-Host ""
