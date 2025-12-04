import Redis from 'ioredis'

// Use any to handle ioredis ESM/CJS type quirks at build time
type RedisClient = any

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL

let redis: RedisClient | null = null
let subscriber: RedisClient | null = null

export function getRedis(): RedisClient {
  if (!redis) {
    if (!REDIS_URL) {
      console.warn('[REDIS] No REDIS_URL configured, using mock mode')
      return createMockRedis()
    }
    redis = new (Redis as any)(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    })
    redis.on('error', (err: Error) => console.error('[REDIS] Error:', err.message))
    redis.on('connect', () => console.log('[REDIS] Connected'))
  }
  return redis
}

export function getSubscriber(): RedisClient {
  if (!subscriber) {
    if (!REDIS_URL) {
      return createMockRedis()
    }
    subscriber = new (Redis as any)(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })
    subscriber.on('error', (err: Error) => console.error('[REDIS SUB] Error:', err.message))
  }
  return subscriber
}

// Shared mock store for pub/sub across redis and subscriber instances
const mockStore = new Map<string, string>()
const mockExpiry = new Map<string, number>()
const mockSubscriptions = new Map<string, Set<(channel: string, message: string) => void>>()

// Mock Redis for development without actual Redis
function createMockRedis(): RedisClient {
  const eventHandlers = new Map<string, Set<(...args: any[]) => void>>()

  const instance = {
    async get(key: string) {
      const exp = mockExpiry.get(key)
      if (exp && Date.now() > exp) {
        mockStore.delete(key)
        mockExpiry.delete(key)
        return null
      }
      return mockStore.get(key) || null
    },
    async set(key: string, value: string, ...args: any[]) {
      mockStore.set(key, value)
      if (args[0] === 'EX' && args[1]) {
        mockExpiry.set(key, Date.now() + args[1] * 1000)
      } else if (args[0] === 'PX' && args[1]) {
        mockExpiry.set(key, Date.now() + args[1])
      }
      return 'OK'
    },
    async setex(key: string, seconds: number, value: string) {
      mockStore.set(key, value)
      mockExpiry.set(key, Date.now() + seconds * 1000)
      return 'OK'
    },
    async del(...keys: string[]) {
      let count = 0
      for (const key of keys) {
        if (mockStore.delete(key)) count++
        mockExpiry.delete(key)
      }
      return count
    },
    async keys(pattern: string) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      const result: string[] = []
      mockStore.forEach((_, key) => {
        if (regex.test(key)) {
          result.push(key)
        }
      })
      return result
    },
    async publish(channel: string, message: string) {
      const handlers = mockSubscriptions.get(channel)
      if (handlers) {
        handlers.forEach(handler => {
          // Async dispatch to simulate real Redis
          setTimeout(() => handler(channel, message), 0)
        })
        return handlers.size
      }
      return 0
    },
    async subscribe(...channels: string[]) {
      const messageHandler = eventHandlers.get('message')?.values().next().value
      if (messageHandler) {
        for (const channel of channels) {
          if (!mockSubscriptions.has(channel)) {
            mockSubscriptions.set(channel, new Set())
          }
          mockSubscriptions.get(channel)!.add(messageHandler)
        }
      }
      return channels.length
    },
    on(event: string, callback: (...args: any[]) => void) {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
      }
      eventHandlers.get(event)!.add(callback)
      return instance
    },
    quit: async () => 'OK',
    disconnect: () => {}
  }

  return instance
}

// Cache helpers
export const cache = {
  async getOdds(sport: string): Promise<any | null> {
    const data = await getRedis().get(`odds:${sport}`)
    return data ? JSON.parse(data) : null
  },

  async setOdds(sport: string, data: any, ttlSeconds = 5): Promise<void> {
    await getRedis().setex(`odds:${sport}`, ttlSeconds, JSON.stringify(data))
  },

  async getArbitrages(): Promise<any[]> {
    const data = await getRedis().get('arbitrages:active')
    return data ? JSON.parse(data) : []
  },

  async setArbitrages(arbs: any[], ttlSeconds = 10): Promise<void> {
    await getRedis().setex('arbitrages:active', ttlSeconds, JSON.stringify(arbs))
  },

  async publishArbitrage(arb: any): Promise<void> {
    await getRedis().publish('arbitrage:new', JSON.stringify(arb))
  },

  async publishOddsUpdate(sport: string, data: any): Promise<void> {
    await getRedis().publish(`odds:${sport}`, JSON.stringify(data))
  }
}

export default { getRedis, getSubscriber, cache }
