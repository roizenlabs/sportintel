# SportIntel Database & Application Setup Script
# Run this script to set up PostgreSQL database and install dependencies

param(
    [string]$DbUser = "postgres",
    [string]$DbPassword = "",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "sportintel"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "SportIntel Setup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "❌ PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    Write-Host "Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ PostgreSQL found at: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Prompt for database password if not provided
if (-not $DbPassword) {
    Write-Host "Enter the PostgreSQL 'postgres' user password: " -ForegroundColor Yellow
    $DbPassword = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
}

# Test PostgreSQL connection
Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
$env:PGPASSWORD = $DbPassword
try {
    $testResult = psql -U $DbUser -h $DbHost -p $DbPort -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL connection successful" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL connection failed. Check your credentials." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error connecting to PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Create database
Write-Host ""
Write-Host "Creating database '$DbName'..." -ForegroundColor Yellow
try {
    psql -U $DbUser -h $DbHost -p $DbPort -c "CREATE DATABASE $DbName;" 2>&1 | ForEach-Object {
        if ($_ -like "*already exists*") {
            Write-Host "✓ Database '$DbName' already exists" -ForegroundColor Green
        } elseif ($_ -like "*CREATE DATABASE*") {
            Write-Host "✓ Database '$DbName' created successfully" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Warning: $_" -ForegroundColor Yellow
}

# Run schema
Write-Host ""
Write-Host "Running database schema..." -ForegroundColor Yellow
try {
    $schemaPath = Join-Path $PSScriptRoot "api/db/schema.sql"
    psql -U $DbUser -h $DbHost -p $DbPort -d $DbName -f $schemaPath 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database schema applied successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Error applying schema" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

# Update .env file
Write-Host ""
Write-Host "Updating .env file..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot ".env"
$databaseUrl = "postgresql://$($DbUser):$($DbPassword)@$($DbHost):$($DbPort)/$($DbName)"

try {
    $envContent = Get-Content $envPath -Raw
    $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$databaseUrl"
    Set-Content -Path $envPath -Value $envContent
    Write-Host "✓ .env file updated with DATABASE_URL" -ForegroundColor Green
} catch {
    Write-Host "⚠ Warning: Could not update .env file. Update manually:" -ForegroundColor Yellow
    Write-Host "DATABASE_URL=$databaseUrl" -ForegroundColor Cyan
}

# Install npm dependencies
Write-Host ""
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow

Write-Host "Installing root dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Warning: npm install failed at root" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installing API dependencies..." -ForegroundColor Cyan
Push-Location api
npm install
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Warning: npm install failed in api" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installing Dashboard dependencies..." -ForegroundColor Cyan
Push-Location dashboard
npm install
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Warning: npm install failed in dashboard" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Terminal 1 and run: cd api && npm run dev" -ForegroundColor White
Write-Host "2. Open Terminal 2 and run: cd dashboard && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "API will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Dashboard will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
