# SportIntel Dashboard Deployment Script (Vercel)
Write-Host "🚀 Deploying SportIntel Dashboard to Vercel..." -ForegroundColor Cyan

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

# Navigate to dashboard
Push-Location "$PSScriptRoot\..\dashboard"

# Build
Write-Host "📦 Building dashboard..." -ForegroundColor Yellow
npm run build

# Deploy
Write-Host "🌐 Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod

Pop-Location

Write-Host "`n✅ Dashboard deployed!" -ForegroundColor Green
Write-Host "`n📝 Post-deployment:"
Write-Host "1. Update vercel.json with your Railway API URL"
Write-Host "2. Set VITE_API_URL in Vercel Environment Variables"
