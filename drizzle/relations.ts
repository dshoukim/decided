import { relations } from "drizzle-orm/relations";
import { rooms, bracketPicks, users, userActions, matchCompletions, roomStates, roomHistory, userMovieElo, roomParticipants, watchList } from "./schema";

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

export const roomsRelations = relations(rooms, ({one, many}) => ({
	bracketPicks: many(bracketPicks),
	userActions: many(userActions),
	matchCompletions: many(matchCompletions),
	roomStates: many(roomStates),
	roomHistories: many(roomHistory),
	user: one(users, {
		fields: [rooms.ownerId],
		references: [users.id]
	}),
	roomParticipants: many(roomParticipants),
	watchLists: many(watchList),
}));

export const usersRelations = relations(users, ({many}) => ({
	bracketPicks: many(bracketPicks),
	userActions: many(userActions),
	roomStates: many(roomStates),
	rooms: many(rooms),
	userMovieElos: many(userMovieElo),
	roomParticipants: many(roomParticipants),
}));

export const userActionsRelations = relations(userActions, ({one}) => ({
	room: one(rooms, {
		fields: [userActions.roomId],
		references: [rooms.id]
	}),
	user: one(users, {
		fields: [userActions.userId],
		references: [users.id]
	}),
}));

export const matchCompletionsRelations = relations(matchCompletions, ({one}) => ({
	room: one(rooms, {
		fields: [matchCompletions.roomId],
		references: [rooms.id]
	}),
}));

export const roomStatesRelations = relations(roomStates, ({one}) => ({
	room: one(rooms, {
		fields: [roomStates.roomId],
		references: [rooms.id]
	}),
	user: one(users, {
		fields: [roomStates.updatedBy],
		references: [users.id]
	}),
}));

export const roomHistoryRelations = relations(roomHistory, ({one}) => ({
	room: one(rooms, {
		fields: [roomHistory.roomId],
		references: [rooms.id]
	}),
}));

export const userMovieEloRelations = relations(userMovieElo, ({one}) => ({
	user: one(users, {
		fields: [userMovieElo.userId],
		references: [users.id]
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

export const watchListRelations = relations(watchList, ({one}) => ({
	room: one(rooms, {
		fields: [watchList.decidedTogetherRoomId],
		references: [rooms.id]
	}),
}));