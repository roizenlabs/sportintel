-- Migration: Context Ledger with optional pgvector
-- Enables semantic search for betting patterns and historical analysis
-- Note: pgvector features are optional - system works without them

-- Try to enable pgvector extension (may fail if not available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  RAISE NOTICE 'pgvector extension enabled';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available - vector features disabled';
END $$;

-- ============================================
-- LINE MOVEMENT HISTORY
-- ============================================

-- Store every line change for pattern analysis
CREATE TABLE IF NOT EXISTS line_movements (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  bookmaker VARCHAR(50) NOT NULL,
  market VARCHAR(50) NOT NULL, -- h2h, spreads, totals
  side VARCHAR(50) NOT NULL,   -- home, away, over, under

  old_line DECIMAL(8,2),
  new_line DECIMAL(8,2),
  old_odds INTEGER,
  new_odds INTEGER,

  delta DECIMAL(8,2),
  velocity DECIMAL(8,4),  -- Change per second

  -- Context at time of move
  time_to_game INTEGER,   -- Seconds until game starts

  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_line_move_game ON line_movements(game_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_move_sport ON line_movements(sport, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_move_book ON line_movements(bookmaker, captured_at DESC);

-- ============================================
-- BETTING PATTERNS
-- ============================================

-- Store patterns for matching (vector column added conditionally below)
CREATE TABLE IF NOT EXISTS betting_patterns (
  id SERIAL PRIMARY KEY,

  -- Pattern description (human readable)
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Pattern conditions
  conditions JSONB NOT NULL DEFAULT '{}',
  -- Example: {"sport": "nba", "line_delta_min": 2, "time_to_game_max": 3600}

  -- Historical outcomes
  sample_size INTEGER DEFAULT 0,
  cover_rate DECIMAL(5,4),  -- 0.0000 to 1.0000
  avg_roi DECIMAL(8,4),     -- Return on investment

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- GAME CONTEXT (for pattern matching)
-- ============================================

CREATE TABLE IF NOT EXISTS game_context (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) UNIQUE NOT NULL,
  sport VARCHAR(20) NOT NULL,

  home_team VARCHAR(255),
  away_team VARCHAR(255),

  -- Game conditions
  start_time TIMESTAMP,
  venue VARCHAR(255),
  weather JSONB,  -- {"temp": 72, "wind": 5, "precipitation": 0}

  -- Team context
  home_injuries JSONB DEFAULT '[]',
  away_injuries JSONB DEFAULT '[]',
  home_record VARCHAR(20),  -- "10-5"
  away_record VARCHAR(20),

  -- Betting context
  opening_line DECIMAL(8,2),
  current_line DECIMAL(8,2),
  consensus_pick VARCHAR(10),  -- "home" or "away"
  public_percentage DECIMAL(5,2),  -- % on favorite

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_context_sport ON game_context(sport, start_time DESC);

-- ============================================
-- SIGNAL OUTCOMES (for reputation/learning)
-- ============================================

CREATE TABLE IF NOT EXISTS signal_outcomes (
  id SERIAL PRIMARY KEY,
  signal_id VARCHAR(255) UNIQUE NOT NULL,
  signal_type VARCHAR(20) NOT NULL,
  node_id VARCHAR(255) NOT NULL,

  game_id VARCHAR(255),
  sport VARCHAR(20),

  -- Signal details
  prediction TEXT,
  confidence INTEGER,

  -- Outcome
  outcome VARCHAR(20),  -- 'correct', 'incorrect', 'push', 'cancelled'
  actual_result TEXT,

  -- Timing
  signal_time TIMESTAMP,
  outcome_time TIMESTAMP,

  -- Reputation impact
  reputation_delta INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_outcome_node ON signal_outcomes(node_id, signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_signal_outcome_type ON signal_outcomes(signal_type, outcome);

-- ============================================
-- NETWORK NODES
-- ============================================

CREATE TABLE IF NOT EXISTS network_nodes (
  id VARCHAR(255) PRIMARY KEY,

  -- Node configuration
  watching_sports TEXT[] DEFAULT ARRAY[]::TEXT[],
  watching_books TEXT[] DEFAULT ARRAY[]::TEXT[],
  agents_enabled TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Reputation
  reputation INTEGER DEFAULT 50,
  signals_published INTEGER DEFAULT 0,
  signals_correct INTEGER DEFAULT 0,
  signals_incorrect INTEGER DEFAULT 0,

  -- Activity
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_sessions INTEGER DEFAULT 1,

  -- Tier (for freemium)
  tier VARCHAR(20) DEFAULT 'free'
);

CREATE INDEX IF NOT EXISTS idx_node_reputation ON network_nodes(reputation DESC);
CREATE INDEX IF NOT EXISTS idx_node_active ON network_nodes(last_seen DESC);

-- ============================================
-- OPTIONAL: Add vector columns if pgvector is available
-- ============================================

DO $$
BEGIN
  -- Check if vector type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    -- Add embedding column to betting_patterns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='betting_patterns' AND column_name='embedding') THEN
      ALTER TABLE betting_patterns ADD COLUMN embedding vector(768);
      CREATE INDEX idx_pattern_embedding ON betting_patterns USING ivfflat (embedding vector_cosine_ops);
      RAISE NOTICE 'Added embedding column to betting_patterns';
    END IF;

    -- Add embedding column to game_context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='game_context' AND column_name='context_embedding') THEN
      ALTER TABLE game_context ADD COLUMN context_embedding vector(768);
      CREATE INDEX idx_game_context_embedding ON game_context USING ivfflat (context_embedding vector_cosine_ops);
      RAISE NOTICE 'Added context_embedding column to game_context';
    END IF;
  ELSE
    RAISE NOTICE 'Vector type not available - skipping embedding columns';
  END IF;
END $$;

-- ============================================
-- HELPER FUNCTIONS (only if pgvector available)
-- ============================================

-- Function to find similar patterns (only works with pgvector)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION find_similar_patterns(
      query_embedding vector(768),
      match_threshold FLOAT DEFAULT 0.7,
      match_count INT DEFAULT 5
    )
    RETURNS TABLE (
      id INT,
      name VARCHAR(255),
      description TEXT,
      conditions JSONB,
      cover_rate DECIMAL,
      similarity FLOAT
    ) AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        p.id,
        p.name,
        p.description,
        p.conditions,
        p.cover_rate,
        1 - (p.embedding <=> query_embedding) as similarity
      FROM betting_patterns p
      WHERE p.is_active = true
        AND p.embedding IS NOT NULL
        AND 1 - (p.embedding <=> query_embedding) > match_threshold
      ORDER BY p.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $func$ LANGUAGE plpgsql;
    ';
    RAISE NOTICE 'Created find_similar_patterns function';
  END IF;
END $$;

-- Function to find similar game contexts (only works with pgvector)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION find_similar_games(
      query_embedding vector(768),
      sport_filter VARCHAR DEFAULT NULL,
      match_count INT DEFAULT 10
    )
    RETURNS TABLE (
      game_id VARCHAR(255),
      home_team VARCHAR(255),
      away_team VARCHAR(255),
      similarity FLOAT
    ) AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        g.game_id,
        g.home_team,
        g.away_team,
        1 - (g.context_embedding <=> query_embedding) as similarity
      FROM game_context g
      WHERE (sport_filter IS NULL OR g.sport = sport_filter)
        AND g.context_embedding IS NOT NULL
      ORDER BY g.context_embedding <=> query_embedding
      LIMIT match_count;
    END;
    $func$ LANGUAGE plpgsql;
    ';
    RAISE NOTICE 'Created find_similar_games function';
  END IF;
END $$;

-- ============================================
-- SEED DATA: Common betting patterns
-- ============================================

INSERT INTO betting_patterns (name, description, conditions, sample_size, cover_rate, avg_roi)
VALUES
  ('Sharp Steam Move', 'Line moves 2+ points in under 60 seconds across 3+ books',
   '{"line_delta_min": 2, "books_min": 3, "time_window_max": 60}',
   1000, 0.58, 0.05),

  ('Reverse Line Movement', 'Line moves opposite to public betting percentage',
   '{"public_pct_min": 65, "line_direction": "against_public"}',
   500, 0.55, 0.03),

  ('Late Sharp Action', 'Significant line move in final hour before game',
   '{"time_to_game_max": 3600, "line_delta_min": 1.5}',
   800, 0.56, 0.04),

  ('Weather Impact Underdog', 'Bad weather games favor underdog',
   '{"weather_wind_min": 15, "spread_min": 3}',
   300, 0.54, 0.02),

  ('Injury Reaction Fade', 'Fade overreaction to injury news in first 30 min',
   '{"injury_news": true, "time_since_news_max": 1800, "line_delta_min": 2}',
   200, 0.57, 0.06)
ON CONFLICT DO NOTHING;
