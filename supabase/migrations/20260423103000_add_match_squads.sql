ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS team_a_players JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS team_b_players JSONB NOT NULL DEFAULT '[]'::jsonb;
