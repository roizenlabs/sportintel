# SportIntel Full Deployment Script
param(
    [switch]$DashboardOnly,
    [switch]$ApiOnly
)

Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║              🏈 SportIntel Deployment 🏀                      ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

if (-not $DashboardOnly) {
    Write-Host "`n📡 Deploying API to Railway..." -ForegroundColor Yellow
    & "$PSScriptRoot\deploy-api.ps1"
}

if (-not $ApiOnly) {
    Write-Host "`n🖥️ Deploying Dashboard to Vercel..." -ForegroundColor Yellow
    & "$PSScriptRoot\deploy-dashboard.ps1"
}

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                    ✅ Deployment Complete!                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Next Steps:                                                  ║
║  1. Copy Railway URL → dashboard/vercel.json                  ║
║  2. Set env vars in both platforms                            ║
║  3. Test: curl https://your-api.railway.app/api/health        ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
