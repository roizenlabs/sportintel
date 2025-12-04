/**
 * Network Connection Test
 * 
 * Tests all components of the Sharp Network:
 * - Database connection
 * - Redis connection  
 * - Signal bus
 * - WebSocket
 */

import pg from 'pg'
import Redis from 'ioredis'
import type { Redis as RedisType } from 'ioredis'
import { io } from 'socket.io-client'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
dotenv.config()

const API_URL = process.env.API_URL || 'http://localhost:8080'
const results: { test: string; status: 'pass' | 'fail' | 'skip'; message: string }[] = []

function log(test: string, status: 'pass' | 'fail' | 'skip', message: string) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️'
  console.log(`${icon} ${test}: ${message}`)
  results.push({ test, status, message })
}

async function testDatabase() {
  if (!process.env.DATABASE_URL) {
    log('Database', 'skip', 'DATABASE_URL not configured')
    return
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  
  try {
    // Test connection
    await pool.query('SELECT 1')
    
    // Check for network tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('network_nodes', 'signal_outcomes', 'line_movements', 'betting_patterns', 'game_context')
    `)
    
    const networkTables = tables.rows.map(r => r.table_name)
    
    if (networkTables.length >= 5) {
      log('Database', 'pass', `Connected. Network tables: ${networkTables.join(', ')}`)
    } else {
      log('Database', 'fail', `Missing tables. Found: ${networkTables.join(', ')}. Run: npm run api:migrate`)
    }
    
    // Check pgvector
    const ext = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
    if (ext.rows.length > 0) {
      console.log('   📊 pgvector: enabled (semantic search available)')
    } else {
      console.log('   📊 pgvector: not installed (semantic search disabled)')
    }
    
  } catch (err: any) {
    log('Database', 'fail', err.message)
  } finally {
    await pool.end()
  }
}

async function testRedis() {
  if (!process.env.REDIS_URL) {
    log('Redis', 'skip', 'REDIS_URL not configured (using mock mode)')
    return
  }

  const redis = new (Redis as any)(process.env.REDIS_URL)
  
  try {
    await redis.ping()
    
    // Test pub/sub
    const testChannel = 'test:network'
    const testMessage = JSON.stringify({ test: true, time: Date.now() })
    
    const subscriber = new (Redis as any)(process.env.REDIS_URL)
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscriber.disconnect()
        reject(new Error('Pub/sub timeout'))
      }, 5000)
      
      subscriber.subscribe(testChannel, (err) => {
        if (err) reject(err)
        redis.publish(testChannel, testMessage)
      })
      
      subscriber.on('message', (channel, message) => {
        if (channel === testChannel && message === testMessage) {
          clearTimeout(timeout)
          subscriber.disconnect()
          resolve()
        }
      })
    })
    
    log('Redis', 'pass', 'Connected. Pub/sub working.')
    
  } catch (err: any) {
    log('Redis', 'fail', err.message)
  } finally {
    redis.disconnect()
  }
}

async function testSignalBus() {
  // Import signal bus
  try {
    const { initSignalBus, publishSignal, getRecentSignals } = await import('./lib/signal-bus.js')
    
    await initSignalBus()
    
    // Publish a test signal
    const signal = await publishSignal(
      'ev',
      'test-node-' + Date.now(),
      {
        gameId: 'test-game',
        sport: 'nba',
        description: 'Network test signal',
        confidence: 100,
        ttl: 60
      },
      { books: ['test'], timestamp: Date.now() }
    )
    
    // Retrieve it
    const recent = await getRecentSignals('ev', 5)
    const found = recent.some(s => s.id === signal.id)
    
    if (found) {
      log('Signal Bus', 'pass', `Published and retrieved test signal: ${signal.id.slice(0, 8)}`)
    } else {
      log('Signal Bus', 'fail', 'Signal published but not retrievable')
    }
    
  } catch (err: any) {
    log('Signal Bus', 'fail', err.message)
  }
}

async function testAPI() {
  try {
    const response = await fetch(`${API_URL}/api/health`)
    const data = await response.json()
    
    if (data.status === 'ok') {
      log('API Server', 'pass', `Running. WebSocket clients: ${data.websocket?.clients || 0}`)
      
      // Show network stats if available
      if (data.network) {
        console.log(`   📡 Network: ${data.network.activeNodes || 0} active nodes, ${data.network.signalsToday || 0} signals today`)
      }
    } else {
      log('API Server', 'fail', 'Unexpected response')
    }
  } catch (err: any) {
    log('API Server', 'fail', `Not running at ${API_URL}. Start with: npm run api`)
  }
}

async function testWebSocket() {
  return new Promise<void>((resolve) => {
    const socket = io(API_URL, {
      transports: ['websocket'],
      timeout: 5000
    })
    
    const timeout = setTimeout(() => {
      socket.disconnect()
      log('WebSocket', 'fail', 'Connection timeout')
      resolve()
    }, 5000)
    
    socket.on('connect', () => {
      clearTimeout(timeout)
      
      // Test subscribing to signals
      socket.emit('signals:subscribe')
      
      setTimeout(() => {
        log('WebSocket', 'pass', `Connected. Socket ID: ${socket.id}`)
        socket.disconnect()
        resolve()
      }, 500)
    })
    
    socket.on('connect_error', (err) => {
      clearTimeout(timeout)
      log('WebSocket', 'fail', err.message)
      resolve()
    })
  })
}

async function runTests() {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║          🔬 SportIntel Network Connection Test                     ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log('')
  
  await testDatabase()
  await testRedis()
  await testSignalBus()
  await testAPI()
  await testWebSocket()
  
  console.log('')
  console.log('════════════════════════════════════════════════════════════════════')
  
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  
  if (failed === 0 && passed >= 3) {
    console.log('')
    console.log('🎉 Network is ready! Start with: npm run network')
  } else if (failed > 0) {
    console.log('')
    console.log('⚠️  Some components need attention. See failures above.')
  }
  
  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

runTests()
