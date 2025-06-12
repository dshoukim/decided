import { db } from '@/db'
import { watchList, users, rooms, bracketPicks, roomParticipants } from '@/db/schema'
import { eq, and, or, isNull } from 'drizzle-orm'

export interface TournamentMovie {
  id: number;
  title: string;
  posterPath: string;
  fromUsers: string[]; // which users had this movie
  movieData?: any;
}

export interface TournamentMatch {
  matchId: string;
  roundNumber: number;
  movieA: TournamentMovie;
  movieB: TournamentMovie;
}

export interface Tournament {
  id: string;
  totalRounds: number;
  matches: TournamentMatch[];
  currentRound: number;
}

export class TournamentEngine {
  
  static async generateTournament(
    userAId: string, 
    userBId: string
  ): Promise<Tournament> {
    // 1. Fetch both users' unwatched movies
    const userAMovies = await this.getUserWatchlist(userAId, { unwatchedOnly: true });
    const userBMovies = await this.getUserWatchlist(userBId, { unwatchedOnly: true });
    
    // 2. Merge and deduplicate
    const mergedMovies = this.mergeDeduplicate(userAMovies, userBMovies, userAId, userBId);
    
    // 3. Ensure minimum tournament size (16-32 movies ideal)
    const tournamentMovies = await this.ensureMinimumSize(mergedMovies, userAId, userBId);
    
    // 4. Generate bracket structure
    const matches = this.generateBracketMatches(tournamentMovies);
    
    // 5. Assign match IDs and round numbers
    return {
      id: this.generateTournamentId(),
      totalRounds: Math.ceil(Math.log2(tournamentMovies.length)),
      matches,
      currentRound: 1
    };
  }
  
  private static async getUserWatchlist(
    userId: string, 
    options: { unwatchedOnly?: boolean } = {}
  ) {
    const conditions = [eq(watchList.userId, userId)];
    
    if (options.unwatchedOnly) {
      conditions.push(or(eq(watchList.isWatched, false), isNull(watchList.isWatched)));
    }
    
    return await db
      .select()
      .from(watchList)
      .where(and(...conditions));
  }
  
  private static mergeDeduplicate(
    userAMovies: any[], 
    userBMovies: any[],
    userAId: string,
    userBId: string
  ): TournamentMovie[] {
    // Create map to track which users have each movie
    const movieMap = new Map<number, TournamentMovie>();
    
    // Add user A movies
    userAMovies.forEach(movie => {
      movieMap.set(movie.tmdbMovieId, {
        id: movie.tmdbMovieId,
        title: movie.movieTitle,
        posterPath: movie.movieData?.poster_path || '',
        fromUsers: [userAId],
        movieData: movie.movieData
      });
    });
    
    // Add user B movies (merge if duplicate)
    userBMovies.forEach(movie => {
      const existing = movieMap.get(movie.tmdbMovieId);
      if (existing) {
        existing.fromUsers.push(userBId);
      } else {
        movieMap.set(movie.tmdbMovieId, {
          id: movie.tmdbMovieId,
          title: movie.movieTitle, 
          posterPath: movie.movieData?.poster_path || '',
          fromUsers: [userBId],
          movieData: movie.movieData
        });
      }
    });
    
    return Array.from(movieMap.values());
  }
  
  private static async ensureMinimumSize(
    mergedMovies: TournamentMovie[],
    userAId: string,
    userBId: string
  ): Promise<TournamentMovie[]> {
    const minSize = 16;
    
    if (mergedMovies.length >= minSize) {
      // Limit to power of 2 for clean bracket
      const maxSize = Math.pow(2, Math.floor(Math.log2(mergedMovies.length)));
      return mergedMovies.slice(0, maxSize);
    }
    
    // If too few movies, add popular movies from both users' genres
    // For MVP, just use what we have and pad to next power of 2
    const targetSize = Math.max(8, Math.pow(2, Math.ceil(Math.log2(mergedMovies.length))));
    
    // For now, duplicate movies to reach target size (MVP approach)
    while (mergedMovies.length < targetSize && mergedMovies.length > 0) {
      const randomMovie = mergedMovies[Math.floor(Math.random() * mergedMovies.length)];
      mergedMovies.push({
        ...randomMovie,
        id: randomMovie.id + 100000 + mergedMovies.length, // Temporary ID offset
      });
    }
    
    return mergedMovies.slice(0, targetSize);
  }
  
  private static generateBracketMatches(movies: TournamentMovie[]): TournamentMatch[] {
    if (movies.length < 2) {
      throw new Error('Need at least 2 movies for tournament');
    }
    
    const matches: TournamentMatch[] = [];
    const shuffledMovies = [...movies].sort(() => Math.random() - 0.5); // Shuffle for fairness
    
    let currentRound = 1;
    let currentMovies = shuffledMovies;
    
    while (currentMovies.length > 1) {
      const roundMatches: TournamentMatch[] = [];
      
      for (let i = 0; i < currentMovies.length; i += 2) {
        if (i + 1 < currentMovies.length) {
          const matchId = `round-${currentRound}-match-${Math.floor(i / 2) + 1}`;
          roundMatches.push({
            matchId,
            roundNumber: currentRound,
            movieA: currentMovies[i],
            movieB: currentMovies[i + 1],
          });
        }
      }
      
      matches.push(...roundMatches);
      
      // For now, just prepare structure for next round (winners determined by user picks)
      currentMovies = roundMatches.map((match, index) => ({
        id: -index - 1, // Placeholder for winner
        title: `Winner of ${match.matchId}`,
        posterPath: '',
        fromUsers: [],
      }));
      
      currentRound++;
    }
    
    return matches;
  }
  
