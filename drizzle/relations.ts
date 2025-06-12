import { relations } from "drizzle-orm/relations";
import { genres, genreCharacteristics, usersInAuth, users, movieRatings, userGenres, watchParties, partyParticipants, partyQueue, partyVotes, rooms, watchList, bracketPicks, roomHistory, roomParticipants, userMovieElo } from "./schema";

export const genreCharacteristicsRelations = relations(genreCharacteristics, ({one}) => ({
	genre: one(genres, {
		fields: [genreCharacteristics.genreId],
		references: [genres.id]
	}),
}));

export const genresRelations = relations(genres, ({many}) => ({
	genreCharacteristics: many(genreCharacteristics),
	userGenres: many(userGenres),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [users.id],
		references: [usersInAuth.id]
	}),
	rooms: many(rooms),
	bracketPicks: many(bracketPicks),
	roomParticipants: many(roomParticipants),
	userMovieElos: many(userMovieElo),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	users: many(users),
	movieRatings: many(movieRatings),
	watchLists: many(watchList),
}));

export const movieRatingsRelations = relations(movieRatings, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [movieRatings.userId],
		references: [usersInAuth.id]
	}),
}));

export const userGenresRelations = relations(userGenres, ({one}) => ({
	genre: one(genres, {
		fields: [userGenres.genreId],
		references: [genres.id]
	}),
}));

export const partyParticipantsRelations = relations(partyParticipants, ({one}) => ({
	watchParty: one(watchParties, {
		fields: [partyParticipants.partyId],
		references: [watchParties.id]
	}),
}));

export const watchPartiesRelations = relations(watchParties, ({many}) => ({
	partyParticipants: many(partyParticipants),
	partyQueues: many(partyQueue),
	partyVotes: many(partyVotes),
}));

export const partyQueueRelations = relations(partyQueue, ({one}) => ({
	watchParty: one(watchParties, {
		fields: [partyQueue.partyId],
		references: [watchParties.id]
	}),
}));

export const partyVotesRelations = relations(partyVotes, ({one}) => ({
	watchParty: one(watchParties, {
		fields: [partyVotes.partyId],
		references: [watchParties.id]
	}),
}));

export const watchListRelations = relations(watchList, ({one}) => ({
	room: one(rooms, {
		fields: [watchList.decidedTogetherRoomId],
		references: [rooms.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [watchList.userId],
		references: [usersInAuth.id]
	}),
}));

export const roomsRelations = relations(rooms, ({one, many}) => ({
	watchLists: many(watchList),
	user: one(users, {
		fields: [rooms.ownerId],
		references: [users.id]
	}),
	bracketPicks: many(bracketPicks),
	roomHistories: many(roomHistory),
	roomParticipants: many(roomParticipants),
}));

export const bracketPicksRelations = relations(bracketPicks, ({one}) => ({
	room: one(rooms, {
		fields: [bracketPicks.roomId],
		references: [rooms.id]
	}),
	user: one(users, {
		fields: [bracketPicks.userId],
		references: [users.id]
	}),
}));

export const roomHistoryRelations = relations(roomHistory, ({one}) => ({
	room: one(rooms, {
		fields: [roomHistory.roomId],
		references: [rooms.id]
	}),
}));

export const roomParticipantsRelations = relations(roomParticipants, ({one}) => ({
	room: one(rooms, {
		fields: [roomParticipants.roomId],
		references: [rooms.id]
	}),
	user: one(users, {
		fields: [roomParticipants.userId],
		references: [users.id]
	}),
}));

export const userMovieEloRelations = relations(userMovieElo, ({one}) => ({
	user: one(users, {
		fields: [userMovieElo.userId],
		references: [users.id]
	}),
}));