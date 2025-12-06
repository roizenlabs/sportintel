import pg from 'pg'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
dotenv.config()

const { Pool } = pg

const connectionString = process.env.DATABASE_URL || ''
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
const hasSSLDisabled = connectionString.includes('sslmode=disable')
const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]+/, '').replace(/\?$/, '')

console.log('[MIGRATE] Connecting to:', cleanConnectionString.replace(/:[^:@]+@/, ':***@'))

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: (isLocalhost || hasSSLDisabled) ? false : { rejectUnauthorized: false }
})

async function runMigrations() {
  const migrationsDir = path.join(import.meta.dirname, 'db/migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  console.log('[MIGRATE] Found migrations:', files)

  for (const file of files) {
    console.log(`[MIGRATE] Running ${file}...`)
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')

    try {
      await pool.query(sql)
      console.log(`[MIGRATE] ✅ ${file} completed`)
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log(`[MIGRATE] ⏭️ ${file} - already applied`)
      } else {
        console.error(`[MIGRATE] ❌ ${file} failed:`, err.message)
      }
    }
  }

  // Create admin user
  console.log('[MIGRATE] Setting up admin...')
  const bcrypt = await import('bcryptjs')
  const tempPassword = 'SportIntel2024!'
  const hash = await bcrypt.default.hash(tempPassword, 10)

  // Check if user exists
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', ['shawnsonnier04@gmail.com'])

  if (existing.rows.length === 0) {
    // Create user
    await pool.query(
      `INSERT INTO users (email, password_hash, username, first_name, is_admin, subscription_tier)
       VALUES ($1, $2, $3, $4, true, 'enterprise')`,
      ['shawnsonnier04@gmail.com', hash, 'shawn_admin', 'Shawn']
    )
    console.log('[MIGRATE] ✅ Created admin user')
  } else {
    // Update existing user
    await pool.query(
      'UPDATE users SET password_hash = $1, is_admin = true, subscription_tier = $2 WHERE email = $3',
      [hash, 'enterprise', 'shawnsonnier04@gmail.com']
    )
    console.log('[MIGRATE] ✅ Updated admin user')
  }

  console.log('\n[MIGRATE] ✅ ALL MIGRATIONS COMPLETE')
  console.log('[MIGRATE] Admin login: shawnsonnier04@gmail.com / SportIntel2024!')

  await pool.end()
}

runMigrations().catch(err => {
  console.error('[MIGRATE] Fatal error:', err)
  process.exit(1)
})
