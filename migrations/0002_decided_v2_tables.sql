-- Migration: Add Decided V2 tables and modifications
-- Description: Implements server-driven architecture for tournament feature

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. New Tables

-- Stores complete UI state for each room
CREATE TABLE room_states (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  state_version INTEGER NOT NULL DEFAULT 1,
  current_state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Create index for version queries
CREATE INDEX idx_room_states_version ON room_states(room_id, state_version);

-- Tracks when matches are complete (both users picked)
CREATE TABLE match_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  match_id VARCHAR(50) NOT NULL,
  round_number INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  next_match_id VARCHAR(50),
  UNIQUE(room_id, match_id)
);

-- Create indexes for match completions
CREATE INDEX idx_match_completions_room ON match_completions(room_id);
CREATE INDEX idx_match_completions_match ON match_completions(match_id);

-- Audit log for all user actions
CREATE TABLE user_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_payload JSONB,
  idempotency_key VARCHAR(100),
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'error', 'ignored')),
  error_message TEXT
);

-- Create indexes for user actions
CREATE INDEX idx_user_actions_room_user ON user_actions(room_id, user_id);
CREATE INDEX idx_user_actions_idempotency ON user_actions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_user_actions_processed_at ON user_actions(processed_at);

-- 2. Modifications to existing tables

-- Add fields to track user progress independently
ALTER TABLE room_participants
  ADD COLUMN IF NOT EXISTS current_match_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_matches TEXT[] DEFAULT '{}';

-- Add unique constraint to prevent duplicate picks at DB level
ALTER TABLE bracket_picks
  DROP CONSTRAINT IF EXISTS unique_room_user_match,
  ADD CONSTRAINT unique_room_user_match UNIQUE (room_id, user_id, match_id);

-- Create function to update last_action_at automatically
CREATE OR REPLACE FUNCTION update_last_action_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE room_participants
  SET last_action_at = NOW()
  WHERE room_id = NEW.room_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user actions
CREATE TRIGGER update_participant_last_action
AFTER INSERT ON user_actions
FOR EACH ROW
EXECUTE FUNCTION update_last_action_at();

-- Add comment to track migration
COMMENT ON TABLE room_states IS 'Decided V2: Server-driven UI state storage';
COMMENT ON TABLE match_completions IS 'Decided V2: Tracks completed matches for progression';
COMMENT ON TABLE user_actions IS 'Decided V2: Audit log and idempotency tracking'; 