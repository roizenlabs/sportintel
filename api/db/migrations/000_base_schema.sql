-- Migration: Base Schema
-- Core tables for SportIntel
-- Note: Uses existing users table with UUID primary key

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (may already exist - IF NOT EXISTS handles this)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  subscription_tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  default_sport VARCHAR(20) DEFAULT 'nba',
  arb_min_profit DECIMAL(5,2) DEFAULT 1.0,
  telegram_enabled BOOLEAN DEFAULT false,
  discord_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  favorite_sports TEXT[] DEFAULT ARRAY['nba', 'nfl'],
  favorite_books TEXT[] DEFAULT ARRAY['draftkings', 'fanduel'],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT auth
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Prop watchlist
CREATE TABLE IF NOT EXISTS prop_watchlist (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player_name VARCHAR(255) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  prop_type VARCHAR(50) NOT NULL,
  target_line DECIMAL(6,2),
  alert_on_edge DECIMAL(5,2) DEFAULT 5.0,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON prop_watchlist(user_id, active);

-- Prop snapshots for history
CREATE TABLE IF NOT EXISTS prop_snapshots (
  id SERIAL PRIMARY KEY,
  watchlist_id INTEGER REFERENCES prop_watchlist(id) ON DELETE CASCADE,
  bookmaker VARCHAR(50) NOT NULL,
  line DECIMAL(6,2) NOT NULL,
  over_odds INTEGER,
  under_odds INTEGER,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prop_snapshots ON prop_snapshots(watchlist_id, captured_at DESC);
