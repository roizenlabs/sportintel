/**
 * SportIntel Signal Gateway (Windows)
 *
 * HTTP server that receives signals from WSL/remote nodes and publishes to Redis.
 * Acts as a bridge between the signal publishers and the Redis pub/sub network.
 *
 * Usage:
 *   node signal-gateway.js
 *
 * Environment Variables:
 *   SIGNAL_GATEWAY_PORT - HTTP server port (default: 8080)
 *   REDIS_URL - Redis connection string (default: redis://localhost:6379)
 */

const http = require('http');
const { createClient } = require('redis');

// Configuration
const PORT = process.env.SIGNAL_GATEWAY_PORT || 8081;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis channels
const SIGNAL_CHANNELS = {
  steam: 'signals:steam',
  arb: 'signals:arb',
  ev: 'signals:ev',
  news: 'signals:news',
  sentiment: 'signals:sentiment'
};

// Stats tracking
const stats = {
  startTime: Date.now(),
  signalsReceived: 0,
  signalsPublished: 0,
  errors: 0,
  byType: { steam: 0, arb: 0, ev: 0, news: 0, sentiment: 0 }
};

// Redis client
let redis = null;

async function connectRedis() {
  try {
    redis = createClient({ url: REDIS_URL });

    redis.on('error', (err) => {
      console.error('[REDIS] Error:', err.message);
      stats.errors++;
    });

    redis.on('connect', () => {
      console.log('[REDIS] Connected to', REDIS_URL);
    });

    redis.on('reconnecting', () => {
      console.log('[REDIS] Reconnecting...');
    });

    await redis.connect();
    return true;
  } catch (error) {
    console.error('[REDIS] Failed to connect:', error.message);
    return false;
  }
}

async function publishSignal(signal) {
  if (!redis || !redis.isOpen) {
    throw new Error('Redis not connected');
  }

  const channel = SIGNAL_CHANNELS[signal.type];
  if (!channel) {
    throw new Error(`Unknown signal type: ${signal.type}`);
  }

  const payload = JSON.stringify(signal);
  await redis.publish(channel, payload);

  // Also store in a list for history (keep last 1000)
  await redis.lPush(`history:${signal.type}`, payload);
  await redis.lTrim(`history:${signal.type}`, 0, 999);

  stats.signalsPublished++;
  stats.byType[signal.type] = (stats.byType[signal.type] || 0) + 1;

  return { channel, published: true };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    return sendJSON(res, 200, {
      status: 'ok',
      redis: redis?.isOpen ? 'connected' : 'disconnected',
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
      stats
    });
  }

  // Stats endpoint
  if (url.pathname === '/stats' && req.method === 'GET') {
    return sendJSON(res, 200, {
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
      ...stats
    });
  }

  // Main signals endpoint
  if (url.pathname === '/signals' && req.method === 'POST') {
    try {
      const signal = await parseBody(req);
      stats.signalsReceived++;

      // Validate required fields
      if (!signal.type || !signal.id) {
        return sendJSON(res, 400, { error: 'Missing required fields: type, id' });
      }

      // Add server timestamp if not present
      if (!signal.createdAt) {
        signal.createdAt = Date.now();
      }

      // Publish to Redis
      const result = await publishSignal(signal);

      console.log(`[${signal.type.toUpperCase()}] Published to ${result.channel}`);
      console.log(`   ${signal.payload?.description || 'Signal received'}`);
      console.log(`   Confidence: ${signal.payload?.confidence || 'N/A'}%`);
      console.log(`   Source: ${signal.source?.nodeId || 'unknown'}`);

      return sendJSON(res, 200, {
        success: true,
        channel: result.channel,
        signalId: signal.id
      });
    } catch (error) {
      stats.errors++;
      console.error('[ERROR] Failed to process signal:', error.message);
      return sendJSON(res, 500, { error: error.message });
    }
  }

  // Get signal history
  if (url.pathname.startsWith('/history/') && req.method === 'GET') {
    try {
      const type = url.pathname.split('/')[2];
      if (!SIGNAL_CHANNELS[type]) {
        return sendJSON(res, 400, { error: 'Invalid signal type' });
      }

      const limit = parseInt(url.searchParams.get('limit') || '50');
      const signals = await redis.lRange(`history:${type}`, 0, limit - 1);

      return sendJSON(res, 200, {
        type,
        count: signals.length,
        signals: signals.map(s => JSON.parse(s))
      });
    } catch (error) {
      return sendJSON(res, 500, { error: error.message });
    }
  }

  // Query endpoint for on-demand data requests
  if (url.pathname === '/query' && req.method === 'POST') {
    try {
      const { tool, args } = await parseBody(req);

      // This could be extended to call MCP tools directly
      // For now, return a placeholder response
      return sendJSON(res, 200, {
        message: 'Query endpoint - forward to MCP server',
        tool,
        args
      });
    } catch (error) {
      return sendJSON(res, 500, { error: error.message });
    }
  }

  // 404 for unknown routes
  sendJSON(res, 404, { error: 'Not found' });
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        SportIntel Signal Gateway (Windows)                 ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Connect to Redis
  const redisConnected = await connectRedis();

  // Create HTTP server
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`✅ HTTP Server:  http://localhost:${PORT}`);
    console.log(`✅ Redis:        ${REDIS_URL}`);
    console.log(`✅ Redis Status: ${redisConnected ? 'ready' : 'connecting...'}`);
    console.log();
    console.log('📡 Listening for signals from WSL nodes...');
    console.log();
    console.log('Endpoints:');
    console.log('  POST /signals          - Publish a signal');
    console.log('  GET  /health           - Health check');
    console.log('  GET  /stats            - Gateway statistics');
    console.log('  GET  /history/:type    - Get signal history');
    console.log('  POST /query            - Query MCP tools');
    console.log();
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    if (redis) await redis.quit();
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
