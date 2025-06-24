-- Tournament Architecture Rewrite Migration
-- This creates a simplified, unified tournament system

-- Create tournament_state table to replace complex tournamentData JSON
CREATE TABLE IF NOT EXISTS tournament_state (
  room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('generating', 'round_1', 'round_2', 'round_3', 'final', 'completed')),
  current_round INTEGER NOT NULL DEFAULT 1,
  total_rounds INTEGER NOT NULL,
  current_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_picks JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_movies JSONB NOT NULL DEFAULT '[]'::jsonb,
  winner_movie_id INTEGER,
  winner_title TEXT,
  winner_poster_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tournament_state_status ON tournament_state(status);
CREATE INDEX IF NOT EXISTS idx_tournament_state_room_id ON tournament_state(room_id);

-- Update function for automatic updated_at
CREATE OR REPLACE FUNCTION update_tournament_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic updated_at and version increment
DROP TRIGGER IF EXISTS update_tournament_state_updated_at_trigger ON tournament_state;
CREATE TRIGGER update_tournament_state_updated_at_trigger
  BEFORE UPDATE ON tournament_state
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_state_updated_at();

-- RLS policies for tournament_state
ALTER TABLE tournament_state ENABLE ROW LEVEL SECURITY;

-- Users can only access tournament state for rooms they're participants in
CREATE POLICY tournament_state_access_policy ON tournament_state
  FOR ALL
  USING (
    room_id IN (
      SELECT r.id 
      FROM rooms r 
      JOIN room_participants rp ON r.id = rp.room_id 
      WHERE rp.user_id = auth.uid()
    )
  );

-- Allow inserts for room owners
CREATE POLICY tournament_state_insert_policy ON tournament_state
  FOR INSERT
  WITH CHECK (
    room_id IN (
      SELECT r.id 
      FROM rooms r 
      WHERE r.owner_id = auth.uid()
    )
  ); 