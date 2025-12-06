import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function check() {
  // List tables
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `)
  console.log('Tables created:')
  tables.rows.forEach(r => console.log('  -', r.table_name))

  // Check patterns seeded
  const patterns = await pool.query('SELECT name FROM betting_patterns')
  console.log('\nBetting patterns seeded:', patterns.rows.length)
  patterns.rows.forEach(r => console.log('  -', r.name))

  // Check for vector extension
  const ext = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
  console.log('\npgvector extension:', ext.rows.length > 0 ? 'enabled' : 'not available')

  await pool.end()
}

check()
