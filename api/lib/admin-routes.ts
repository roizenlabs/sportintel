import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { AuthRequest } from '../auth.js'

const router = Router()
let db: Pool

export function setDatabase(pool: Pool) {
  db = pool
}

// Admin middleware - checks if user is admin
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const result = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    )

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    next()
  } catch (error: any) {
    console.error('[ADMIN] Auth check error:', error.message)
    res.status(500).json({ error: 'Authorization check failed' })
  }
}

// GET /api/admin/stats - System overview
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Get user stats
    const userStats = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week
      FROM users
    `)

    // Get subscription stats - handle if table doesn't exist
    let subStats = { rows: [] as any[] }
    try {
      subStats = await db.query(`
        SELECT tier, COUNT(*) as count
        FROM user_subscriptions
        WHERE subscription_status IN ('active', 'trialing')
        GROUP BY tier
      `)
    } catch (e) {
      console.log('[ADMIN] user_subscriptions table not found, using defaults')
    }

    // Get API usage stats - handle if table doesn't exist
    let usageStats = { rows: [{ total_calls: '0', active_users: '0' }] }
    try {
      usageStats = await db.query(`
        SELECT COUNT(*) as total_calls, COUNT(DISTINCT user_id) as active_users
        FROM api_usage WHERE date = CURRENT_DATE
      `)
    } catch (e) {
      console.log('[ADMIN] api_usage table not found, using defaults')
    }

    // Get recent signups
    const recentUsers = await db.query(`
      SELECT id, email, first_name as name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `)

    res.json({
      users: {
        total: parseInt(userStats.rows[0].total_users),
        newToday: parseInt(userStats.rows[0].new_today),
        newThisWeek: parseInt(userStats.rows[0].new_this_week)
      },
      subscriptions: subStats.rows.reduce((acc, row) => {
        acc[row.tier] = parseInt(row.count)
        return acc
      }, { free: 0, pro: 0, enterprise: 0 } as Record<string, number>),
      apiUsage: {
        todayCalls: parseInt(usageStats.rows[0]?.total_calls || '0'),
        activeUsers: parseInt(usageStats.rows[0]?.active_users || '0')
      },
      recentSignups: recentUsers.rows
    })
  } catch (error: any) {
    console.error('[ADMIN] Stats error:', error.message)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// GET /api/admin/users - List all users with pagination
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = (page - 1) * limit
    const search = req.query.search as string

    let whereClause = ''
    const params: any[] = []

    if (search) {
      whereClause = 'WHERE email ILIKE $1 OR first_name ILIKE $1'
      params.push(`%${search}%`)
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    // Get users with subscription info (handle missing tables gracefully)
    let users
    try {
      users = await db.query(`
        SELECT
          u.id, u.email, u.first_name as name, u.is_admin, u.created_at,
          COALESCE(s.tier, 'free') as tier,
          s.subscription_status,
          s.current_period_end,
          COALESCE(a.call_count, 0) as api_calls_today
        FROM users u
        LEFT JOIN user_subscriptions s ON u.id = s.user_id
        LEFT JOIN api_usage a ON u.id = a.user_id AND a.date = CURRENT_DATE
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset])
    } catch (e) {
      // Fallback if subscription/usage tables don't exist
      users = await db.query(`
        SELECT id, email, first_name as name, is_admin, created_at,
               'free' as tier, NULL as subscription_status, NULL as current_period_end, 0 as api_calls_today
        FROM users ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset])
    }

    res.json({
      users: users.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('[ADMIN] List users error:', error.message)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Get user
    const userResult = await db.query(`
      SELECT
        u.id, u.email, u.first_name as name, u.is_admin, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = $1
    `, [id])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get subscription
    const subResult = await db.query(`
      SELECT tier, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end
      FROM user_subscriptions
      WHERE user_id = $1
    `, [id])

    // Get API usage history (last 30 days)
    const usageResult = await db.query(`
      SELECT date, call_count
      FROM api_usage
      WHERE user_id = $1 AND date > NOW() - INTERVAL '30 days'
      ORDER BY date DESC
    `, [id])

    res.json({
      user: userResult.rows[0],
      subscription: subResult.rows[0] || { tier: 'free', subscription_status: null },
      apiUsage: usageResult.rows
    })
  } catch (error: any) {
    console.error('[ADMIN] Get user error:', error.message)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// PATCH /api/admin/users/:id - Update user
router.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { is_admin, tier } = req.body

    // Update admin status
    if (typeof is_admin === 'boolean') {
      await db.query(
        'UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2',
        [is_admin, id]
      )
    }

    // Update subscription tier manually
    if (tier && ['free', 'pro', 'enterprise'].includes(tier)) {
      await db.query(`
        INSERT INTO user_subscriptions (user_id, tier, subscription_status)
        VALUES ($1, $2, 'active')
        ON CONFLICT (user_id)
        DO UPDATE SET tier = $2, subscription_status = 'active', updated_at = NOW()
      `, [id, tier])
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('[ADMIN] Update user error:', error.message)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Delete user (cascades to related tables)
    await db.query('DELETE FROM users WHERE id = $1', [id])

    res.json({ success: true })
  } catch (error: any) {
    console.error('[ADMIN] Delete user error:', error.message)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// GET /api/admin/subscriptions - List all subscriptions
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT
        s.id, s.user_id, s.tier, s.stripe_customer_id, s.stripe_subscription_id,
        s.subscription_status, s.current_period_end, s.created_at,
        u.email, u.name
      FROM user_subscriptions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `)

    res.json({ subscriptions: result.rows })
  } catch (error: any) {
    console.error('[ADMIN] List subscriptions error:', error.message)
    res.status(500).json({ error: 'Failed to fetch subscriptions' })
  }
})

// GET /api/admin/api-usage - API usage overview
router.get('/api-usage', async (req: Request, res: Response) => {
  try {
    // Daily usage for last 30 days
    const dailyUsage = await db.query(`
      SELECT
        date,
        SUM(call_count) as total_calls,
        COUNT(DISTINCT user_id) as unique_users
      FROM api_usage
      WHERE date > NOW() - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date DESC
    `)

    // Top users by usage
    const topUsers = await db.query(`
      SELECT
        u.id, u.email, u.name,
        COALESCE(s.tier, 'free') as tier,
        SUM(a.call_count) as total_calls
      FROM api_usage a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN user_subscriptions s ON u.id = s.user_id
      WHERE a.date > NOW() - INTERVAL '7 days'
      GROUP BY u.id, u.email, u.name, s.tier
      ORDER BY total_calls DESC
      LIMIT 20
    `)

    res.json({
      dailyUsage: dailyUsage.rows,
      topUsers: topUsers.rows
    })
  } catch (error: any) {
    console.error('[ADMIN] API usage error:', error.message)
    res.status(500).json({ error: 'Failed to fetch API usage' })
  }
})

// POST /api/admin/make-admin - Make a user admin by email
router.post('/make-admin', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email required' })
    }

    const result = await db.query(
      'UPDATE users SET is_admin = true, updated_at = NOW() WHERE email = $1 RETURNING id, email',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ success: true, user: result.rows[0] })
  } catch (error: any) {
    console.error('[ADMIN] Make admin error:', error.message)
    res.status(500).json({ error: 'Failed to make user admin' })
  }
})

export default router
