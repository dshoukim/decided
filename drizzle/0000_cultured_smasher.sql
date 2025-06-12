CREATE TABLE "genre_characteristics" (
	"id" serial PRIMARY KEY NOT NULL,
	"genre_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	CONSTRAINT "genres_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "movie_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_movie_id" integer NOT NULL,
	"movie_title" text NOT NULL,
	"rating_type" text NOT NULL,
	"movie_data" jsonb,
	"user_note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "rating_type_check" CHECK ("movie_ratings"."rating_type" IN ('like', 'dislike', 'love', 'not_seen'))
);
--> statement-breakpoint
CREATE TABLE "streaming_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"monthly_price" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "streaming_services_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"streaming_services" text[],
	"selected_genres" text[],
	"selected_characteristics" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "watch_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_movie_id" integer NOT NULL,
	"movie_title" text NOT NULL,
	"movie_data" jsonb,
	"user_note" text,
	"added_from" text NOT NULL,
	"is_watched" boolean DEFAULT false,
	"watched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "added_from_check" CHECK ("watch_list"."added_from" IN ('survey', 'search', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "genre_characteristics" ADD CONSTRAINT "genre_characteristics_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_ratings" ADD CONSTRAINT "movie_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_list" ADD CONSTRAINT "watch_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_genre_characteristics_genre_id" ON "genre_characteristics" USING btree ("genre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_movie_ratings_user_movie" ON "movie_ratings" USING btree ("user_id","tmdb_movie_id");--> statement-breakpoint
CREATE INDEX "idx_movie_ratings_user_id" ON "movie_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_movie_ratings_tmdb_id" ON "movie_ratings" USING btree ("tmdb_movie_id");--> statement-breakpoint
CREATE INDEX "idx_movie_ratings_rating_type" ON "movie_ratings" USING btree ("rating_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watch_list_user_movie" ON "watch_list" USING btree ("user_id","tmdb_movie_id");--> statement-breakpoint
CREATE INDEX "idx_watch_list_user_id" ON "watch_list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_watch_list_tmdb_id" ON "watch_list" USING btree ("tmdb_movie_id");--> statement-breakpoint
CREATE INDEX "idx_watch_list_added_from" ON "watch_list" USING btree ("added_from");--> statement-breakpoint
CREATE INDEX "idx_watch_list_is_watched" ON "watch_list" USING btree ("is_watched");