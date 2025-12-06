import { Router, Request, Response } from 'express'
import { Pool } from 'pg'
import crypto from 'crypto'
import { AuthRequest } from '../auth.js'

const router = Router()
let db: Pool

export function setDatabase(pool: Pool) {
  db = pool
}

// Initialize referral tables
export async function initReferralTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(20) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        reward_granted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        converted_at TIMESTAMP
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reward_type VARCHAR(50) NOT NULL,
        reward_value TEXT NOT NULL,
        reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('[REFERRAL] Tables initialized')
  } catch (error: any) {
    console.error('[REFERRAL] Table init error:', error.message)
  }
}

// Generate unique referral code
function generateCode(userId: string): string {
  const hash = crypto.createHash('sha256').update(userId + Date.now()).digest('hex')
  return hash.substring(0, 8).toUpperCase()
}

// GET /api/referral/code - Get or create user's referral code
router.get('/code', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    // Check for existing code
    let result = await db.query(
      'SELECT code FROM referral_codes WHERE user_id = $1',
      [req.user.id]
    )

    if (result.rows.length === 0) {
      // Generate new code
      const code = generateCode(req.user.id)
      result = await db.query(
        'INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) RETURNING code',
        [req.user.id, code]
      )
    }

    const referralCode = result.rows[0].code
    const referralLink = `https://roizenlabs.com/?ref=${referralCode}`

    res.json({
      code: referralCode,
      link: referralLink
    })
  } catch (error: any) {
    console.error('[REFERRAL] Get code error:', error.message)
    res.status(500).json({ error: 'Failed to get referral code' })
  }
})

// GET /api/referral/stats - Get referral statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    // Get total referrals
    const totalResult = await db.query(
      'SELECT COUNT(*) as total FROM referrals WHERE referrer_id = $1',
      [req.user.id]
    )

    // Get converted referrals (those who subscribed)
    const convertedResult = await db.query(
      `SELECT COUNT(*) as converted FROM referrals
       WHERE referrer_id = $1 AND status = 'converted'`,
      [req.user.id]
    )

    // Get pending referrals
    const pendingResult = await db.query(
      `SELECT COUNT(*) as pending FROM referrals
       WHERE referrer_id = $1 AND status = 'pending'`,
      [req.user.id]
    )

    // Get rewards earned
    const rewardsResult = await db.query(
      'SELECT * FROM referral_rewards WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    )

    // Get referral tier
    const totalReferrals = parseInt(totalResult.rows[0].total)
    let tier = 'bronze'
    if (totalReferrals >= 50) tier = 'platinum'
    else if (totalReferrals >= 16) tier = 'gold'
    else if (totalReferrals >= 6) tier = 'silver'

    res.json({
      total: totalReferrals,
      converted: parseInt(convertedResult.rows[0].converted),
      pending: parseInt(pendingResult.rows[0].pending),
      tier,
      rewards: rewardsResult.rows,
      nextTier: tier === 'bronze' ? { name: 'silver', needed: 6 - totalReferrals } :
                tier === 'silver' ? { name: 'gold', needed: 16 - totalReferrals } :
                tier === 'gold' ? { name: 'platinum', needed: 50 - totalReferrals } :
                null
    })
  } catch (error: any) {
    console.error('[REFERRAL] Stats error:', error.message)
    res.status(500).json({ error: 'Failed to get referral stats' })
  }
})

