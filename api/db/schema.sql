-- SportIntel Database Schema
-- Run this to set up PostgreSQL tables for users, props, and watchlists

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User preferences (alert settings, etc.)
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id VARCHAR(50),
  discord_webhook_url TEXT,
  arbitrage_alerts BOOLEAN DEFAULT true,
  steam_move_alerts BOOLEAN DEFAULT true,
  prop_alerts BOOLEAN DEFAULT true,
  min_arbitrage_profit DECIMAL(5,2) DEFAULT 0.5,
  min_steam_change INTEGER DEFAULT 15,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Player prop watchlist
CREATE TABLE IF NOT EXISTS prop_watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player_name VARCHAR(255) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  prop_type VARCHAR(50) NOT NULL,
  target_line DECIMAL(6,1),
  alert_on_edge DECIMAL(5,2) DEFAULT 5.0,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved prop snapshots (for tracking)
CREATE TABLE IF NOT EXISTS prop_snapshots (
  id SERIAL PRIMARY KEY,
  watchlist_id INTEGER REFERENCES prop_watchlist(id) ON DELETE CASCADE,
  bookmaker VARCHAR(50) NOT NULL,
  line DECIMAL(6,1) NOT NULL,
  over_odds INTEGER,
  under_odds INTEGER,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys for public API access
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(12) NOT NULL,
  name VARCHAR(100),
  tier VARCHAR(20) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- API Usage tracking (daily aggregates)
CREATE TABLE IF NOT EXISTS api_usage_daily (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  endpoint_counts JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(api_key_id, usage_date)
);

-- Subscriptions for billing
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  stripe_subscription_id VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON prop_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_player ON prop_watchlist(player_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_watchlist ON prop_snapshots(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_usage_daily_key_date ON api_usage_daily(api_key_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
