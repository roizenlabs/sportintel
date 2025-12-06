/**
 * Database Migration Runner
 *
 * Runs SQL migration files in order
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
dotenv.config()

const { Pool, Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function ensureDatabaseExists() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL not configured')
  }

  // Parse database name from URL
  const match = dbUrl.match(/\/([^/?]+)(\?|$)/)
  if (!match) {
    throw new Error('Could not parse database name from DATABASE_URL')
  }
  const dbName = match[1]

  // Connect to postgres database to create the target database
  const postgresUrl = dbUrl.replace(`/${dbName}`, '/postgres')

  // Determine SSL settings
  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
  const hasSSLParam = dbUrl.includes('sslmode=') || dbUrl.includes('ssl=')
  
  let sslConfig: any = undefined
  if (process.env.NODE_ENV === 'production' && !isLocalhost) {
    sslConfig = { rejectUnauthorized: false }
  } else if (hasSSLParam && !isLocalhost) {
    sslConfig = { rejectUnauthorized: false }
  }

  const client = new Client({
    connectionString: postgresUrl,
    ssl: sslConfig
  })

  try {
    await client.connect()

    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    )

    if (result.rows.length === 0) {
      console.log(`📦 Creating database "${dbName}"...`)
      await client.query(`CREATE DATABASE "${dbName}"`)
      console.log(`✅ Database "${dbName}" created\n`)
    } else {
      console.log(`✅ Database "${dbName}" exists\n`)
    }
  } finally {
    await client.end()
  }
}

async function runMigrations() {
  // First ensure database exists
  try {
    await ensureDatabaseExists()
  } catch (err: any) {
    console.warn('⚠️  Could not verify database exists:', err.message)
    console.log('   Continuing with migration attempt...\n')
  }

  // Determine SSL settings based on connection string
  const dbUrl = process.env.DATABASE_URL || ''
  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
  const hasSSLParam = dbUrl.includes('sslmode=') || dbUrl.includes('ssl=')
  
  let sslConfig: any = undefined
  if (process.env.NODE_ENV === 'production' && !isLocalhost) {
    sslConfig = { rejectUnauthorized: false }
  } else if (hasSSLParam && !isLocalhost) {
    sslConfig = { rejectUnauthorized: false }
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
  })

  console.log('🗄️  Starting database migrations...\n')

  try {
    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    // Get already executed migrations
    const executed = await pool.query('SELECT name FROM _migrations')
    const executedNames = new Set(executed.rows.map(r => r.name))

    let migrationsRan = 0

    for (const file of files) {
      if (executedNames.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`)
        continue
      }

      console.log(`📝 Running ${file}...`)

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')

      try {
        await pool.query(sql)
        await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        console.log(`✅ ${file} completed`)
        migrationsRan++
      } catch (err: any) {
        // Check if error is just "already exists" type errors
        if (err.message.includes('already exists')) {
          console.log(`⚠️  ${file} - some objects already exist, marking as complete`)
          await pool.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file])
        } else {
          console.error(`❌ ${file} failed:`, err.message)
          throw err
        }
      }
    }

    if (migrationsRan === 0) {
      console.log('\n✨ All migrations already up to date!')
    } else {
      console.log(`\n✅ Ran ${migrationsRan} migration(s) successfully!`)
    }

  } catch (err) {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()
