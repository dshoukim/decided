CREATE TABLE "films" (
	"id" serial PRIMARY KEY NOT NULL,
	"tmdb_id" integer NOT NULL,
	"imdb_id" varchar(15),
	"title" varchar(500) NOT NULL,
	"original_title" varchar(500),
	"overview" text,
	"tagline" text,
	"release_date" text,
	"status" varchar(50),
	"runtime" integer,
	"vote_average" integer,
	"vote_count" integer,
	"popularity" integer,
	"adult" boolean DEFAULT false,
	"original_language" varchar(5),
	"spoken_languages" text[],
	"poster_path" varchar(255),
	"backdrop_path" varchar(255),
	"budget" integer,
	"revenue" integer,
	"genres" text[],
	"production_companies" text[],
	"production_countries" text[],
	"keywords" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "films_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
ALTER TABLE "watch_list" DROP CONSTRAINT "added_from_check";--> statement-breakpoint
ALTER TABLE "room_participants" ADD COLUMN "completed_matches" text[] DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "room_participants" ADD COLUMN "current_match_index" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "idx_films_tmdb_id" ON "films" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "idx_films_imdb_id" ON "films" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX "idx_films_title" ON "films" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_films_release_date" ON "films" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "idx_films_status" ON "films" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_films_vote_average" ON "films" USING btree ("vote_average");--> statement-breakpoint
CREATE INDEX "idx_films_popularity" ON "films" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "idx_films_genres" ON "films" USING btree ("genres");--> statement-breakpoint
CREATE INDEX "idx_films_language" ON "films" USING btree ("original_language");--> statement-breakpoint
CREATE INDEX "idx_films_adult" ON "films" USING btree ("adult");--> statement-breakpoint
ALTER TABLE "watch_list" ADD CONSTRAINT "added_from_check" CHECK ("watch_list"."added_from" IN ('survey', 'search', 'manual', 'decided_together'));