import { relations } from 'drizzle-orm'
import { 
  users, 
  rooms, 
  roomParticipants, 
  bracketPicks, 
  watchList,
  movieRatings,
  genres,
  genreCharacteristics,
  streamingServices,
  userMovieElo,
  roomHistory
} from './schema'

// Users relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedRooms: many(rooms),
  roomParticipations: many(roomParticipants),
  watchList: many(watchList),
  movieRatings: many(movieRatings),
  bracketPicks: many(bracketPicks),
  movieElos: many(userMovieElo),
}))

// Rooms relations
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  owner: one(users, {
    fields: [rooms.ownerId],
    references: [users.id],
  }),
  participants: many(roomParticipants),
  bracketPicks: many(bracketPicks),
  history: many(roomHistory),
  watchListItems: many(watchList),
}))

// Room participants relations
export const roomParticipantsRelations = relations(roomParticipants, ({ one }) => ({
  room: one(rooms, {
    fields: [roomParticipants.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [roomParticipants.userId],
    references: [users.id],
  }),
}))

// Bracket picks relations
export const bracketPicksRelations = relations(bracketPicks, ({ one }) => ({
  room: one(rooms, {
    fields: [bracketPicks.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [bracketPicks.userId],
    references: [users.id],
  }),
}))

// Watch list relations
export const watchListRelations = relations(watchList, ({ one }) => ({
  user: one(users, {
    fields: [watchList.userId],
    references: [users.id],
  }),
  decidedTogetherRoom: one(rooms, {
    fields: [watchList.decidedTogetherRoomId],
    references: [rooms.id],
  }),
}))

// Movie ratings relations
export const movieRatingsRelations = relations(movieRatings, ({ one }) => ({
  user: one(users, {
    fields: [movieRatings.userId],
    references: [users.id],
  }),
}))

// Genre characteristics relations
export const genreCharacteristicsRelations = relations(genreCharacteristics, ({ one }) => ({
  genre: one(genres, {
    fields: [genreCharacteristics.genreId],
    references: [genres.id],
  }),
}))

// Genres relations
export const genresRelations = relations(genres, ({ many }) => ({
  characteristics: many(genreCharacteristics),
}))

// User movie ELO relations
export const userMovieEloRelations = relations(userMovieElo, ({ one }) => ({
  user: one(users, {
    fields: [userMovieElo.userId],
    references: [users.id],
  }),
}))

// Room history relations
export const roomHistoryRelations = relations(roomHistory, ({ one }) => ({
  room: one(rooms, {
    fields: [roomHistory.roomId],
    references: [rooms.id],
  }),
})) 