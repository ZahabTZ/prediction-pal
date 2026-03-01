
-- Bets table: the memory of the prediction loop
CREATE TABLE public.bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Market info
  market_slug TEXT NOT NULL,
  market_question TEXT NOT NULL,
  market_category TEXT DEFAULT 'general',
  
  -- JUDGE output
  claude_probability NUMERIC(4,3) NOT NULL,  -- e.g. 0.720
  claude_reasoning TEXT NOT NULL,
  
  -- COMPARE output
  market_probability NUMERIC(4,3) NOT NULL,  -- e.g. 0.450
  edge NUMERIC(5,3),                          -- claude - market
  position TEXT NOT NULL CHECK (position IN ('YES', 'NO')),
  suggested_size TEXT DEFAULT 'small' CHECK (suggested_size IN ('small', 'medium', 'large')),
  
  -- Outcome (filled on resolution)
  outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'PUSH', NULL)),
  pnl NUMERIC(10,2),
  
  -- Agent that suggested it
  agent_id TEXT,
  agent_name TEXT,
  
  -- REMEMBER: learning meta
  learnings_applied TEXT,  -- which learning prompt was active when this bet was made
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved'))
);

-- Learnings table: Claude's self-reflections
CREATE TABLE public.learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reflection TEXT NOT NULL,          -- Claude's analysis of its mistakes
  instruction TEXT NOT NULL,         -- The new instruction derived from reflection
  bets_analyzed INTEGER NOT NULL,    -- how many bets were reviewed
  win_rate NUMERIC(4,3),             -- win rate of analyzed bets
  active BOOLEAN NOT NULL DEFAULT true  -- whether this learning is currently applied
);

-- Enable RLS
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth in this app)
CREATE POLICY "Allow all access to bets" ON public.bets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to learnings" ON public.learnings FOR ALL USING (true) WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_bets_status ON public.bets(status);
CREATE INDEX idx_bets_resolved ON public.bets(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX idx_learnings_active ON public.learnings(active) WHERE active = true;
