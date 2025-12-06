import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from './db/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'sportintel-secret-change-in-production'
const JWT_EXPIRES_IN = '1h'
const REFRESH_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

// Generate tokens
function generateAccessToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function generateRefreshToken(): string {
  return jwt.sign({ random: Math.random().toString() }, JWT_SECRET, { expiresIn: '7d' })
}

// Auth middleware
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = decoded as AuthUser
    next()
  })
}

// Optional auth - attaches user if token valid, continues if not
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = decoded as AuthUser
      }
      next()
    })
  } else {
    next()
  }
}

// Auth handlers
export const authHandlers = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' })
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' })
      }

      // Check if user exists
      const existing = await db.getUserByEmail(email)
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' })
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 10)
      const user = await db.createUser(email, passwordHash, name)

      // Generate tokens
      const accessToken = generateAccessToken(user)
      const refreshToken = generateRefreshToken()

      // Save refresh token
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN)
      await db.saveRefreshToken(user.id, refreshToken, expiresAt)

      res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken
      })
    } catch (error: any) {
      console.error('Register error:', error.message, error.stack)
      res.status(500).json({ error: 'Registration failed', details: error.message })
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body
      console.log('[AUTH] Login attempt for:', email)

      if (!email || !password) {
        console.log('[AUTH] Missing email or password')
        return res.status(400).json({ error: 'Email and password required' })
      }

      // Find user
      const user = await db.getUserByEmail(email)
      console.log('[AUTH] User found:', user ? 'yes' : 'no', user ? `(id: ${user.id})` : '')
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      // Verify password
      console.log('[AUTH] Comparing password, hash exists:', !!user.password_hash, 'hash length:', user.password_hash?.length)
      const valid = await bcrypt.compare(password, user.password_hash)
      console.log('[AUTH] Password valid:', valid)
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      // Generate tokens
      const accessToken = generateAccessToken(user)
      const refreshToken = generateRefreshToken()

      // Save refresh token
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN)
      await db.saveRefreshToken(user.id, refreshToken, expiresAt)

      res.json({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken
      })
    } catch (error: any) {
      console.error('Login error:', error)
      res.status(500).json({ error: 'Login failed' })
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' })
      }

      // Find valid refresh token
      const tokenRecord = await db.getRefreshToken(refreshToken)
      if (!tokenRecord) {
        return res.status(403).json({ error: 'Invalid or expired refresh token' })
      }

      // Get user
      const user = await db.getUserById(tokenRecord.user_id)
      if (!user) {
        return res.status(403).json({ error: 'User not found' })
      }

      // Delete old refresh token
      await db.deleteRefreshToken(refreshToken)

      // Generate new tokens
      const newAccessToken = generateAccessToken(user)
      const newRefreshToken = generateRefreshToken()

      // Save new refresh token
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN)
      await db.saveRefreshToken(user.id, newRefreshToken, expiresAt)

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      })
    } catch (error: any) {
      console.error('Refresh error:', error)
      res.status(500).json({ error: 'Token refresh failed' })
    }
  },

  async logout(req: AuthRequest, res: Response) {
    try {
      const { refreshToken } = req.body

      if (refreshToken) {
        await db.deleteRefreshToken(refreshToken)
      }

      // Optionally clear all user sessions
      if (req.body.allDevices && req.user) {
        await db.deleteUserRefreshTokens(req.user.id)
      }

      res.json({ success: true })
    } catch (error: any) {
      console.error('Logout error:', error)
      res.status(500).json({ error: 'Logout failed' })
    }
  },

  async me(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' })
      }

      const user = await db.getUserById(req.user.id)
      const preferences = await db.getPreferences(req.user.id)

      res.json({ user, preferences })
    } catch (error: any) {
      console.error('Me error:', error)
      res.status(500).json({ error: 'Failed to get user info' })
    }
  }
}
