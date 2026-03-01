-- CLAWBOT Schema
-- Tracks predictions, resolutions, and agent performance over time

-- ─── Markets cache ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  slug          TEXT PRIMARY KEY,
  question      TEXT NOT NULL,
  category      TEXT,
  yes_price     NUMERIC,
  liquidity     NUMERIC,
  volume_24h    NUMERIC,
  days_to_resolution INTEGER,
  end_date      TIMESTAMPTZ,
  resolved      BOOLEAN DEFAULT FALSE,
  resolution    TEXT,        -- 'YES' | 'NO'
  resolved_at   TIMESTAMPTZ,
  image         TEXT,
  last_seen     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Predictions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_slug     TEXT REFERENCES markets(slug),
  agent_id        TEXT NOT NULL,   -- 'contrarian' | 'momentum' | etc
  agent_name      TEXT NOT NULL,
  position        TEXT NOT NULL,   -- 'YES' | 'NO' | 'SKIP' | 'PASS' | 'WAIT' | 'NO_EDGE'
  confidence      NUMERIC,         -- 0.0–1.0
  reasoning       TEXT,            -- primary reasoning text
  detail          JSONB,           -- full agent-specific output
  suggested_size  TEXT,
  -- Resolution tracking (filled in later)
  outcome         TEXT,            -- 'WIN' | 'LOSS' | 'VOID' (void = abstained)
  resolved_at     TIMESTAMPTZ,
  -- Meta
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Agent stats (materialized view as table for easy querying) ───────────────
CREATE TABLE IF NOT EXISTS agent_stats (
  agent_id        TEXT PRIMARY KEY,
  agent_name      TEXT NOT NULL,
  total_calls     INTEGER DEFAULT 0,
  active_calls    INTEGER DEFAULT 0,   -- YES or NO (not abstentions)
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  win_rate        NUMERIC DEFAULT 0,
  total_pnl       NUMERIC DEFAULT 0,   -- simulated $10/bet
  avg_confidence  NUMERIC DEFAULT 0,
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial agent rows
INSERT INTO agent_stats (agent_id, agent_name) VALUES
  ('contrarian',    'THE CONTRARIAN'),
  ('momentum',      'THE MOMENTUM RIDER'),
  ('fundamentalist','THE FUNDAMENTALIST'),
  ('scalper',       'THE SCALPER'),
  ('degenerate',    'THE DEGENERATE')
ON CONFLICT (agent_id) DO NOTHING;

-- ─── Alert log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_slug TEXT REFERENCES markets(slug),
  consensus   TEXT,
  yes_votes   INTEGER,
  no_votes    INTEGER,
  avg_conf    NUMERIC,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS predictions_agent_id  ON predictions(agent_id);
CREATE INDEX IF NOT EXISTS predictions_market    ON predictions(market_slug);
CREATE INDEX IF NOT EXISTS predictions_created   ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS predictions_outcome   ON predictions(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS markets_resolved      ON markets(resolved);

-- ─── Function: recalculate agent stats ───────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_agent_stats(p_agent_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_total     INTEGER;
  v_active    INTEGER;
  v_wins      INTEGER;
  v_losses    INTEGER;
  v_wr        NUMERIC;
  v_pnl       NUMERIC;
  v_avg_conf  NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE position IN ('YES','NO')),
    COUNT(*) FILTER (WHERE outcome = 'WIN'),
    COUNT(*) FILTER (WHERE outcome = 'LOSS'),
    AVG(confidence) FILTER (WHERE position IN ('YES','NO'))
  INTO v_total, v_active, v_wins, v_losses, v_avg_conf
  FROM predictions
  WHERE agent_id = p_agent_id;

  v_wr  := CASE WHEN (v_wins + v_losses) > 0 THEN v_wins::NUMERIC / (v_wins + v_losses) ELSE 0 END;
  v_pnl := (v_wins * 10) - (v_losses * 10);  -- $10 per bet simulation

  UPDATE agent_stats SET
    total_calls    = v_total,
    active_calls   = v_active,
    wins           = v_wins,
    losses         = v_losses,
    win_rate       = v_wr,
    total_pnl      = v_pnl,
    avg_confidence = COALESCE(v_avg_conf, 0),
    last_updated   = NOW()
  WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Trigger: auto-recalculate stats when a prediction is resolved ────────────
CREATE OR REPLACE FUNCTION trigger_recalc_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.outcome IS NOT NULL AND (OLD.outcome IS NULL OR OLD.outcome != NEW.outcome) THEN
    PERFORM recalculate_agent_stats(NEW.agent_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_prediction_resolved ON predictions;
CREATE TRIGGER on_prediction_resolved
  AFTER UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_stats();

-- ─── RLS: public read, service role write ────────────────────────────────────
ALTER TABLE markets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts       ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "public read markets"     ON markets     FOR SELECT USING (true);
CREATE POLICY "public read predictions" ON predictions FOR SELECT USING (true);
CREATE POLICY "public read agent_stats" ON agent_stats FOR SELECT USING (true);
CREATE POLICY "public read alerts"      ON alerts      FOR SELECT USING (true);

-- Only service role can write (edge function uses service role key)
CREATE POLICY "service write markets"     ON markets     FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service write predictions" ON predictions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service write agent_stats" ON agent_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service write alerts"      ON alerts      FOR ALL USING (auth.role() = 'service_role');
