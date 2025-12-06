# Quick Start Guide

## For First-Time Setup

Run the automated setup script:

```powershell
.\setup.ps1
```

This will:
- ✓ Create PostgreSQL database
- ✓ Load the schema
- ✓ Update `.env` with `DATABASE_URL`
- ✓ Install all dependencies

## Running the Application

After setup is complete, use two terminals:

### Terminal 1: API Server

```powershell
cd api
npm run dev
```

**Expected output:**
```
Server listening on port 8080
```

API endpoints available at `http://localhost:8080`

### Terminal 2: Dashboard

```powershell
cd dashboard
npm run dev
```

**Expected output:**
```
VITE v7.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

Dashboard available at `http://localhost:5173`

## Manual Setup (if automation fails)

### 1. Create Database

```powershell
$env:PGPASSWORD = "your_postgres_password"
psql -U postgres -c "CREATE DATABASE sportintel;"
```

### 2. Run Schema

```powershell
$env:DATABASE_URL = "postgresql://postgres:your_password@localhost:5432/sportintel"
psql $env:DATABASE_URL < api/db/schema.sql
```

### 3. Update `.env`

Edit `.env` in the root directory:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel
API_PORT=8080
JWT_SECRET=sportintel-jwt-secret-change-in-production
```

### 4. Install Dependencies

```powershell
npm install
cd api && npm install
cd ../dashboard && npm install
cd ..
```

## Environment Variables

Key variables in `.env`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | (empty) |
| `API_PORT` | API server port | 8080 |
| `JWT_SECRET` | JWT signing key | sportintel-jwt-secret-... |
| `ODDS_API_KEY` | The Odds API | (set) |
| `TELEGRAM_BOT_TOKEN` | Telegram alerts | (empty) |
| `DISCORD_WEBHOOK_URL` | Discord alerts | (empty) |

## Troubleshooting

**Port already in use:**
```powershell
# Find process using port 8080
Get-NetTCPConnection -LocalPort 8080 | Select-Object OwningProcess
# Kill process (replace PID)
Stop-Process -Id PID -Force
```

**Database connection error:**
```powershell
# Test connection
psql -U postgres -d sportintel -c "SELECT 1;"
```

**Module not found errors:**
```powershell
# Clear and reinstall
Remove-Item -Recurse -Force node_modules package-lock.json
npm install
```

## Project Structure

```
sportintel-mcp/
├── api/                 # Express backend server
│   ├── server.ts       # Main API server
│   ├── auth.ts         # Authentication logic
│   ├── alerts.ts       # Alert handlers
│   └── db/
│       └── schema.sql  # Database schema
├── dashboard/          # React + Vite frontend
│   ├── src/
│   └── package.json
└── src/               # Shared utilities
```

## API Endpoints

- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `GET /api/odds` - Get live odds
- `POST /alerts/subscribe` - Set alert preferences
- etc.

See `api/server.ts` for full API documentation.