// POST /api/referral/track - Track a referral signup
router.post('/track', async (req: Request, res: Response) => {
  const { code, referredUserId } = req.body

  if (!code || !referredUserId) {
    return res.status(400).json({ error: 'Code and referredUserId required' })
  }

  try {
    // Find the referrer by code
    const referrerResult = await db.query(
      'SELECT user_id FROM referral_codes WHERE code = $1',
      [code.toUpperCase()]
    )

    if (referrerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' })
    }

    const referrerId = referrerResult.rows[0].user_id

    // Don't allow self-referral
    if (referrerId === referredUserId) {
      return res.status(400).json({ error: 'Cannot refer yourself' })
    }

    // Check if already referred
    const existingResult = await db.query(
      'SELECT id FROM referrals WHERE referred_id = $1',
      [referredUserId]
    )

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'User already referred' })
    }

    // Create referral record
    await db.query(
      `INSERT INTO referrals (referrer_id, referred_id, referral_code, status)
       VALUES ($1, $2, $3, 'pending')`,
      [referrerId, referredUserId, code.toUpperCase()]
    )

    res.json({ success: true, message: 'Referral tracked' })
  } catch (error: any) {
    console.error('[REFERRAL] Track error:', error.message)
    res.status(500).json({ error: 'Failed to track referral' })
  }
})

// POST /api/referral/convert - Mark referral as converted (called when user subscribes)
router.post('/convert', async (req: AuthRequest, res: Response) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId required' })
  }

  try {
    // Find the referral
    const referralResult = await db.query(
      `SELECT r.*, rc.user_id as referrer_id
       FROM referrals r
       JOIN referral_codes rc ON r.referral_code = rc.code
       WHERE r.referred_id = $1 AND r.status = 'pending'`,
      [userId]
    )

    if (referralResult.rows.length === 0) {
      return res.json({ success: true, message: 'No pending referral found' })
    }

    const referral = referralResult.rows[0]

    // Update referral status
    await db.query(
      `UPDATE referrals
       SET status = 'converted', converted_at = NOW()
       WHERE id = $1`,
      [referral.id]
    )

    // Count total conversions for this referrer
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM referrals
       WHERE referrer_id = $1 AND status = 'converted'`,
      [referral.referrer_id]
    )
    const totalConversions = parseInt(countResult.rows[0].count)

    // Grant reward based on tier
    let rewardType = 'free_month'
    let rewardValue = '1'
    let reason = 'Referral conversion'

    if (totalConversions >= 50) {
      rewardType = 'lifetime_pro'
      rewardValue = 'true'
      reason = 'Platinum tier - Lifetime Pro'
    } else if (totalConversions >= 16) {
      rewardType = 'free_months'
      rewardValue = '6'
      reason = 'Gold tier - 6 months free'
    } else if (totalConversions >= 6) {
      rewardType = 'free_months'
      rewardValue = '3'
      reason = 'Silver tier - 3 months free'
    }

    // Record reward
    await db.query(
      `INSERT INTO referral_rewards (user_id, reward_type, reward_value, reason)
       VALUES ($1, $2, $3, $4)`,
      [referral.referrer_id, rewardType, rewardValue, reason]
    )

    // Update referral as reward granted
    await db.query(
      'UPDATE referrals SET reward_granted = true WHERE id = $1',
      [referral.id]
    )

    res.json({
      success: true,
      reward: { type: rewardType, value: rewardValue, reason }
    })
  } catch (error: any) {
    console.error('[REFERRAL] Convert error:', error.message)
    res.status(500).json({ error: 'Failed to convert referral' })
  }
})

// GET /api/referral/leaderboard - Top referrers
router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.first_name as name,
        COUNT(r.id) as total_referrals,
        COUNT(r.id) FILTER (WHERE r.status = 'converted') as conversions
      FROM users u
      JOIN referral_codes rc ON u.id = rc.user_id
      LEFT JOIN referrals r ON rc.code = r.referral_code
      GROUP BY u.id, u.first_name
      HAVING COUNT(r.id) > 0
      ORDER BY conversions DESC, total_referrals DESC
      LIMIT 10
    `)

    res.json({
      leaderboard: result.rows.map((row, index) => ({
        rank: index + 1,
        name: row.name || 'Anonymous',
        referrals: parseInt(row.total_referrals),
        conversions: parseInt(row.conversions)
      }))
    })
  } catch (error: any) {
    console.error('[REFERRAL] Leaderboard error:', error.message)
    res.status(500).json({ error: 'Failed to get leaderboard' })
  }
})

export default router
