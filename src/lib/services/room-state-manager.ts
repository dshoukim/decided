import { db } from '@/db';
import { rooms, roomStates, roomParticipants, users, RoomState as DBRoomState } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { EventEmitter } from 'events';

// Types
export type ScreenType = 'lobby' | 'bracket' | 'waiting' | 'final' | 'winner' | 'error';

export interface Movie {
  id: number;
  title: string;
  posterPath?: string;
  releaseDate?: string;
  voteAverage?: number;
}

export interface Participant {
  userId: string;
  name: string;
  avatarUrl?: string;
  isActive: boolean;
  isReady: boolean;
  isOwner?: boolean;
}

export interface TournamentMatch {
  matchId: string;
  movieA: Movie;
  movieB: Movie;
}

export interface RoomState {
  version: number;
  screen: ScreenType;
  
  data: {
    room: {
      code: string;
      timeRemaining?: number;
      participants: Participant[];
    };
    
    tournament?: {
      currentMatch?: TournamentMatch;
      matches?: TournamentMatch[];
      progress: {
        userPicks: number;
        totalPicks: number;
        currentRound: number;
        totalRounds: number;
      };
      partnerProgress?: {
        picks: number;
        total: number;
      };
    };
    
    winner?: {
      movie: Movie;
      addedToWatchlists: boolean;
    };
  };
  
  availableActions: string[];
  error?: string;
  lastUpdated: string;
}

