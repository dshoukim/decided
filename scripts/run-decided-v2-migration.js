import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

const migration = `
-- Migration: Decided V2 Complete Refactoring
-- Description: Implements server-driven architecture for tournament feature

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create new tables
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

-- 2. Add foreign key constraints (with conditional checks)
DO $$
BEGIN
    -- match_completions constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_completions_room_id_rooms_id_fk') THEN
        ALTER TABLE "match_completions" ADD CONSTRAINT "match_completions_room_id_rooms_id_fk" 
        FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    -- room_states constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_states_room_id_rooms_id_fk') THEN
        ALTER TABLE "room_states" ADD CONSTRAINT "room_states_room_id_rooms_id_fk" 
        FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_states_updated_by_users_id_fk') THEN
        ALTER TABLE "room_states" ADD CONSTRAINT "room_states_updated_by_users_id_fk" 
        FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- user_actions constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_actions_room_id_rooms_id_fk') THEN
        ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_room_id_rooms_id_fk" 
        FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_actions_user_id_users_id_fk') THEN
        ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- 3. Create indexes (with conditional checks)
CREATE INDEX IF NOT EXISTS "idx_match_completions_room" ON "match_completions" USING btree ("room_id");
CREATE INDEX IF NOT EXISTS "idx_match_completions_match" ON "match_completions" USING btree ("match_id");
CREATE INDEX IF NOT EXISTS "idx_room_states_version" ON "room_states" USING btree ("room_id","state_version");
CREATE INDEX IF NOT EXISTS "idx_user_actions_room_user" ON "user_actions" USING btree ("room_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_user_actions_idempotency" ON "user_actions" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_user_actions_processed_at" ON "user_actions" USING btree ("processed_at");

-- 4. Modifications to existing tables

-- Add fields to track user progress independently
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'current_match_index') THEN
        ALTER TABLE room_participants ADD COLUMN current_match_index INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'last_action_at') THEN
        ALTER TABLE room_participants ADD COLUMN last_action_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'completed_matches') THEN
        ALTER TABLE room_participants ADD COLUMN completed_matches TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Add unique constraint to prevent duplicate picks at DB level
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_room_user_match') THEN
        ALTER TABLE bracket_picks ADD CONSTRAINT unique_room_user_match UNIQUE (room_id, user_id, match_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        -- Constraint already exists, skip
        NULL;
END $$;

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

-- 6. Create trigger for user actions (drop first to avoid conflicts)
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
`;

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    
    console.log('🚀 Running Decided V2 migration...');
    await client.query(migration);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('match_completions', 'room_states', 'user_actions')
      ORDER BY table_name;
    `);
    
    console.log('📊 New tables created:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration(); 