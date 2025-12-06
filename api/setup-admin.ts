import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '../.env' })
dotenv.config()

const { Pool } = pg

const connectionString = process.env.DATABASE_URL || ''
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
const hasSSLDisabled = connectionString.includes('sslmode=disable')
const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]+/, '').replace(/\?$/, '')

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: (isLocalhost || hasSSLDisabled) ? false : { rejectUnauthorized: false }
})

async function setupAdmin() {
  console.log('[SETUP] Connecting to database...')

  try {
    // Add is_admin column if it doesn't exist
    console.log('[SETUP] Adding is_admin column...')
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
    `)
    console.log('[SETUP] Column added/verified')

    // Create index
    console.log('[SETUP] Creating index...')
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin) WHERE is_admin = true
    `)
    console.log('[SETUP] Index created/verified')

    // Make the specified user an admin
    const email = process.argv[2] || 'shawnsonnier04@gmail.com'
    console.log(`[SETUP] Making ${email} an admin...`)

    const result = await pool.query(
      'UPDATE users SET is_admin = true WHERE email = $1 RETURNING id, email',
      [email]
    )

    if (result.rows.length === 0) {
      console.log(`[SETUP] User ${email} not found. Make sure they have registered first.`)
    } else {
      console.log(`[SETUP] SUCCESS! ${email} is now an admin.`)
      console.log('[SETUP] User ID:', result.rows[0].id)
    }

    // Show admin users
    const admins = await pool.query('SELECT id, email FROM users WHERE is_admin = true')
    console.log('\n[SETUP] Current admins:')
    admins.rows.forEach(admin => {
      console.log(`  - ${admin.email} (${admin.id})`)
    })

  } catch (error: any) {
    console.error('[SETUP] Error:', error.message)
  } finally {
    await pool.end()
  }
}

setupAdmin()
