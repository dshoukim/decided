import { db } from '@/db';
import { userActions, roomParticipants, bracketPicks, rooms, matchCompletions, watchList } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { RoomStateManager, RoomState, ScreenType } from './room-state-manager';
import { TournamentEngine, TournamentMovie, TournamentMatch } from '../tournament-engine';
import { v4 as uuidv4 } from 'uuid';

export interface Action {
  action: 'start' | 'pick' | 'leave' | 'extend';
  payload?: any;
  idempotencyKey?: string;
}

export interface ActionResult {
  success: boolean;
  state?: RoomState;
  error?: string;
}

interface RoomLock {
  roomId: string;
  acquiredAt: Date;
  timeout: NodeJS.Timeout;
}

export class ActionProcessor {
  private static instance: ActionProcessor;
  private roomLocks: Map<string, RoomLock> = new Map();
  private readonly LOCK_TIMEOUT = 5000; // 5 seconds
  private readonly IDEMPOTENCY_WINDOW = 5 * 60 * 1000; // 5 minutes

  private constructor(
    private stateManager: RoomStateManager
  ) {}

  static getInstance(): ActionProcessor {
    if (!ActionProcessor.instance) {
      ActionProcessor.instance = new ActionProcessor(
        RoomStateManager.getInstance()
      );
    }
    return ActionProcessor.instance;
  }

  async process(roomId: string, userId: string, action: Action): Promise<ActionResult> {
    // Check idempotency
    if (action.idempotencyKey) {
      const existing = await this.checkIdempotency(action.idempotencyKey);
      if (existing) {
        const state = await this.stateManager.getState(roomId, userId);
        return { success: true, state };
      }
    }

    // Acquire lock
    await this.acquireLock(roomId);

    try {
      // Log action
      const actionId = await this.logAction(roomId, userId, action, 'processing');

      // Load current state
      const currentState = await this.stateManager.getState(roomId, userId);

      // Validate action
      const validation = this.validateAction(currentState, userId, action);
      if (!validation.valid) {
        await this.updateActionResult(actionId, 'error', validation.error);
        return { success: false, error: validation.error };
      }

      // Apply action
      let newState: RoomState;
      try {
        newState = await this.applyAction(roomId, userId, currentState, action);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.updateActionResult(actionId, 'error', errorMessage);
        throw error;
      }

      // Save state
      await this.stateManager.saveState(roomId, newState, userId);

      // Update action result
      await this.updateActionResult(actionId, 'success');

      return { success: true, state: newState };

    } finally {
      // Release lock
      this.releaseLock(roomId);
    }
  }

