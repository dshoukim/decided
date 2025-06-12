import { db } from '@/db'
import { rooms, bracketPicks, roomHistory, watchList, roomParticipants } from '@/db/schema'
import { sql, eq, and } from 'drizzle-orm'

interface TournamentMatch {
  matchId: string;
  roundNumber: number;
  movieA: any;
  movieB: any;
}

export class TransactionManager {
  
  static async executeInTransaction<T>(
    operation: (tx: any) => Promise<T>,
    options: { maxRetries?: number; retryDelay?: number } = {}
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000 } = options;
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await db.transaction(async (tx) => {
          return await operation(tx);
        });
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable (deadlock, serialization failure, etc.)
        if (this.isRetryableError(error as Error) && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError!;
  }
  
  private static isRetryableError(error: Error): boolean {
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '08006', // connection_failure
    ];
    
    return retryableCodes.some(code => error.message.includes(code));
  }
  
  static async atomicRoundAdvancement(
    roomId: string,
    currentRound: number,
    nextRoundMatches: TournamentMatch[]
  ): Promise<void> {
    await this.executeInTransaction(async (tx) => {
      // 1. Verify all users completed current round
      const picks = await tx
        .select()
        .from(bracketPicks)
        .where(
          and(
            eq(bracketPicks.roomId, roomId),
            eq(bracketPicks.roundNumber, currentRound)
          )
        );
        
      const uniqueUsers = new Set(picks.map((p: any) => p.userId));
      if (uniqueUsers.size < 2) {
        throw new Error('Round not complete for all participants');
      }
      
      // 2. Update room tournament data
      await tx
        .update(rooms)
        .set({
          tournamentData: sql`jsonb_set(tournament_data, '{currentRound}', '${currentRound + 1}')`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(rooms.id, roomId));
      
      // 3. Log round completion
      await tx.insert(roomHistory).values({
        roomId,
        eventType: 'round_completed',
        eventData: {
          completedRound: currentRound,
          nextRoundMatches: nextRoundMatches.length,
        },
      });
    });
  }
  
  static async atomicWinnerDetermination(
    roomId: string,
    winnerMovie: any,
    participantIds: string[]
  ): Promise<void> {
    await this.executeInTransaction(async (tx) => {
      // 1. Update room with winner
      await tx
        .update(rooms)
        .set({
          status: 'completed',
          winnerMovieId: winnerMovie.id,
          winnerTitle: winnerMovie.title,
          winnerPosterPath: winnerMovie.posterPath,
          completedAt: new Date().toISOString(),
        })
        .where(eq(rooms.id, roomId));
      
      // 2. Add to both users' watchlists
      const watchlistEntries = participantIds.map(userId => ({
        userId,
        tmdbMovieId: winnerMovie.id,
        movieTitle: winnerMovie.title,
        movieData: winnerMovie,
        addedFrom: 'decided_together' as const,
        decidedTogetherRoomId: roomId,
        pendingRating: true,
      }));
      
      await tx.insert(watchList).values(watchlistEntries);
      
      // 3. Log completion
      await tx.insert(roomHistory).values({
        roomId,
        eventType: 'tournament_completed',
        eventData: {
          winnerMovieId: winnerMovie.id,
          participantIds,
        },
      });
    });
  }
  
  static async atomicRoomStateTransition(
    roomId: string,
    newStatus: string,
    metadata?: any
  ): Promise<void> {
    await this.executeInTransaction(async (tx) => {
      // 1. Update room status
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      
      if (newStatus === 'active') {
        updateData.startedAt = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updateData.completedAt = new Date().toISOString();
      } else if (newStatus === 'abandoned') {
        updateData.closedAt = new Date().toISOString();
      }
      
      await tx
        .update(rooms)
        .set(updateData)
        .where(eq(rooms.id, roomId));
      
      // 2. Log state transition
      await tx.insert(roomHistory).values({
        roomId,
        eventType: 'room_status_changed',
        eventData: {
          newStatus,
          metadata,
        },
      });
    });
  }
} 