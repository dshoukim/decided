import { pgTable, text, uuid, timestamp, serial, integer, boolean, jsonb, check, uniqueIndex, index, varchar, unique, numeric } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  dateOfBirth: text('date_of_birth'),
  gender: text('gender'),
  avatarUrl: text('avatar_url'),
  streamingServices: text('streaming_services').array(),
  selectedGenres: text('selected_genres').array(),
  selectedCharacteristics: text('selected_characteristics').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

// Movie ratings table
export const movieRatings = pgTable('movie_ratings', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tmdbMovieId: integer('tmdb_movie_id').notNull(),
  movieTitle: text('movie_title').notNull(),
  ratingType: text('rating_type').notNull(),
  starRating: integer('star_rating'), // 1-5 star rating
  movieData: jsonb('movie_data'),
  userNote: text('user_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    ratingTypeCheck: check('rating_type_check', sql`${table.ratingType} IN ('like', 'dislike', 'love', 'not_seen', 'star')`),
    starRatingCheck: check('star_rating_check', sql`${table.starRating} IS NULL OR (${table.starRating} >= 1 AND ${table.starRating} <= 5)`),
    userMovieUnique: uniqueIndex('idx_movie_ratings_user_movie').on(table.userId, table.tmdbMovieId),
    userIdIdx: index('idx_movie_ratings_user_id').on(table.userId),
    tmdbIdIdx: index('idx_movie_ratings_tmdb_id').on(table.tmdbMovieId),
    ratingTypeIdx: index('idx_movie_ratings_rating_type').on(table.ratingType),
    starRatingIdx: index('idx_movie_ratings_star_rating').on(table.starRating)
  }
})

// Watch list table
export const watchList = pgTable('watch_list', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tmdbMovieId: integer('tmdb_movie_id').notNull(),
  movieTitle: text('movie_title').notNull(),
  movieData: jsonb('movie_data'),
  userNote: text('user_note'),
  addedFrom: text('added_from').notNull(),
  isWatched: boolean('is_watched').default(false),
  watchedAt: timestamp('watched_at', { withTimezone: true }),

  // Consolidation fields
  rating: integer('rating'),
  liked: boolean('liked'),
  review: text('review'),
  
  // Decided fields
  decidedTogetherRoomId: uuid('decided_together_room_id').references(() => rooms.id),
  pendingRating: boolean('pending_rating').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    addedFromCheck: check('added_from_check', sql`${table.addedFrom} IN ('survey', 'search', 'manual', 'decided_together', 'explore')`),
    userMovieUnique: uniqueIndex('idx_watch_list_user_movie').on(table.userId, table.tmdbMovieId),
    userIdIdx: index('idx_watch_list_user_id').on(table.userId),
    tmdbIdIdx: index('idx_watch_list_tmdb_id').on(table.tmdbMovieId),
    addedFromIdx: index('idx_watch_list_added_from').on(table.addedFrom),
    isWatchedIdx: index('idx_watch_list_is_watched').on(table.isWatched),
    ratingIdx: index('idx_watch_list_rating').on(table.rating),
    pendingRatingIdx: index('idx_watch_list_pending_rating').on(table.pendingRating),
    decidedTogetherIdx: index('idx_watch_list_decided_together').on(table.decidedTogetherRoomId),
  }
})

// Streaming services table
export const streamingServices = pgTable('streaming_services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  description: text('description'),
  monthlyPrice: numeric('monthly_price', { precision: 10, scale: 2 }), // Keep as decimal like in database
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

// Genres table
export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  tmdbId: integer('tmdb_id'),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  isActive: boolean('is_active').default(true)
})

// Genre characteristics table
export const genreCharacteristics = pgTable('genre_characteristics', {
  id: serial('id').primaryKey(),
  genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    genreIdIdx: index('idx_genre_characteristics_genre_id').on(table.genreId)
  }
})

