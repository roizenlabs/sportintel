# SportIntel API Deployment Script (Railway)
Write-Host "🚀 Deploying SportIntel API to Railway..." -ForegroundColor Cyan

# Check if Railway CLI is installed
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayInstalled) {
    Write-Host "Installing Railway CLI..." -ForegroundColor Yellow
    npm install -g @railway/cli
}

# Navigate to API
Push-Location "$PSScriptRoot\..\api"

# Login to Railway (if needed)
Write-Host "🔐 Checking Railway login..." -ForegroundColor Yellow
railway whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login to Railway:" -ForegroundColor Yellow
    railway login
}

# Deploy
Write-Host "🚂 Deploying to Railway..." -ForegroundColor Yellow
railway up

Pop-Location

Write-Host "`n✅ API deployed!" -ForegroundColor Green
Write-Host "`n📝 Post-deployment:"
Write-Host "1. Set environment variables in Railway dashboard:"
Write-Host "   - ODDS_API_KEY"
Write-Host "   - TELEGRAM_BOT_TOKEN (optional)"
Write-Host "   - TELEGRAM_CHAT_ID (optional)"
Write-Host "   - DISCORD_WEBHOOK_URL (optional)"
Write-Host "2. Note your Railway URL for the dashboard config"
