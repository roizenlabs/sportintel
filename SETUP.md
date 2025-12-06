# SportIntel Setup Guide

## Prerequisites
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/windows/)
- **Git** (optional, for version control)

## Step 1: Install PostgreSQL

1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. **Important**: Remember the password you set for the `postgres` user
4. Choose port `5432` (default)
5. Complete the installation

## Step 2: Create the Database

### Option A: Using pgAdmin (GUI)
1. Open **pgAdmin** (installed with PostgreSQL)
2. Login with the `postgres` user password
3. Right-click **Databases** → **Create** → **Database**
4. Name: `sportintel`
5. Click **Save**

### Option B: Using Command Line (Recommended)

Open PowerShell and run:
```powershell
# Connect to PostgreSQL as admin
psql -U postgres

# Then in the psql prompt, run:
CREATE DATABASE sportintel;
\q
```

## Step 3: Update `.env` File

Edit `.env` in the root directory and set the `DATABASE_URL`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel
```

Replace `YOUR_PASSWORD` with the password you set for the `postgres` user during PostgreSQL installation.

## Step 4: Run the Database Schema

Execute the schema file to create tables:

```powershell
# From the root directory
psql $env:DATABASE_URL < api/db/schema.sql
```

If the above command doesn't work, try:
```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/sportintel"
psql -d sportintel -U postgres -f api/db/schema.sql
```

## Step 5: Install Dependencies

```powershell
# Install root dependencies
npm install

# Install API dependencies
cd api
npm install

# Install Dashboard dependencies
cd ../dashboard
npm install

# Return to root
cd ..
```

## Step 6: Run the Application

### Terminal 1: Start the API Server
```powershell
cd api
npm run dev
```
The API will be available at `http://localhost:8080`

### Terminal 2: Start the Dashboard
```powershell
cd dashboard
npm run dev
```
The dashboard will be available at `http://localhost:5173` (or similar)

## Troubleshooting

### PostgreSQL Connection Issues
```powershell
# Test connection
psql -U postgres -d sportintel -c "SELECT version();"
```

### Port Already in Use
- API runs on port 8080 - check if another service is using it
- Dashboard runs on port 5173 (Vite default)

### Permission Denied
- Ensure PostgreSQL service is running: `services.msc` → PostgreSQL
- Check your firewall settings

### Database URL Format
Valid formats:
```
postgresql://username:password@localhost:5432/databasename
postgres://username:password@localhost:5432/databasename
postgresql://username:password@localhost/databasename (uses default port)
```

## Database Schema Overview

The schema creates these tables:
- **users** - User accounts and authentication
- **user_preferences** - Alert settings (Telegram, Discord, thresholds)
- **prop_watchlist** - Tracked player props
- **prop_snapshots** - Historical prop line data
- **refresh_tokens** - JWT refresh token storage

## Next Steps

1. ✅ PostgreSQL installed and running
2. ✅ Database created and schema loaded
3. ✅ `.env` configured with `DATABASE_URL`
4. ✅ Dependencies installed
5. ✅ API and Dashboard running

You're ready to start developing! 🚀
