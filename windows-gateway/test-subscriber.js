#!/usr/bin/env node

/**
 * Test Signal Subscriber (Windows)
 * Subscribe to Redis signals and display them in real-time
 */

const Redis = require('ioredis');

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Redis client
const redis = new Redis(REDIS_URL);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║      SportIntel Test Signal Subscriber                 ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Redis: ${REDIS_URL}`);
console.log('');
console.log('Subscribing to channels:');
console.log('  • signals:steam     - Line movement alerts');
console.log('  • signals:arb       - Arbitrage opportunities');
console.log('  • signals:ev        - +EV opportunities');
console.log('  • signals:news      - Breaking news/injuries');
console.log('  • signals:sentiment - Sentiment shifts');
console.log('');
console.log('Waiting for signals...');
console.log('');

// Subscribe to all signal channels
redis.subscribe(
  'signals:steam',
  'signals:arb',
  'signals:ev',
  'signals:news',
  'signals:sentiment',
  (err, count) => {
    if (err) {
      console.error('❌ Failed to subscribe:', err);
      process.exit(1);
    }
    console.log(`✅ Subscribed to ${count} channels\n`);
  }
);

// Handle incoming signals
redis.on('message', (channel, message) => {
  try {
    const signal = JSON.parse(message);

    // Get emoji based on signal type
    const emoji = {
      steam: '🌊',
      arb: '💰',
      ev: '📈',
      news: '🚨',
      sentiment: '🗣️',
    }[signal.type] || '📡';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${emoji} ${signal.type.toUpperCase()} SIGNAL`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Description: ${signal.payload.description}`);
    console.log(`Confidence:  ${signal.payload.confidence}%`);
    console.log(`TTL:         ${signal.payload.ttl}s`);
    console.log(`Source:      ${signal.source.nodeId} (rep: ${signal.source.reputation})`);

    if (signal.payload.gameId) {
      console.log(`Game:        ${signal.payload.gameId}`);
    }

    if (signal.payload.sport) {
      console.log(`Sport:       ${signal.payload.sport}`);
    }

    if (signal.evidence) {
      if (signal.evidence.oldLine !== undefined) {
        console.log(`Old Line:    ${signal.evidence.oldLine}`);
        console.log(`New Line:    ${signal.evidence.newLine}`);
        console.log(`Delta:       ${signal.evidence.delta > 0 ? '+' : ''}${signal.evidence.delta}`);
      }

      if (signal.evidence.books) {
        console.log(`Books:       ${signal.evidence.books.join(', ')}`);
      }
    }

    console.log(`Timestamp:   ${new Date(signal.createdAt).toLocaleString()}`);
    console.log('');

    // Route to agents (placeholder)
    if (signal.type === 'steam') {
      console.log('   → Would route to Steam Chaser Agent');
    } else if (signal.type === 'arb') {
      console.log('   → Would route to Arbitrage Sniper Agent');
    } else if (signal.type === 'news' || signal.type === 'sentiment') {
      console.log('   → Would route to EV+ Hunter Agent');
    }

    console.log('');
  } catch (error) {
    console.error('❌ Error parsing signal:', error.message);
    console.log('Raw message:', message);
  }
});

// Handle Redis connection events
redis.on('connect', () => {
  console.log('✅ Connected to Redis\n');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

redis.on('close', () => {
  console.log('\n⚠️  Redis connection closed');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down subscriber...');
  redis.quit();
  process.exit(0);
});

// Keep alive and show status every 30 seconds
let signalCount = 0;
redis.on('message', () => {
  signalCount++;
});

setInterval(() => {
  console.log(`ℹ️  Still listening... (${signalCount} signals received)`);
}, 30000);
