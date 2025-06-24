-- Migration: Decided V2 Complete Refactoring
-- Description: Implements server-driven architecture for tournament feature

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create new tables from Drizzle migration
CREATE TABLE IF NOT EXISTS "match_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"match_id" varchar(50) NOT NULL,
	"round_number" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now(),
	"next_match_id" varchar(50),
	CONSTRAINT "match_completions_room_id_match_id_unique" UNIQUE("room_id","match_id")
);

CREATE TABLE IF NOT EXISTS "room_states" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"state_version" integer DEFAULT 1 NOT NULL,
	"current_state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" uuid
);

CREATE TABLE IF NOT EXISTS "user_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_payload" jsonb,
	"idempotency_key" varchar(100),
	"processed_at" timestamp with time zone DEFAULT now(),
	"result" varchar(20) NOT NULL,
	"error_message" text,
	CONSTRAINT "result_check" CHECK ("user_actions"."result" IN ('success', 'error', 'ignored'))
);

-- 2. Add foreign key constraints
ALTER TABLE "match_completions" ADD CONSTRAINT "match_completions_room_id_rooms_id_fk" 
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "room_states" ADD CONSTRAINT "room_states_room_id_rooms_id_fk" 
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "room_states" ADD CONSTRAINT "room_states_updated_by_users_id_fk" 
  FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_room_id_rooms_id_fk" 
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS "idx_match_completions_room" ON "match_completions" USING btree ("room_id");
CREATE INDEX IF NOT EXISTS "idx_match_completions_match" ON "match_completions" USING btree ("match_id");
CREATE INDEX IF NOT EXISTS "idx_room_states_version" ON "room_states" USING btree ("room_id","state_version");
CREATE INDEX IF NOT EXISTS "idx_user_actions_room_user" ON "user_actions" USING btree ("room_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_user_actions_idempotency" ON "user_actions" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_user_actions_processed_at" ON "user_actions" USING btree ("processed_at");

-- 4. Modifications to existing tables

-- Add fields to track user progress independently
ALTER TABLE room_participants
  ADD COLUMN IF NOT EXISTS current_match_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_matches TEXT[] DEFAULT '{}';

-- Add unique constraint to prevent duplicate picks at DB level
ALTER TABLE bracket_picks
  DROP CONSTRAINT IF EXISTS unique_room_user_match,
  ADD CONSTRAINT unique_room_user_match UNIQUE (room_id, user_id, match_id);

-- 5. Create function to update last_action_at automatically
CREATE OR REPLACE FUNCTION update_last_action_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE room_participants
  SET last_action_at = NOW()
  WHERE room_id = NEW.room_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for user actions
DROP TRIGGER IF EXISTS update_participant_last_action ON user_actions;
CREATE TRIGGER update_participant_last_action
AFTER INSERT ON user_actions
FOR EACH ROW
EXECUTE FUNCTION update_last_action_at();

-- 7. Add comments to track migration
COMMENT ON TABLE room_states IS 'Decided V2: Server-driven UI state storage';
COMMENT ON TABLE match_completions IS 'Decided V2: Tracks completed matches for progression';
COMMENT ON TABLE user_actions IS 'Decided V2: Audit log and idempotency tracking';

-- 8. Modify addedFrom constraint to allow 'decided_together'
ALTER TABLE watch_list DROP CONSTRAINT IF EXISTS added_from_check;
ALTER TABLE watch_list ADD CONSTRAINT added_from_check 
  CHECK (added_from IN ('survey', 'search', 'manual', 'decided_together')); 