  private async acquireLock(roomId: string): Promise<void> {
    const maxAttempts = 10;
    const retryDelay = 100; // 100ms

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!this.roomLocks.has(roomId)) {
        // Create lock with timeout
        const timeout = setTimeout(() => {
          console.error(`Lock timeout for room ${roomId}`);
          this.releaseLock(roomId);
        }, this.LOCK_TIMEOUT);

        this.roomLocks.set(roomId, {
          roomId,
          acquiredAt: new Date(),
          timeout,
        });
        return;
      }

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error('Failed to acquire room lock');
  }

  private releaseLock(roomId: string): void {
    const lock = this.roomLocks.get(roomId);
    if (lock) {
      clearTimeout(lock.timeout);
      this.roomLocks.delete(roomId);
    }
  }

  private async checkIdempotency(idempotencyKey: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - this.IDEMPOTENCY_WINDOW);
    
    const existing = await db.query.userActions.findFirst({
      where: and(
        eq(userActions.idempotencyKey, idempotencyKey),
        eq(userActions.result, 'success')
      ),
    });

    return !!existing && new Date(existing.processedAt!) > cutoff;
  }

  private async logAction(
    roomId: string,
    userId: string,
    action: Action,
    result: 'processing' | 'success' | 'error' | 'ignored' = 'processing',
    errorMessage?: string
  ): Promise<string> {
    const id = uuidv4();
    
    await db.insert(userActions).values({
      id,
      roomId,
      userId,
      actionType: action.action,
      actionPayload: action.payload,
      idempotencyKey: action.idempotencyKey,
      result: result === 'processing' ? 'success' : result, // DB doesn't have 'processing'
      errorMessage,
    });

    return id;
  }

  private async updateActionResult(
    actionId: string,
    result: 'success' | 'error' | 'ignored',
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(userActions)
      .set({
        result,
        errorMessage,
        processedAt: new Date(),
      })
      .where(eq(userActions.id, actionId));
  }

  private validateAction(
    state: RoomState,
    userId: string,
    action: Action
  ): { valid: boolean; error?: string } {
    // Check if action is available
    if (!state.availableActions.includes(action.action)) {
      return { valid: false, error: 'Action not available in current state' };
    }

    // Validate specific actions
    switch (action.action) {
      case 'start':
        const participant = state.data.room.participants.find(p => p.userId === userId);
        if (!participant?.isOwner) {
          return { valid: false, error: 'Only room owner can start tournament' };
        }
        if (state.data.room.participants.filter(p => p.isActive).length !== 2) {
          return { valid: false, error: 'Need exactly 2 participants to start' };
        }
        break;

      case 'pick':
        if (!action.payload?.matchId || !action.payload?.selectedMovieId) {
          return { valid: false, error: 'Missing pick data' };
        }
        if (!state.data.tournament?.currentMatch) {
          return { valid: false, error: 'No current match to pick from' };
        }
        if (state.data.tournament.currentMatch.matchId !== action.payload.matchId) {
          return { valid: false, error: 'Match ID mismatch' };
        }
        break;

      case 'leave':
        // Always valid if user is active participant
        break;

      case 'extend':
        // Always valid
        break;
    }

    return { valid: true };
  }

  private async applyAction(
    roomId: string,
    userId: string,
    state: RoomState,
    action: Action
  ): Promise<RoomState> {
    const newState = JSON.parse(JSON.stringify(state)) as RoomState;

    switch (action.action) {
      case 'start':
        return await this.handleStartAction(roomId, userId, newState);

      case 'pick':
        return await this.handlePickAction(roomId, userId, newState, action.payload);

      case 'leave':
        return await this.handleLeaveAction(roomId, userId, newState);

      case 'extend':
        return await this.handleExtendAction(roomId, userId, newState);

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  private async handleStartAction(
    roomId: string,
    userId: string,
    state: RoomState
  ): Promise<RoomState> {
    // Get participants
    const participants = state.data.room.participants.filter(p => p.isActive);
    if (participants.length !== 2) {
      throw new Error('Need exactly 2 participants');
    }

    const [userA, userB] = participants;

    // Generate tournament
    const tournament = await TournamentEngine.generateTournament(
      userA.userId,
      userB.userId
    );

    // Update room status and store tournament data
    await db
      .update(rooms)
      .set({
        status: 'active',
        startedAt: new Date(),
        tournamentData: tournament, // Store tournament data in database
      })
      .where(eq(rooms.id, roomId));

    // Update state
    state.screen = 'bracket';
    
    // Only include round 1 matches in the initial state (no placeholders for future rounds)
    const round1Matches = tournament.matches.filter((m: any) => m.roundNumber === 1);
    
    state.data.tournament = {
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
        totalPicks: Math.ceil(round1Matches.length / 2),
        currentRound: 1,
        totalRounds: tournament.totalRounds,
      },
    };

    return state;
  }

  private async handlePickAction(
    roomId: string,
    userId: string,
    state: RoomState,
    payload: any
  ): Promise<RoomState> {
    const { matchId, selectedMovieId } = payload;
    console.log(`[PICK] User ${userId} picking ${selectedMovieId} for match ${matchId}`);

    // Record pick in database (will fail if duplicate due to unique constraint)
    try {
      await db.insert(bracketPicks).values({
        roomId,
        userId,
        matchId,
        roundNumber: state.data.tournament!.progress.currentRound,
        movieAId: state.data.tournament!.currentMatch!.movieA.id,
        movieBId: state.data.tournament!.currentMatch!.movieB.id,
        selectedMovieId,
        responseTimeMs: payload.responseTimeMs,
      });
      console.log(`[PICK] Successfully saved pick to database`);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        // User already picked for this match - just return current state
        console.log(`User ${userId} already picked for match ${matchId}`);
        return state; // Return original state without changes
      }
      throw error;
    }

    // Update participant's completed matches
    await db.execute(sql`
      UPDATE room_participants 
      SET 
        completed_matches = array_append(completed_matches, ${matchId}),
        current_match_index = current_match_index + 1
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `);
    console.log(`[PICK] Updated participant completed matches`);

    // Rebuild state from database to ensure it reflects the updated participant data
    const freshState = await this.stateManager.loadFromDB(roomId);
    console.log(`[PICK] Loaded fresh state from DB:`, {
      screen: freshState.screen,
      hasTournament: !!freshState.data.tournament,
      matchesCount: freshState.data.tournament?.matches?.length
    });
    
    // Ensure we maintain the tournament screen state
    if (state.screen === 'bracket' && freshState.screen !== 'bracket') {
      freshState.screen = 'bracket';
    }
    
    // Ensure tournament data is preserved
    if (!freshState.data.tournament && state.data.tournament) {
      console.log(`[PICK] Restoring tournament data to fresh state`);
      freshState.data.tournament = state.data.tournament;
    }

    // Check if match is complete (both users picked)
    const picks = await db.query.bracketPicks.findMany({
      where: and(
        eq(bracketPicks.roomId, roomId),
        eq(bracketPicks.matchId, matchId)
      ),
    });
    console.log(`[PICK] Match ${matchId} has ${picks.length} picks`);

    if (picks.length === 2) {
      console.log(`[PICK] Match complete, recording completion`);
      // Record match completion
      await db.insert(matchCompletions).values({
        roomId,
        matchId,
        roundNumber: freshState.data.tournament!.progress.currentRound,
      });

      // Check if round is complete by counting completed matches
      const currentRound = freshState.data.tournament!.progress.currentRound;
      const currentRoundMatches = freshState.data.tournament!.matches.filter((m: any) => 
        m.matchId.startsWith(`r${currentRound}`) || m.matchId.startsWith(`round-${currentRound}`)
      );
      
      const matchCompletions = await db.query.matchCompletions.findMany({
        where: and(
          eq(matchCompletions.roomId, roomId),
          eq(matchCompletions.roundNumber, currentRound)
        ),
      });
      
      const roundComplete = matchCompletions.length >= currentRoundMatches.length;
      console.log(`[PICK] Round complete: ${roundComplete} (${matchCompletions.length}/${currentRoundMatches.length})`);

      if (roundComplete) {
        console.log(`[PICK] Round ${currentRound} complete, advancing...`);
        // Advance to next round using TournamentEngine
        const nextRoundData = await TournamentEngine.advanceTournamentRound(roomId);
        
        if (nextRoundData.isFinalRound) {
          freshState.screen = 'final';
          // Update tournament data with final round match
          if (nextRoundData.nextMatch) {
            freshState.data.tournament!.matches = [nextRoundData.nextMatch];
            freshState.data.tournament!.currentMatch = {
              matchId: nextRoundData.nextMatch.matchId,
              movieA: {
                id: nextRoundData.nextMatch.movieA.id,
                title: nextRoundData.nextMatch.movieA.title,
                posterPath: nextRoundData.nextMatch.movieA.posterPath,
              },
              movieB: {
                id: nextRoundData.nextMatch.movieB.id,
                title: nextRoundData.nextMatch.movieB.title,
                posterPath: nextRoundData.nextMatch.movieB.posterPath,
              },
            };
            freshState.data.tournament!.progress.currentRound = nextRoundData.currentRound;
            freshState.data.tournament!.progress.totalRounds = nextRoundData.currentRound;
            freshState.data.tournament!.progress.userPicks = 0;
            freshState.data.tournament!.progress.totalPicks = 1;
          }
        } else if (nextRoundData.isComplete) {
          freshState.screen = 'winner';
          freshState.data.winner = {
            movie: nextRoundData.winner!,
            addedToWatchlists: true,
          };
          
          // Update room status
          await db
            .update(rooms)
            .set({
              status: 'completed',
              completedAt: new Date(),
              winnerMovieId: nextRoundData.winner!.id,
              winnerTitle: nextRoundData.winner!.title,
              winnerPosterPath: nextRoundData.winner!.posterPath,
            })
            .where(eq(rooms.id, roomId));
            
          // Add to watchlists
          const participants = await db.query.roomParticipants.findMany({
            where: and(
              eq(roomParticipants.roomId, roomId),
              eq(roomParticipants.isActive, true)
            ),
          });
          
          for (const participant of participants) {
            await db.insert(watchList).values({
              userId: participant.userId,
              tmdbMovieId: nextRoundData.winner!.id,
              movieTitle: nextRoundData.winner!.title,
              movieData: {},
              addedFrom: 'decided_together',
              decidedTogetherRoomId: roomId,
              pendingRating: true,
              isWatched: false,
            });
          }
        } else {
          // Update tournament data for next round
          freshState.data.tournament!.progress.currentRound = nextRoundData.currentRound;
          freshState.data.tournament!.progress.userPicks = 0;
          freshState.data.tournament!.progress.totalPicks = nextRoundData.matchesInRound;
          
          // Generate and store all matches for the new round
          const cachedTournament = this.tournamentManager.getCachedTournament(roomId);
          if (cachedTournament) {
            // Get all round picks to determine all winners
            const allRoundPicks = await db.query.bracketPicks.findMany({
              where: and(
                eq(bracketPicks.roomId, roomId),
                eq(bracketPicks.roundNumber, freshState.data.tournament!.progress.currentRound - 1)
              ),
            });
            
            // Group by match and determine all winners
            const matchWinners = new Map<string, TournamentMovie>();
            const picksByMatch = new Map<string, any[]>();
            
            allRoundPicks.forEach(pick => {
              const picks = picksByMatch.get(pick.matchId) || [];
              picks.push(pick);
              picksByMatch.set(pick.matchId, picks);
            });
            
            picksByMatch.forEach((picks, matchId) => {
              if (picks.length === 2) {
                const voteCounts = new Map<number, number>();
                picks.forEach(pick => {
                  voteCounts.set(pick.selectedMovieId, (voteCounts.get(pick.selectedMovieId) || 0) + 1);
                });
                
                let winnerId = picks[0].selectedMovieId;
                let maxVotes = 0;
                voteCounts.forEach((votes, movieId) => {
                  if (votes > maxVotes) {
                    maxVotes = votes;
                    winnerId = movieId;
                  }
                });
                
                const match = cachedTournament.matches.find((m: TournamentMatch) => m.matchId === matchId);
                if (match) {
                  const winnerMovie = winnerId === match.movieA.id ? match.movieA : match.movieB;
                  matchWinners.set(matchId, winnerMovie);
                }
              }
            });
            
            // Generate all matches for new round
            const winners = Array.from(matchWinners.values());
            const newMatches: TournamentMatch[] = [];
            
            for (let i = 0; i < winners.length; i += 2) {
              if (i + 1 < winners.length) {
                newMatches.push({
                  matchId: `r${nextRoundData.currentRound}m${Math.floor(i / 2) + 1}`,
                  roundNumber: nextRoundData.currentRound,
                  movieA: winners[i],
                  movieB: winners[i + 1]
                });
              }
            }
            
            // Replace placeholder matches for the new round with real matches
            const existingMatches = freshState.data.tournament!.matches || [];
            const filteredMatches = existingMatches.filter((m: any) => {
              // Keep matches from previous rounds and remove placeholders for current round
              return !m.matchId.startsWith(`r${nextRoundData.currentRound}`);
            });
            
            freshState.data.tournament!.matches = [
              ...filteredMatches,
              ...newMatches
            ];
            
            console.log(`[PICK] Replaced ${newMatches.length} placeholder matches for round ${nextRoundData.currentRound}`);
          }
        }
      }
      // Note: Individual user progress will be shown via personalized state
    }

    console.log(`[PICK] Returning fresh state with screen: ${freshState.screen}`);
    return freshState;
  }

  private async handleLeaveAction(
    roomId: string,
    userId: string,
    state: RoomState
  ): Promise<RoomState> {
    // Update participant status in database
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        leftAt: new Date(),
      })
      .where(and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.userId, userId)
      ));

    // Rebuild state from database to ensure consistency
    const freshState = await this.stateManager.rebuildFromParticipants(roomId);

    // Check active participant count from fresh state
    const activeCount = freshState.data.room.participants.filter(p => p.isActive).length;
    
    // Check if room should be abandoned
    if (activeCount === 0 || (freshState.screen !== 'lobby' && activeCount < 2)) {
      freshState.screen = 'error';
      freshState.error = 'Tournament abandoned';
      
      // Update room status
      await db
        .update(rooms)
        .set({
          status: 'abandoned',
          closedAt: new Date(),
        })
        .where(eq(rooms.id, roomId));
    }

    return freshState;
  }

  private async handleExtendAction(
    roomId: string,
    userId: string,
    state: RoomState
  ): Promise<RoomState> {
    // Just update room timeout in state
    state.data.room.timeRemaining = 30 * 60; // Reset to 30 minutes

    return state;
  }
} 