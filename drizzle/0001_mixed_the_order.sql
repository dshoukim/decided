CREATE TABLE "bracket_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"match_id" varchar(50) NOT NULL,
	"movie_a_id" integer NOT NULL,
	"movie_b_id" integer NOT NULL,
	"selected_movie_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"response_time_ms" integer,
	CONSTRAINT "bracket_picks_room_id_user_id_match_id_unique" UNIQUE("room_id","user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "room_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	"left_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"final_pick_movie_id" integer,
	CONSTRAINT "room_participants_room_id_user_id_unique" UNIQUE("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"winner_movie_id" integer,
	"winner_title" varchar,
	"winner_poster_path" varchar,
	"tournament_data" jsonb,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_movie_elo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"elo_rating" integer DEFAULT 1200,
	"matches_played" integer DEFAULT 0,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0,
	"last_updated" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_movie_elo_user_id_movie_id_unique" UNIQUE("user_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "streaming_services" ALTER COLUMN "monthly_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "watch_list" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "watch_list" ADD COLUMN "liked" boolean;--> statement-breakpoint
ALTER TABLE "watch_list" ADD COLUMN "review" text;--> statement-breakpoint
ALTER TABLE "watch_list" ADD COLUMN "decided_together_room_id" uuid;--> statement-breakpoint
ALTER TABLE "watch_list" ADD COLUMN "pending_rating" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bracket_picks" ADD CONSTRAINT "bracket_picks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_picks" ADD CONSTRAINT "bracket_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_history" ADD CONSTRAINT "room_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_elo" ADD CONSTRAINT "user_movie_elo_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bracket_picks_room_user" ON "bracket_picks" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_bracket_picks_response_time" ON "bracket_picks" USING btree ("response_time_ms");--> statement-breakpoint
CREATE INDEX "idx_room_history_room" ON "room_history" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_room_history_event_type" ON "room_history" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_room_participants_room" ON "room_participants" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_room_participants_user" ON "room_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_room_participants_active" ON "room_participants" USING btree ("room_id") WHERE "room_participants"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_rooms_code" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_rooms_status" ON "rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rooms_owner" ON "rooms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_rooms_created_at" ON "rooms" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_movie_elo_user" ON "user_movie_elo" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_movie_elo_rating" ON "user_movie_elo" USING btree ("elo_rating");--> statement-breakpoint
ALTER TABLE "watch_list" ADD CONSTRAINT "watch_list_decided_together_room_id_rooms_id_fk" FOREIGN KEY ("decided_together_room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_watch_list_rating" ON "watch_list" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_watch_list_pending_rating" ON "watch_list" USING btree ("pending_rating");--> statement-breakpoint
CREATE INDEX "idx_watch_list_decided_together" ON "watch_list" USING btree ("decided_together_room_id");