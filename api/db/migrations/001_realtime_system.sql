-- Migration: Real-time Arbitrage System Tables
-- Run after base schema.sql

-- Arbitrage history (for analytics and tracking)
CREATE TABLE IF NOT EXISTS arbitrage_history (
  id SERIAL PRIMARY KEY,
  arb_id VARCHAR(255) UNIQUE NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  game VARCHAR(500) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  arb_type VARCHAR(20) NOT NULL,
  profit DECIMAL(5,2) NOT NULL,
  book1_name VARCHAR(50) NOT NULL,
  book1_bet VARCHAR(255) NOT NULL,
  book1_odds INTEGER NOT NULL,
  book1_stake DECIMAL(5,2) NOT NULL,
  book2_name VARCHAR(50) NOT NULL,
  book2_bet VARCHAR(255) NOT NULL,
  book2_odds INTEGER NOT NULL,
  book2_stake DECIMAL(5,2) NOT NULL,
  total_implied DECIMAL(6,2),
  detected_at TIMESTAMP NOT NULL,
  expired_at TIMESTAMP,
  lifespan_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arb_history_sport ON arbitrage_history(sport);
CREATE INDEX IF NOT EXISTS idx_arb_history_detected ON arbitrage_history(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_arb_history_profit ON arbitrage_history(profit DESC);

-- User arb notifications tracking
CREATE TABLE IF NOT EXISTS user_arb_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  arb_id VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered BOOLEAN DEFAULT true,
  delayed BOOLEAN DEFAULT false,
  UNIQUE(user_id, arb_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_arb_notif_user ON user_arb_notifications(user_id, sent_at DESC);

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  tier VARCHAR(20) NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  stripe_price_monthly VARCHAR(255),
  stripe_price_yearly VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO subscription_plans (name, tier, price_monthly, price_yearly, features) VALUES
('Free', 'free', 0, 0, '{"arb_delay_seconds": 5, "max_sports": 2, "websocket": true, "telegram": false, "discord": false, "api_calls_per_day": 100, "history_days": 1}'),
('Pro', 'pro', 29.99, 299.99, '{"arb_delay_seconds": 0, "max_sports": 4, "websocket": true, "telegram": true, "discord": true, "api_calls_per_day": 1000, "history_days": 30, "steam_alerts": true}'),
('Premium', 'premium', 79.99, 799.99, '{"arb_delay_seconds": 0, "max_sports": -1, "websocket": true, "telegram": true, "discord": true, "api_calls_per_day": -1, "history_days": -1, "steam_alerts": true, "prop_arb": true}')
ON CONFLICT (name) DO NOTHING;

-- Add tier column to users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tier') THEN
    ALTER TABLE users ADD COLUMN tier VARCHAR(20) DEFAULT 'free';
  END IF;
END $$;

-- Add favorite_sports to user_preferences
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='favorite_sports') THEN
    ALTER TABLE user_preferences ADD COLUMN favorite_sports TEXT[] DEFAULT ARRAY['nba', 'nfl'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='favorite_books') THEN
    ALTER TABLE user_preferences ADD COLUMN favorite_books TEXT[] DEFAULT ARRAY['draftkings', 'fanduel'];
  END IF;
END $$;