export class RoomStateManager extends EventEmitter {
  private static instance: RoomStateManager;
  private stateCache: Map<string, RoomState> = new Map();
  private subscribers: Map<string, Set<(state: RoomState) => void>> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): RoomStateManager {
    if (!RoomStateManager.instance) {
      RoomStateManager.instance = new RoomStateManager();
    }
    return RoomStateManager.instance;
  }

  async getState(roomId: string, userId: string): Promise<RoomState> {
    try {
      // Try cache first
      const cached = this.stateCache.get(roomId);
      if (cached) {
        return await this.personalizeState(cached, userId, roomId);
      }

      // Load from database
      const state = await this.loadFromDB(roomId);
      this.stateCache.set(roomId, state);
      
      return await this.personalizeState(state, userId, roomId);
    } catch (error) {
      console.error('Error getting room state:', error);
      throw error;
    }
  }

  async saveState(roomId: string, state: RoomState, updatedBy: string): Promise<void> {
    try {
      console.log(`[SAVE_STATE] Saving state for room ${roomId}, screen: ${state.screen}`);
      
      // Increment version
      state.version += 1;
      state.lastUpdated = new Date().toISOString();

      // Save to database
      await db
        .insert(roomStates)
        .values({
          roomId,
          stateVersion: state.version,
          currentState: state as any,
          updatedBy,
        })
        .onConflictDoUpdate({
          target: roomStates.roomId,
          set: {
            stateVersion: state.version,
            currentState: state as any,
            updatedAt: new Date(),
            updatedBy,
          },
        });

      // Update cache
      this.stateCache.set(roomId, state);
      console.log(`[SAVE_STATE] State saved to DB and cache`);

      // Broadcast to subscribers
      this.broadcast(roomId, state);
      console.log(`[SAVE_STATE] State broadcast to subscribers`);
    } catch (error) {
      console.error('Error saving room state:', error);
      throw error;
    }
  }

  async loadFromDB(roomId: string): Promise<RoomState> {
    try {
      // Get room state
      const dbState = await db.query.roomStates.findFirst({
        where: eq(roomStates.roomId, roomId),
      });

      if (dbState?.currentState) {
        return dbState.currentState as RoomState;
      }

      // If no state exists, create initial state
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
        with: {
          participants: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!room) {
        throw new Error('Room not found');
      }

      // Create initial state
      const initialState: RoomState = {
        version: 0,
        screen: 'lobby',
        data: {
          room: {
            code: room.code,
            participants: room.participants.map(p => ({
              userId: p.userId,
              name: p.user.name || p.user.username,
              avatarUrl: p.user.avatarUrl || undefined,
              isActive: p.isActive ?? false,
              isReady: false,
              isOwner: p.userId === room.ownerId,
            })),
          },
        },
        availableActions: [],
        lastUpdated: new Date().toISOString(),
      };

      // Check if room has active tournament data
      if (room.status === 'active' && room.tournamentData) {
        console.log(`[LOAD_FROM_DB] Found active tournament data for room ${roomId}`);
        const tournament = room.tournamentData as any;
        
        // Transform tournament data into room state format
        const round1Matches = tournament.matches.filter((m: any) => m.roundNumber === 1);
        
        initialState.screen = 'bracket';
        initialState.data.tournament = {
          currentMatch: round1Matches[0] ? {
            matchId: round1Matches[0].matchId,
            movieA: {
              id: round1Matches[0].movieA.id,
              title: round1Matches[0].movieA.title,
              posterPath: round1Matches[0].movieA.posterPath,
            },
            movieB: {
              id: round1Matches[0].movieB.id,
              title: round1Matches[0].movieB.title,
              posterPath: round1Matches[0].movieB.posterPath,
            },
          } : undefined,
          matches: round1Matches.map((m: any) => ({
            matchId: m.matchId,
            movieA: {
              id: m.movieA.id,
              title: m.movieA.title,
              posterPath: m.movieA.posterPath,
            },
            movieB: {
              id: m.movieB.id,
              title: m.movieB.title,
              posterPath: m.movieB.posterPath,
            },
          })),
          progress: {
            userPicks: 0,
            totalPicks: round1Matches.length,
            currentRound: tournament.currentRound || 1,
            totalRounds: tournament.totalRounds,
          },
        };
        
        console.log(`[LOAD_FROM_DB] Set up tournament state with ${round1Matches.length} matches`);
      } else {
        // Determine available actions based on room status for waiting rooms
        if (room.status === 'waiting') {
          const activeParticipants = room.participants.filter(p => p.isActive);
          if (activeParticipants.length === 2) {
            initialState.availableActions.push('start');
          }
        }
      }

      return initialState;
    } catch (error) {
      console.error('Error loading room state from DB:', error);
      throw error;
    }
  }

  async personalizeState(state: RoomState, userId: string, roomId?: string): Promise<RoomState> {
    // Deep clone the state
    const personalized = JSON.parse(JSON.stringify(state)) as RoomState;

    // Determine available actions for this user
    personalized.availableActions = this.getAvailableActions(state, userId);

    // Personalize tournament data if active
    if (state.data.tournament && state.screen === 'bracket' && roomId) {
      await this.personalizeTournamentData(personalized, userId, roomId);
    }

    // Add partner progress if in tournament
    if (state.data.tournament && state.screen === 'waiting') {
      const participants = state.data.room.participants;
      const partner = participants.find(p => p.userId !== userId && p.isActive);
      
      if (partner && personalized.data.tournament) {
        // This would be calculated from actual pick data
        personalized.data.tournament.partnerProgress = {
          picks: 0, // TODO: Get from bracket_picks
          total: state.data.tournament.progress.totalPicks,
        };
      }
    }

    return personalized;
  }

  private async personalizeTournamentData(state: RoomState, userId: string, roomId: string): Promise<void> {
    try {
      console.log(`[PERSONALIZE] Starting personalization for user ${userId} in room ${roomId}`);
      
      // Get user's completed matches
      const participant = await db.query.roomParticipants.findFirst({
        where: and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, userId)
        ),
      });

      if (!participant || !state.data.tournament?.matches) {
        console.log(`[PERSONALIZE] No participant or matches found`);
        return; // No personalization needed
      }

      const completedMatches = participant.completedMatches || [];
      const currentRound = state.data.tournament.progress.currentRound;
      
      console.log(`[PERSONALIZE] User completed matches:`, completedMatches);
      console.log(`[PERSONALIZE] Current round:`, currentRound);

      // Find current round matches - handle both old and new match ID formats
      const currentRoundMatches = state.data.tournament.matches.filter((m: any) => 
        m.matchId.startsWith(`r${currentRound}`) || m.matchId.startsWith(`round-${currentRound}`)
      );
      console.log(`[PERSONALIZE] Current round has ${currentRoundMatches.length} matches`);

      // Find first match not completed by user
      let nextMatch = null;
      for (const match of currentRoundMatches) {
        if (!completedMatches.includes(match.matchId)) {
          nextMatch = match;
          break;
        }
      }

      if (nextMatch) {
        // User has a match to play
        console.log(`[PERSONALIZE] User's next match: ${nextMatch.matchId}`);
        state.data.tournament.currentMatch = nextMatch;
      } else {
        // User has completed all matches in current round
        const allMatchesInRound = currentRoundMatches.length;
        const userCompletedInRound = currentRoundMatches.filter((m: any) => 
          completedMatches.includes(m.matchId)
        ).length;

        console.log(`[PERSONALIZE] User completed ${userCompletedInRound} of ${allMatchesInRound} matches in round`);

        if (userCompletedInRound === allMatchesInRound) {
          // User truly completed all their matches for this round
          console.log(`[PERSONALIZE] User completed all matches, setting screen to waiting`);
          state.screen = 'waiting';
          state.data.tournament.currentMatch = undefined;
        }
      }
    } catch (error) {
      console.error('Error personalizing tournament data:', error);
      // Fall back to existing current match if any
    }
  }

  private getAvailableActions(state: RoomState, userId: string): string[] {
    const actions: string[] = [];
    const participant = state.data.room.participants.find(p => p.userId === userId);
    
    if (!participant?.isActive) {
      return [];
    }

    switch (state.screen) {
      case 'lobby':
        actions.push('leave');
        if (participant.isOwner && state.data.room.participants.filter(p => p.isActive).length === 2) {
          actions.push('start');
        }
        break;
        
      case 'bracket':
        if (state.data.tournament?.currentMatch) {
          actions.push('pick');
        }
        actions.push('leave');
        break;
        
      case 'waiting':
        actions.push('leave');
        break;
        
      case 'final':
        if (state.data.tournament?.currentMatch) {
          actions.push('pick');
        }
        actions.push('leave');
        break;
        
      case 'winner':
        // No actions available
        break;
    }

    // Always allow extend action to keep room alive
    if (state.screen !== 'winner' && state.screen !== 'error') {
      actions.push('extend');
    }

    return actions;
  }

  subscribe(roomId: string, callback: (state: RoomState) => void): () => void {
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Set());
    }
    
    this.subscribers.get(roomId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(roomId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(roomId);
        }
      }
    };
  }

  private broadcast(roomId: string, state: RoomState): void {
    const subs = this.subscribers.get(roomId);
    console.log(`[BROADCAST] Broadcasting to room ${roomId}, subscribers: ${subs?.size || 0}`);
    
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('Error in state subscriber:', error);
        }
      });
    }

    // Emit event for other services
    this.emit('stateUpdate', { roomId, state });
  }

  clearCache(roomId: string): void {
    this.stateCache.delete(roomId);
  }

  clearAllCache(): void {
    this.stateCache.clear();
  }

  async rebuildFromParticipants(roomId: string): Promise<RoomState> {
    try {
      // Always rebuild state from current participants, ignoring cached state
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
        with: {
          participants: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!room) {
        throw new Error('Room not found');
      }

      // Determine screen based on room status
      let screen: ScreenType = 'lobby';
      if (room.status === 'active') {
        screen = 'bracket'; // Tournament is active
      } else if (room.status === 'completed') {
        screen = 'winner'; // Tournament completed
      } else if (room.status === 'abandoned') {
        screen = 'error'; // Room abandoned
      }

      // Create fresh state from current participants
      const freshState: RoomState = {
        version: 0, // Will be incremented when saved
        screen,
        data: {
          room: {
            code: room.code,
            participants: room.participants.map(p => ({
              userId: p.userId,
              name: p.user.name || p.user.username,
              avatarUrl: p.user.avatarUrl || undefined,
              isActive: p.isActive ?? false,
              isReady: false,
              isOwner: p.userId === room.ownerId,
            })),
          },
        },
        availableActions: [],
        lastUpdated: new Date().toISOString(),
      };

      // Add error message if room was abandoned
      if (room.status === 'abandoned') {
        freshState.error = 'Tournament abandoned';
      }

      // Determine available actions based on room status
      if (room.status === 'waiting') {
        const activeParticipants = room.participants.filter(p => p.isActive);
        if (activeParticipants.length === 2) {
          freshState.availableActions.push('start');
        }
      }

      return freshState;
    } catch (error) {
      console.error('Error rebuilding state from participants:', error);
      throw error;
    }
  }
} 