// Films table - comprehensive movie database
export const films = pgTable('films', {
  // Primary identifiers
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  imdbId: varchar('imdb_id', { length: 15 }), // e.g., "tt0111161"
  
  // Core movie information
  title: varchar('title', { length: 500 }).notNull(),
  originalTitle: varchar('original_title', { length: 500 }),
  overview: text('overview'),
  tagline: text('tagline'),
  
  // Release and status
  releaseDate: text('release_date'), // Using text for date as it matches existing pattern
  status: varchar('status', { length: 50 }), // 'Released', 'In Production', 'Post Production', etc.
  runtime: integer('runtime'), // minutes
  
  // Ratings and popularity
  voteAverage: integer('vote_average'), // Store as integer * 10 (e.g., 7.5 = 75)
  voteCount: integer('vote_count'),
  popularity: integer('popularity'), // Store as integer * 1000 for precision
  
  // Content classification
  adult: boolean('adult').default(false),
  originalLanguage: varchar('original_language', { length: 5 }), // ISO 639-1 codes
  spokenLanguages: text('spoken_languages').array(), // Array of language codes
  
  // Media assets
  posterPath: varchar('poster_path', { length: 255 }),
  backdropPath: varchar('backdrop_path', { length: 255 }),
  trailerLink: varchar('trailer_link', { length: 500 }),
  
  // Financial data
  budget: integer('budget'), // In USD
  revenue: integer('revenue'), // In USD
  
  // Classification and metadata
  genres: text('genres').array(), // Array of genre names
  productionCompanies: text('production_companies').array(),
  productionCountries: text('production_countries').array(),
  keywords: text('keywords').array(),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }), // When last synced from TMDB
}, (table) => ({
  tmdbIdIdx: index('idx_films_tmdb_id').on(table.tmdbId),
  imdbIdIdx: index('idx_films_imdb_id').on(table.imdbId),
  titleIdx: index('idx_films_title').on(table.title),
  releaseDateIdx: index('idx_films_release_date').on(table.releaseDate),
  statusIdx: index('idx_films_status').on(table.status),
  voteAverageIdx: index('idx_films_vote_average').on(table.voteAverage),
  popularityIdx: index('idx_films_popularity').on(table.popularity),
  genresIdx: index('idx_films_genres').on(table.genres),
  languageIdx: index('idx_films_language').on(table.originalLanguage),
  adultIdx: index('idx_films_adult').on(table.adult),
}));

// Type exports for easier use
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type MovieRating = typeof movieRatings.$inferSelect
export type NewMovieRating = typeof movieRatings.$inferInsert
export type WatchListItem = typeof watchList.$inferSelect
export type NewWatchListItem = typeof watchList.$inferInsert
export type StreamingService = typeof streamingServices.$inferSelect
export type Genre = typeof genres.$inferSelect
export type GenreCharacteristic = typeof genreCharacteristics.$inferSelect
export type Film = typeof films.$inferSelect
export type NewFilm = typeof films.$inferInsert

// Decided Schemas
export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  code: varchar('code', { length: 6 }).notNull().unique(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('waiting'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  winnerMovieId: integer('winner_movie_id'),
  winnerTitle: varchar('winner_title'),
  winnerPosterPath: varchar('winner_poster_path'),
  tournamentData: jsonb('tournament_data'),
}, (table) => ({
  codeIdx: index('idx_rooms_code').on(table.code),
  statusIdx: index('idx_rooms_status').on(table.status),
  ownerIdx: index('idx_rooms_owner').on(table.ownerId),
  createdAtIdx: index('idx_rooms_created_at').on(table.createdAt),
}));

export const roomParticipants = pgTable('room_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  finalPickMovieId: integer('final_pick_movie_id'),
  completedMatches: text('completed_matches').array().default(sql`'{}'::text[]`),
  currentMatchIndex: integer('current_match_index').default(0),
  lastActionAt: timestamp('last_action_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  roomUserUnique: unique().on(table.roomId, table.userId),
  roomIdx: index('idx_room_participants_room').on(table.roomId),
  userIdx: index('idx_room_participants_user').on(table.userId),
  activeIdx: index('idx_room_participants_active').on(table.roomId).where(sql`${table.isActive} = true`),
}));

export const bracketPicks = pgTable('bracket_picks', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  matchId: varchar('match_id', { length: 50 }).notNull(),
  movieAId: integer('movie_a_id').notNull(),
  movieBId: integer('movie_b_id').notNull(),
  selectedMovieId: integer('selected_movie_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  responseTimeMs: integer('response_time_ms'),
}, (table) => ({
  roomUserMatchUnique: unique().on(table.roomId, table.userId, table.matchId),
  roomUserIdx: index('idx_bracket_picks_room_user').on(table.roomId, table.userId),
  responseTimeIdx: index('idx_bracket_picks_response_time').on(table.responseTimeMs),
}));

