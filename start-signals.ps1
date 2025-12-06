# SportIntel Signal Network Activation Script
# This script sets up and starts the full signal network

param(
    [switch]$Gateway,      # Start only gateway
    [switch]$Publisher,    # Start only publisher
    [switch]$Subscriber,   # Start only subscriber
    [switch]$Install,      # Install dependencies
    [switch]$Test,         # Run test signal
    [switch]$Help          # Show help
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Header { param($msg) Write-Host "`n$msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "  [X] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "  $msg" -ForegroundColor White }

# Banner
Write-Host @"

===================================================================
     SportIntel Signal Network v2.6
===================================================================
     Real-time betting signals via Redis Pub/Sub
===================================================================

"@ -ForegroundColor Cyan

# Help
if ($Help) {
    Write-Host @"
Usage: .\start-signals.ps1 [options]

Options:
  -Install      Install all dependencies (npm install)
  -Gateway      Start only the Signal Gateway
  -Publisher    Start only the Signal Publisher
  -Subscriber   Start only the Signal Subscriber
  -Test         Send a test signal to verify connectivity
  -Help         Show this help message

Examples:
  .\start-signals.ps1                  # Start full network (gateway + publisher + subscriber)
  .\start-signals.ps1 -Install         # Install dependencies first
  .\start-signals.ps1 -Gateway         # Start only gateway
  .\start-signals.ps1 -Test            # Send test signal

Prerequisites:
  - Node.js 18+
  - Redis running on localhost:6379 (or set REDIS_URL)
  - ODDS_API_KEY in .env file

"@
    exit 0
}

# Check prerequisites
Write-Header "Checking Prerequisites..."

# Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js: $nodeVersion"
} catch {
    Write-Error "Node.js not found. Please install Node.js 18+"
    exit 1
}

# Redis check
Write-Info "Checking Redis connection..."
$redisUrl = $env:REDIS_URL
if (-not $redisUrl) { $redisUrl = "redis://localhost:6379" }

try {
    # Try to ping Redis using a simple TCP connection
    $uri = [System.Uri]$redisUrl.Replace("redis://", "http://")
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($uri.Host, $uri.Port)
    $tcp.Close()
    Write-Success "Redis: $redisUrl"
} catch {
    Write-Warning "Redis not reachable at $redisUrl"
    Write-Warning "Signals will queue until Redis is available"
}

# Install dependencies
if ($Install) {
    Write-Header "Installing Dependencies..."

    Write-Info "Installing root dependencies..."
    npm install

    Write-Info "Installing gateway dependencies..."
    Set-Location windows-gateway
    npm install
    Set-Location ..

    Write-Success "Dependencies installed"
}

# Test signal
if ($Test) {
    Write-Header "Sending Test Signal..."

    $gatewayUrl = $env:SIGNAL_GATEWAY_URL
    if (-not $gatewayUrl) { $gatewayUrl = "http://localhost:8081/signals" }

    $testSignal = @{
        id = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
        type = "steam"
        source = @{
            nodeId = "test-script"
            reputation = 100
            timestamp = [long](Get-Date -UFormat %s) * 1000
        }
        payload = @{
            gameId = "test-game"
            game = "Test Game"
            sport = "nba"
            description = "Test signal from PowerShell"
            confidence = 99
            ttl = 60
        }
        evidence = @{
            books = @("test")
            oldLine = -110
            newLine = -130
            delta = 20
            timestamp = [long](Get-Date -UFormat %s) * 1000
        }
        createdAt = [long](Get-Date -UFormat %s) * 1000
    }

    try {
        $body = $testSignal | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Uri $gatewayUrl -Method Post -Body $body -ContentType "application/json"
        Write-Success "Test signal sent successfully!"
        Write-Info "Response: $($response | ConvertTo-Json -Compress)"
    } catch {
        Write-Error "Failed to send test signal: $_"
        Write-Warning "Is the gateway running? Start with: .\start-signals.ps1 -Gateway"
    }
    exit 0
}

# Start components
Write-Header "Starting Signal Network..."

$processes = @()

# Gateway only
if ($Gateway) {
    Write-Info "Starting Signal Gateway..."
    $env:SIGNAL_GATEWAY_PORT = if ($env:SIGNAL_GATEWAY_PORT) { $env:SIGNAL_GATEWAY_PORT } else { "8081" }
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run gateway" -PassThru
    Write-Success "Gateway started on port $env:SIGNAL_GATEWAY_PORT"
    exit 0
}

# Publisher only
if ($Publisher) {
    Write-Info "Starting Signal Publisher..."
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run publisher" -PassThru
    Write-Success "Publisher started"
    exit 0
}

# Subscriber only
if ($Subscriber) {
    Write-Info "Starting Signal Subscriber..."
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run subscriber" -PassThru
    Write-Success "Subscriber started"
    exit 0
}

# Full network
Write-Info "Starting full signal network (Gateway + Publisher + Subscriber)..."
Write-Info ""
Write-Info "This will open 3 processes:"
Write-Info "  1. Signal Gateway (HTTP -> Redis bridge)"
Write-Info "  2. Signal Publisher (polls odds, detects signals)"
Write-Info "  3. Signal Subscriber (receives and logs signals)"
Write-Info ""

# Use concurrently to run all three
npm run signals:full

Write-Host @"

===================================================================
     Signal Network Started!
===================================================================

Gateway:    http://localhost:8081
Publisher:  Polling odds every 60s
Subscriber: Listening for signals

Endpoints:
  POST /signals       - Publish a signal
  GET  /health        - Health check
  GET  /stats         - Network statistics
  GET  /history/:type - Signal history

Press Ctrl+C to stop all services.
===================================================================

"@ -ForegroundColor Green
