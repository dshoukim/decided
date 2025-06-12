import { pgTable, index, unique, pgPolicy, serial, text, numeric, boolean, timestamp, foreignKey, integer, uuid, date, uniqueIndex, check, bigint, jsonb, real, varchar } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const streamingServices = pgTable("streaming_services", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	logoUrl: text("logo_url"),
	websiteUrl: text("website_url"),
	description: text(),
	monthlyPrice: numeric("monthly_price", { precision: 10, scale:  2 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_streaming_services_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_streaming_services_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	unique("streaming_services_name_key").on(table.name),
	pgPolicy("Allow full access for authenticated users", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.role() = 'authenticated'::text)` }),
	pgPolicy("Allow read access to streaming services", { as: "permissive", for: "select", to: ["public"] }),
]);

export const genreCharacteristics = pgTable("genre_characteristics", {
	id: serial().primaryKey().notNull(),
	genreId: integer("genre_id"),
	name: text().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_genre_characteristics_genre_id").using("btree", table.genreId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.genreId],
			foreignColumns: [genres.id],
			name: "genre_characteristics_genre_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Genre characteristics are publicly readable", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const genres = pgTable("genres", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	tmdbId: integer("tmdb_id"),
	description: text(),
	icon: text(),
	color: text(),
	isActive: boolean("is_active").default(true),
}, (table) => [
	index("idx_genres_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	unique("genres_name_unique").on(table.name),
	pgPolicy("Genres are publicly readable", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text().notNull(),
	username: text().notNull(),
	dateOfBirth: date("date_of_birth"),
	gender: text(),
	streamingServices: text("streaming_services").array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	selectedGenres: text("selected_genres").array(),
	selectedCharacteristics: text("selected_characteristics").array(),
	avatarUrl: text("avatar_url"),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_users_selected_characteristics").using("gin", table.selectedCharacteristics.asc().nullsLast().op("array_ops")),
	index("idx_users_selected_genres").using("gin", table.selectedGenres.asc().nullsLast().op("array_ops")),
	index("idx_users_username").using("btree", table.username.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [table.id],
			name: "users_id_fkey"
		}),
	unique("users_username_key").on(table.username),
	pgPolicy("Users can update their own profile", { as: "permissive", for: "update", to: ["public"], using: sql`(auth.uid() = id)` }),
	pgPolicy("Users can view their own profile", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can insert their own profile", { as: "permissive", for: "insert", to: ["public"] }),
]);

export const movieRatings = pgTable("movie_ratings", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "movie_ratings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id").notNull(),
	tmdbMovieId: integer("tmdb_movie_id").notNull(),
	movieTitle: text("movie_title").notNull(),
	ratingType: text("rating_type").notNull(),
	movieData: jsonb("movie_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userNote: text("user_note"),
}, (table) => [
	index("idx_movie_ratings_rating_type").using("btree", table.ratingType.asc().nullsLast().op("text_ops")),
	index("idx_movie_ratings_tmdb_id").using("btree", table.tmdbMovieId.asc().nullsLast().op("int4_ops")),
	index("idx_movie_ratings_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_movie_ratings_user_movie").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.tmdbMovieId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "movie_ratings_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own movie ratings", { as: "permissive", for: "delete", to: ["public"], using: sql`(( SELECT auth.uid() AS uid) = user_id)` }),
	pgPolicy("Users can update their own movie ratings", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert their own movie ratings", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view their own movie ratings", { as: "permissive", for: "select", to: ["public"] }),
	check("movie_ratings_rating_type_check", sql`rating_type = ANY (ARRAY['like'::text, 'dislike'::text, 'love'::text, 'not_seen'::text])`),
]);

export const friends = pgTable("friends", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	friendUserId: integer("friend_user_id").notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const userGenres = pgTable("user_genres", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	genreId: integer("genre_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.genreId],
			foreignColumns: [genres.id],
			name: "user_genres_genre_id_genres_id_fk"
		}),
]);

export const watchlists = pgTable("watchlists", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	mediaType: text("media_type").notNull(),
	title: text().notNull(),
	posterPath: text("poster_path"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const watchParties = pgTable("watch_parties", {
	id: serial().primaryKey().notNull(),
	hostId: integer("host_id").notNull(),
	name: text().notNull(),
	code: text().notNull(),
	type: text().notNull(),
	status: text().default('active').notNull(),
	queueGenerated: boolean("queue_generated").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("watch_parties_code_unique").on(table.code),
]);

export const partyParticipants = pgTable("party_participants", {
	id: serial().primaryKey().notNull(),
	partyId: integer("party_id").notNull(),
	userId: integer("user_id").notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [watchParties.id],
			name: "party_participants_party_id_watch_parties_id_fk"
		}),
]);

export const partyQueue = pgTable("party_queue", {
	id: serial().primaryKey().notNull(),
	partyId: integer("party_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	title: text().notNull(),
	posterPath: text("poster_path"),
	overview: text(),
	releaseDate: text("release_date"),
	voteAverage: real("vote_average"),
	genres: text().array(),
	streamingPlatforms: text("streaming_platforms").array(),
	runtime: integer(),
	orderIndex: integer("order_index").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [watchParties.id],
			name: "party_queue_party_id_watch_parties_id_fk"
		}),
]);

export const partyVotes = pgTable("party_votes", {
	id: serial().primaryKey().notNull(),
	partyId: integer("party_id").notNull(),
	userId: integer("user_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	score: integer().notNull(),
	seen: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.partyId],
			foreignColumns: [watchParties.id],
			name: "party_votes_party_id_watch_parties_id_fk"
		}),
]);

export const ratings = pgTable("ratings", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	score: integer().notNull(),
	reviewText: text("review_text"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const watchList = pgTable("watch_list", {
	id: serial().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tmdbMovieId: integer("tmdb_movie_id").notNull(),
	movieTitle: text("movie_title").notNull(),
	movieData: jsonb("movie_data"),
	userNote: text("user_note"),
	addedFrom: text("added_from").notNull(),
	isWatched: boolean("is_watched").default(false),
	watchedAt: timestamp("watched_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	rating: integer(),
	liked: boolean(),
	review: text(),
	decidedTogetherRoomId: uuid("decided_together_room_id"),
	pendingRating: boolean("pending_rating").default(false),
}, (table) => [
	index("idx_watch_list_added_from").using("btree", table.addedFrom.asc().nullsLast().op("text_ops")),
	index("idx_watch_list_decided_together").using("btree", table.decidedTogetherRoomId.asc().nullsLast().op("uuid_ops")),
	index("idx_watch_list_is_watched").using("btree", table.isWatched.asc().nullsLast().op("bool_ops")),
	index("idx_watch_list_pending_rating").using("btree", table.pendingRating.asc().nullsLast().op("bool_ops")),
	index("idx_watch_list_rating").using("btree", table.rating.asc().nullsLast().op("int4_ops")),
	index("idx_watch_list_tmdb_id").using("btree", table.tmdbMovieId.asc().nullsLast().op("int4_ops")),
	index("idx_watch_list_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_watch_list_user_movie").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.tmdbMovieId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.decidedTogetherRoomId],
			foreignColumns: [rooms.id],
			name: "watch_list_decided_together_room_id_rooms_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "watch_list_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own watch list items", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update their own watch list items", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert their own watch list items", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view their own watch list", { as: "permissive", for: "select", to: ["public"] }),
	check("watch_list_added_from_check", sql`added_from = ANY (ARRAY['survey'::text, 'search'::text, 'manual'::text])`),
]);

export const rooms = pgTable("rooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 6 }).notNull(),
	ownerId: uuid("owner_id").notNull(),
	status: varchar({ length: 20 }).default('waiting').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
	winnerMovieId: integer("winner_movie_id"),
	winnerTitle: varchar("winner_title"),
	winnerPosterPath: varchar("winner_poster_path"),
	tournamentData: jsonb("tournament_data"),
}, (table) => [
	index("idx_rooms_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_rooms_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_rooms_owner").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	index("idx_rooms_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "rooms_owner_id_users_id_fk"
		}).onDelete("cascade"),
	unique("rooms_code_unique").on(table.code),
]);

export const bracketPicks = pgTable("bracket_picks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	userId: uuid("user_id").notNull(),
	roundNumber: integer("round_number").notNull(),
	matchId: varchar("match_id", { length: 50 }).notNull(),
	movieAId: integer("movie_a_id").notNull(),
	movieBId: integer("movie_b_id").notNull(),
	selectedMovieId: integer("selected_movie_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	responseTimeMs: integer("response_time_ms"),
}, (table) => [
	index("idx_bracket_picks_response_time").using("btree", table.responseTimeMs.asc().nullsLast().op("int4_ops")),
	index("idx_bracket_picks_room_user").using("btree", table.roomId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "bracket_picks_room_id_rooms_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bracket_picks_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("bracket_picks_room_id_user_id_match_id_unique").on(table.roomId, table.userId, table.matchId),
]);

export const roomHistory = pgTable("room_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	eventType: varchar("event_type", { length: 50 }).notNull(),
	eventData: jsonb("event_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_room_history_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_room_history_room").using("btree", table.roomId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "room_history_room_id_rooms_id_fk"
		}).onDelete("cascade"),
]);

export const roomParticipants = pgTable("room_participants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	userId: uuid("user_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	leftAt: timestamp("left_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true),
	finalPickMovieId: integer("final_pick_movie_id"),
}, (table) => [
	index("idx_room_participants_active").using("btree", table.roomId.asc().nullsLast().op("uuid_ops")).where(sql`(is_active = true)`),
	index("idx_room_participants_room").using("btree", table.roomId.asc().nullsLast().op("uuid_ops")),
	index("idx_room_participants_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "room_participants_room_id_rooms_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "room_participants_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("room_participants_room_id_user_id_unique").on(table.roomId, table.userId),
]);

export const userMovieElo = pgTable("user_movie_elo", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	movieId: integer("movie_id").notNull(),
	eloRating: integer("elo_rating").default(1200),
	matchesPlayed: integer("matches_played").default(0),
	wins: integer().default(0),
	losses: integer().default(0),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_movie_elo_rating").using("btree", table.eloRating.asc().nullsLast().op("int4_ops")),
	index("idx_user_movie_elo_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_movie_elo_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_movie_elo_user_id_movie_id_unique").on(table.userId, table.movieId),
]);
