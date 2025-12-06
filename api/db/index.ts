import pg from 'pg'
import dotenv from 'dotenv'

// Load env here too in case this module is imported before server dotenv runs
dotenv.config({ path: '../.env' })
dotenv.config()

const { Pool } = pg

// Handle SSL - disable for local development
const connectionString = process.env.DATABASE_URL || ''
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
const hasSSLDisabled = connectionString.includes('sslmode=disable')

// Remove sslmode from connection string if present (we handle it via ssl option)
const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]+/, '').replace(/\?$/, '')

console.log('[DB] Connecting to:', cleanConnectionString.replace(/:[^:@]+@/, ':***@'))
console.log('[DB] SSL disabled:', isLocalhost || hasSSLDisabled)

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: (isLocalhost || hasSSLDisabled) ? false : { rejectUnauthorized: false }
})

// Export pool for direct access in admin routes
export { pool }

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),

  // User operations (uses UUID ids and existing schema)
  async createUser(email: string, passwordHash: string, name?: string) {
    // Generate username from email if not provided
    const username = email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, username, first_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, first_name as name, created_at`,
      [email, passwordHash, username, name]
    )
    return result.rows[0]
  },

  async getUserByEmail(email: string) {
    const result = await pool.query(
      'SELECT id, email, password_hash, username, first_name as name, created_at FROM users WHERE email = $1',
      [email]
    )
    return result.rows[0]
  },

  async getUserById(id: string) {
    const result = await pool.query(
      'SELECT id, email, username, first_name as name, created_at FROM users WHERE id = $1',
      [id]
    )
    return result.rows[0]
  },

  // User preferences
  async getPreferences(userId: string) {
    const result = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId])
    if (result.rows[0]) return result.rows[0]
    // Create default preferences if none exist
    await pool.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId])
    return this.getPreferences(userId)
  },

  async updatePreferences(userId: string, prefs: Record<string, any>) {
    const fields = Object.keys(prefs)
    const values = Object.values(prefs)
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')

    await pool.query(
      `UPDATE user_preferences SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [userId, ...values]
    )
    return this.getPreferences(userId)
  },

  // Watchlist operations
  async addToWatchlist(userId: string, data: {
    playerName: string
    sport: string
    propType: string
    targetLine?: number
    alertOnEdge?: number
    notes?: string
  }) {
    const result = await pool.query(
      `INSERT INTO prop_watchlist (user_id, player_name, sport, prop_type, target_line, alert_on_edge, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, data.playerName, data.sport, data.propType, data.targetLine, data.alertOnEdge || 5.0, data.notes]
    )
    return result.rows[0]
  },

  async getWatchlist(userId: string, sport?: string) {
    let query = 'SELECT * FROM prop_watchlist WHERE user_id = $1 AND active = true'
    const params: any[] = [userId]

    if (sport) {
      query += ' AND sport = $2'
      params.push(sport)
    }

    query += ' ORDER BY created_at DESC'
    const result = await pool.query(query, params)
    return result.rows
  },

  async removeFromWatchlist(userId: string, watchlistId: number) {
    await pool.query(
      'UPDATE prop_watchlist SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [watchlistId, userId]
    )
  },

  async updateWatchlistItem(userId: string, watchlistId: number, data: Record<string, any>) {
    const fields = Object.keys(data)
    const values = Object.values(data)
    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')

    const result = await pool.query(
      `UPDATE prop_watchlist SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [watchlistId, userId, ...values]
    )
    return result.rows[0]
  },

  // Prop snapshots
  async savePropSnapshot(watchlistId: number, data: {
    bookmaker: string
    line: number
    overOdds?: number
    underOdds?: number
  }) {
    await pool.query(
      `INSERT INTO prop_snapshots (watchlist_id, bookmaker, line, over_odds, under_odds)
       VALUES ($1, $2, $3, $4, $5)`,
      [watchlistId, data.bookmaker, data.line, data.overOdds, data.underOdds]
    )
  },

  async getPropHistory(watchlistId: number, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM prop_snapshots WHERE watchlist_id = $1 ORDER BY captured_at DESC LIMIT $2',
      [watchlistId, limit]
    )
    return result.rows
  },

  // Refresh tokens
  async saveRefreshToken(userId: string, token: string, expiresAt: Date) {
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    )
  },

  async getRefreshToken(token: string) {
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    )
    return result.rows[0]
  },

  async deleteRefreshToken(token: string) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token])
  },

  async deleteUserRefreshTokens(userId: string) {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId])
  }
}

export default db
