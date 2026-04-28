-- MATCHES
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  team_a_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  team_b_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  format TEXT NOT NULL DEFAULT 'T20',
  total_overs INT NOT NULL DEFAULT 20,
  toss_winner TEXT,
  toss_decision TEXT,
  status TEXT NOT NULL DEFAULT 'setup',
  current_innings INT NOT NULL DEFAULT 1,
  scorer_name TEXT,
  scorer_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  view_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_view_token ON public.matches(view_token);
CREATE INDEX idx_matches_scorer_token ON public.matches(scorer_token);

-- INNINGS STATE (one row per innings per match)
CREATE TABLE public.innings_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_number INT NOT NULL,
  batting_team TEXT NOT NULL,
  bowling_team TEXT NOT NULL,
  runs INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  balls INT NOT NULL DEFAULT 0,
  extras INT NOT NULL DEFAULT 0,
  striker TEXT,
  non_striker TEXT,
  bowler TEXT,
  target INT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, innings_number)
);

CREATE INDEX idx_innings_match ON public.innings_state(match_id);

-- BALLS (ball-by-ball log)
CREATE TABLE public.balls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_number INT NOT NULL,
  over_number INT NOT NULL,
  ball_in_over INT NOT NULL,
  runs INT NOT NULL DEFAULT 0,
  extra_type TEXT,
  extra_runs INT NOT NULL DEFAULT 0,
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  wicket_type TEXT,
  out_player TEXT,
  striker TEXT,
  non_striker TEXT,
  bowler TEXT,
  commentary TEXT,
  is_legal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_balls_match_innings ON public.balls(match_id, innings_number, created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_innings_updated BEFORE UPDATE ON public.innings_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innings_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balls ENABLE ROW LEVEL SECURITY;

-- Public read (viewer links work for anyone)
CREATE POLICY "matches_public_read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "innings_public_read" ON public.innings_state FOR SELECT USING (true);
CREATE POLICY "balls_public_read" ON public.balls FOR SELECT USING (true);

-- Public write (scorer URL contains secret token; app-level check)
-- This is a public scoring tool with no user accounts; the secret scorer_token in the URL gates access at the app layer.
CREATE POLICY "matches_public_insert" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "matches_public_update" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "innings_public_insert" ON public.innings_state FOR INSERT WITH CHECK (true);
CREATE POLICY "innings_public_update" ON public.innings_state FOR UPDATE USING (true);
CREATE POLICY "balls_public_insert" ON public.balls FOR INSERT WITH CHECK (true);
CREATE POLICY "balls_public_update" ON public.balls FOR UPDATE USING (true);
CREATE POLICY "balls_public_delete" ON public.balls FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.innings_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balls;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.innings_state REPLICA IDENTITY FULL;
ALTER TABLE public.balls REPLICA IDENTITY FULL;
