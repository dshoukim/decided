CREATE TABLE "match_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"match_id" varchar(50) NOT NULL,
	"round_number" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now(),
	"next_match_id" varchar(50),
	CONSTRAINT "match_completions_room_id_match_id_unique" UNIQUE("room_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "room_states" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"state_version" integer DEFAULT 1 NOT NULL,
	"current_state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_actions" (
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
--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();--> statement-breakpoint
ALTER TABLE "match_completions" ADD CONSTRAINT "match_completions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_states" ADD CONSTRAINT "room_states_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_states" ADD CONSTRAINT "room_states_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_match_completions_room" ON "match_completions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_match_completions_match" ON "match_completions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_room_states_version" ON "room_states" USING btree ("room_id","state_version");--> statement-breakpoint
CREATE INDEX "idx_user_actions_room_user" ON "user_actions" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_actions_idempotency" ON "user_actions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_user_actions_processed_at" ON "user_actions" USING btree ("processed_at");