  private static generateTournamentId(): string {
    return `tournament-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Test function for health checks
  static async generateMockTournament(): Promise<Tournament> {
    const mockMovies: TournamentMovie[] = [
      { id: 1, title: 'Test Movie A', posterPath: '', fromUsers: ['user1'] },
      { id: 2, title: 'Test Movie B', posterPath: '', fromUsers: ['user2'] },
      { id: 3, title: 'Test Movie C', posterPath: '', fromUsers: ['user1'] },
      { id: 4, title: 'Test Movie D', posterPath: '', fromUsers: ['user2'] },
    ];
    
    const matches = this.generateBracketMatches(mockMovies);
    
    return {
      id: this.generateTournamentId(),
      totalRounds: Math.ceil(Math.log2(mockMovies.length)),
      matches,
      currentRound: 1
    };
  }
}

// Tournament progress tracking
export class TournamentProgress {
  
  static async getUserProgress(roomId: string, userId: string): Promise<{
    completedPicks: number;
    totalPicks: number;
    currentRound: number;
    canAdvance: boolean;
  }> {
    // Get room's current tournament state
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });
    
    if (!room?.tournamentData) {
      throw new Error('Room has no tournament data');
    }
    
    const tournament = room.tournamentData as Tournament;
    const currentRound = tournament.currentRound;
    
    // Count user's completed picks for current round
    const completedPicks = await db.query.bracketPicks.findMany({
      where: and(
        eq(bracketPicks.roomId, roomId),
        eq(bracketPicks.userId, userId),
        eq(bracketPicks.roundNumber, currentRound)
      ),
    });
    
    // Count total picks needed for current round
    const currentRoundMatches = tournament.matches.filter(m => m.roundNumber === currentRound);
    
    return {
      completedPicks: completedPicks.length,
      totalPicks: currentRoundMatches.length,
      currentRound,
      canAdvance: completedPicks.length >= currentRoundMatches.length,
    };
  }
  
  static async canAdvanceRound(roomId: string): Promise<boolean> {
    // Get all participants
    const participants = await db.query.roomParticipants.findMany({
      where: and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.isActive, true)
      ),
    });
    
    if (participants.length !== 2) {
      return false;
    }
    
    // Check if both users completed current round
    for (const participant of participants) {
      const progress = await this.getUserProgress(roomId, participant.userId);
      if (!progress.canAdvance) {
        return false;
      }
    }
    
    return true;
  }

  static async advanceRound(roomId: string): Promise<TournamentMatch[]> {
    try {
      // 1. Get current tournament state
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
      });

      if (!room?.tournamentData) {
        throw new Error('Room has no tournament data');
      }

      const tournament = room.tournamentData as Tournament;
      const currentRound = tournament.currentRound;

      // 2. Get all picks from current round
      const roundPicks = await db.query.bracketPicks.findMany({
        where: and(
          eq(bracketPicks.roomId, roomId),
          eq(bracketPicks.roundNumber, currentRound)
        ),
      });

      if (roundPicks.length === 0) {
        throw new Error('No picks found for current round');
      }

      // 3. Determine round winners based on user selections
      const currentRoundMatches = tournament.matches.filter(m => m.roundNumber === currentRound);
      const winners: TournamentMovie[] = [];

      for (const match of currentRoundMatches) {
        // Get picks for this match
        const matchPicks = roundPicks.filter(pick => pick.matchId === match.matchId);
        
        if (matchPicks.length === 0) continue;

        // Determine winner (majority wins, or random if tied)
        const movieVotes = matchPicks.reduce((acc, pick) => {
          acc[pick.selectedMovieId] = (acc[pick.selectedMovieId] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const winnerMovieId = Object.keys(movieVotes).reduce((a, b) => 
          movieVotes[parseInt(a)] > movieVotes[parseInt(b)] ? a : b
        );

        // Find winner movie from match
        const winnerMovie = parseInt(winnerMovieId) === match.movieA.id ? match.movieA : match.movieB;
        winners.push(winnerMovie);
      }

      // 4. Generate next round matches
      let nextRoundMatches: TournamentMatch[] = [];
      
      if (winners.length === 1) {
        // Tournament complete - no more matches
        nextRoundMatches = [];
      } else if (winners.length >= 2) {
        // Generate next round bracket
        const nextRound = currentRound + 1;
        
        for (let i = 0; i < winners.length; i += 2) {
          if (i + 1 < winners.length) {
            const matchId = `round-${nextRound}-match-${Math.floor(i / 2) + 1}`;
            nextRoundMatches.push({
              matchId,
              roundNumber: nextRound,
              movieA: winners[i],
              movieB: winners[i + 1],
            });
          }
        }
      }

      // 5. Update tournament_data in room
      const updatedTournament: Tournament = {
        ...tournament,
        currentRound: currentRound + 1,
        matches: [
          ...tournament.matches,
          ...nextRoundMatches
        ]
      };

      await db
        .update(rooms)
        .set({ 
          tournamentData: updatedTournament,
          updatedAt: new Date().toISOString()
        })
        .where(eq(rooms.id, roomId));

      console.log(`Advanced room ${roomId} to round ${currentRound + 1} with ${nextRoundMatches.length} new matches`);

      // 6. Return new matches
      return nextRoundMatches;

    } catch (error) {
      console.error('Error advancing tournament round:', error);
      throw new Error('Failed to advance tournament round');
    }
  }
} 