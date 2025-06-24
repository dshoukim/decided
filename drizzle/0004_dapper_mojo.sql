CREATE TABLE "tournament_state" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"status" varchar(20) NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"total_rounds" integer NOT NULL,
	"current_matches" jsonb DEFAULT '[]' NOT NULL,
	"completed_picks" jsonb DEFAULT '[]' NOT NULL,
	"all_movies" jsonb DEFAULT '[]' NOT NULL,
	"winner_movie_id" integer,
	"winner_title" text,
	"winner_poster_path" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tournament_state_status_check" CHECK ("tournament_state"."status" IN ('generating', 'round_1', 'round_2', 'round_3', 'final', 'completed'))
);
--> statement-breakpoint
ALTER TABLE "movie_ratings" DROP CONSTRAINT "rating_type_check";--> statement-breakpoint
ALTER TABLE "streaming_services" ALTER COLUMN "monthly_price" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "streaming_services" ALTER COLUMN "monthly_price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "trailer_link" varchar(500);--> statement-breakpoint
ALTER TABLE "genre_characteristics" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "genre_characteristics" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "genres" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "genres" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "movie_ratings" ADD COLUMN "star_rating" integer;--> statement-breakpoint
ALTER TABLE "room_participants" ADD COLUMN "last_action_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "tournament_state" ADD CONSTRAINT "tournament_state_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tournament_state_status" ON "tournament_state" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tournament_state_room_id" ON "tournament_state" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_movie_ratings_star_rating" ON "movie_ratings" USING btree ("star_rating");--> statement-breakpoint
ALTER TABLE "movie_ratings" ADD CONSTRAINT "star_rating_check" CHECK ("movie_ratings"."star_rating" IS NULL OR ("movie_ratings"."star_rating" >= 1 AND "movie_ratings"."star_rating" <= 5));--> statement-breakpoint
ALTER TABLE "movie_ratings" ADD CONSTRAINT "rating_type_check" CHECK ("movie_ratings"."rating_type" IN ('like', 'dislike', 'love', 'not_seen', 'star'));