-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table for managing collaborative sessions
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(6) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  winner_movie_id INTEGER,
  winner_title TEXT,
  winner_poster_path TEXT,
  tournament_data JSONB,
  CONSTRAINT valid_timestamps CHECK (
    (started_at IS NULL OR started_at >= created_at) AND
    (completed_at IS NULL OR completed_at >= started_at) AND
    (closed_at IS NULL OR closed_at >= created_at)
  )
);

-- Room participants with 2-person limit
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  final_pick_movie_id INTEGER,
  UNIQUE(room_id, user_id)
);

-- Trigger to enforce max 2 participants
CREATE OR REPLACE FUNCTION check_room_participant_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM room_participants WHERE room_id = NEW.room_id) >= 2 THEN
    RAISE EXCEPTION 'Room already has maximum participants (2)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_room_participant_limit
BEFORE INSERT ON room_participants
FOR EACH ROW EXECUTE FUNCTION check_room_participant_limit();

-- Tournament bracket picks
CREATE TABLE bracket_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_id VARCHAR(50) NOT NULL,
  movie_a_id INTEGER NOT NULL,
  movie_b_id INTEGER NOT NULL,
  selected_movie_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  response_time_ms INTEGER,
  UNIQUE(room_id, user_id, match_id),
  CHECK (selected_movie_id IN (movie_a_id, movie_b_id))
);

-- ELO ratings (separate from like/dislike/love)
CREATE TABLE user_movie_elo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  elo_rating INTEGER DEFAULT 1200,
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, movie_id)
);

-- Room history for analytics
CREATE TABLE room_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_owner ON rooms(owner_id);
CREATE INDEX idx_rooms_created_at ON rooms(created_at DESC);
CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);
CREATE INDEX idx_room_participants_active ON room_participants(room_id) WHERE is_active = true;
CREATE INDEX idx_bracket_picks_room_user ON bracket_picks(room_id, user_id);
CREATE INDEX idx_bracket_picks_response_time ON bracket_picks(response_time_ms);
CREATE INDEX idx_user_movie_elo_user ON user_movie_elo(user_id);
CREATE INDEX idx_user_movie_elo_rating ON user_movie_elo(elo_rating DESC);
CREATE INDEX idx_room_history_room ON room_history(room_id);
CREATE INDEX idx_room_history_event_type ON room_history(event_type); 