export const userMovieElo = pgTable('user_movie_elo', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  movieId: integer('movie_id').notNull(),
  eloRating: integer('elo_rating').default(1200),
  matchesPlayed: integer('matches_played').default(0),
  wins: integer('wins').default(0),
  losses: integer('losses').default(0),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userMovieUnique: unique().on(table.userId, table.movieId),
  userIdx: index('idx_user_movie_elo_user').on(table.userId),
  ratingIdx: index('idx_user_movie_elo_rating').on(table.eloRating),
}));

export const roomHistory = pgTable('room_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventData: jsonb('event_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  roomIdx: index('idx_room_history_room').on(table.roomId),
  eventTypeIdx: index('idx_room_history_event_type').on(table.eventType),
}));

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type RoomParticipant = typeof roomParticipants.$inferSelect;
export type NewRoomParticipant = typeof roomParticipants.$inferInsert;
export type BracketPick = typeof bracketPicks.$inferSelect;
export type NewBracketPick = typeof bracketPicks.$inferInsert;
export type UserMovieElo = typeof userMovieElo.$inferSelect;
export type NewUserMovieElo = typeof userMovieElo.$inferInsert;
export type RoomHistory = typeof roomHistory.$inferSelect;
export type NewRoomHistory = typeof roomHistory.$inferInsert;

// Decided V2 Tables
export const roomStates = pgTable('room_states', {
  roomId: uuid('room_id').primaryKey().references(() => rooms.id, { onDelete: 'cascade' }),
  stateVersion: integer('state_version').notNull().default(1),
  currentState: jsonb('current_state').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
}, (table) => ({
  versionIdx: index('idx_room_states_version').on(table.roomId, table.stateVersion),
}));

export const matchCompletions = pgTable('match_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  matchId: varchar('match_id', { length: 50 }).notNull(),
  roundNumber: integer('round_number').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow(),
  nextMatchId: varchar('next_match_id', { length: 50 }),
}, (table) => ({
  roomMatchUnique: unique().on(table.roomId, table.matchId),
  roomIdx: index('idx_match_completions_room').on(table.roomId),
  matchIdx: index('idx_match_completions_match').on(table.matchId),
}));

export const userActions = pgTable('user_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  actionPayload: jsonb('action_payload'),
  idempotencyKey: varchar('idempotency_key', { length: 100 }),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow(),
  result: varchar('result', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
}, (table) => ({
  resultCheck: check('result_check', sql`${table.result} IN ('success', 'error', 'ignored')`),
  roomUserIdx: index('idx_user_actions_room_user').on(table.roomId, table.userId),
  idempotencyIdx: index('idx_user_actions_idempotency').on(table.idempotencyKey),
  processedAtIdx: index('idx_user_actions_processed_at').on(table.processedAt),
}));

export type RoomState = typeof roomStates.$inferSelect;
export type NewRoomState = typeof roomStates.$inferInsert;
export type MatchCompletion = typeof matchCompletions.$inferSelect;
export type NewMatchCompletion = typeof matchCompletions.$inferInsert;
export type UserAction = typeof userActions.$inferSelect;
export type NewUserAction = typeof userActions.$inferInsert;

// Tournament State - New unified tournament system
export const tournamentState = pgTable('tournament_state', {
  roomId: uuid('room_id').primaryKey().references(() => rooms.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull(),
  currentRound: integer('current_round').notNull().default(1),
  totalRounds: integer('total_rounds').notNull(),
  currentMatches: jsonb('current_matches').notNull().default('[]'),
  completedPicks: jsonb('completed_picks').notNull().default('[]'),
  allMovies: jsonb('all_movies').notNull().default('[]'),
  winnerMovieId: integer('winner_movie_id'),
  winnerTitle: text('winner_title'),
  winnerPosterPath: text('winner_poster_path'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  statusIdx: index('idx_tournament_state_status').on(table.status),
  roomIdIdx: index('idx_tournament_state_room_id').on(table.roomId),
  statusCheck: check('tournament_state_status_check', 
    sql`${table.status} IN ('generating', 'round_1', 'round_2', 'round_3', 'final', 'completed')`)
}));

export type TournamentState = typeof tournamentState.$inferSelect;
export type NewTournamentState = typeof tournamentState.$inferInsert; 