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
  isFinalRound?: boolean;
  finalMovies?: TournamentMovie[];
}

export class TournamentEngine {
  
  static async generateTournament(
    userAId: string, 
    userBId: string,
    options: { testMode?: boolean } = {}
  ): Promise<Tournament> {
    try {
      // If test mode is enabled, skip database queries and use mock tournament
      if (options.testMode) {
        console.log('Test mode enabled - using mock tournament directly');
        return this.generateMockTournament(userAId, userBId);
      }
      
      // 1. Fetch both users' unwatched movies
      const userAMovies = await this.getUserWatchlist(userAId, { unwatchedOnly: true });
      const userBMovies = await this.getUserWatchlist(userBId, { unwatchedOnly: true });
      
      console.log(`User A has ${userAMovies.length} movies, User B has ${userBMovies.length} movies`);
      
      // 2. Merge and deduplicate
      const mergedMovies = this.mergeDeduplicate(userAMovies, userBMovies, userAId, userBId);
      
      console.log(`Merged to ${mergedMovies.length} unique movies`);
      
      // 3. Check if we have sufficient movies
      const minMoviesRequired = 4; // Minimum for a meaningful tournament
      
      if (mergedMovies.length < minMoviesRequired) {
        console.log(`Using mock tournament - insufficient movies (${mergedMovies.length} < ${minMoviesRequired})`);
        return this.generateMockTournament(userAId, userBId);
      }
      
      // 4. Ensure minimum tournament size (16-32 movies ideal)
      const tournamentMovies = await this.ensureMinimumSize(mergedMovies, userAId, userBId);
      
      // 5. Generate bracket structure
      const matches = this.generateBracketMatches(tournamentMovies);
      
      console.log(`Generated tournament with ${tournamentMovies.length} movies and ${matches.length} matches`);
      
      // 6. Assign match IDs and round numbers
      return {
        id: this.generateTournamentId(),
        totalRounds: Math.ceil(Math.log2(tournamentMovies.length)),
        matches,
        currentRound: 1
      };
    } catch (error) {
      console.error('Error generating tournament, falling back to mock:', error);
      // Fallback to mock tournament on any error
      return this.generateMockTournament(userAId, userBId);
    }
  }
  
  private static async getUserWatchlist(
    userId: string, 
    options: { unwatchedOnly?: boolean } = {}
  ) {
    const conditions = [eq(watchList.userId, userId)];
    
    if (options.unwatchedOnly) {
      conditions.push(eq(watchList.isWatched, false));
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
    
    // Only generate matches for round 1
    // Future rounds will be generated dynamically as the tournament progresses
    for (let i = 0; i < shuffledMovies.length; i += 2) {
      if (i + 1 < shuffledMovies.length) {
        const matchId = `round-1-match-${Math.floor(i / 2) + 1}`;
        matches.push({
          matchId,
          roundNumber: 1,
          movieA: shuffledMovies[i],
          movieB: shuffledMovies[i + 1],
        });
      }
    }
    
    return matches;
  }
  
  private static generateTournamentId(): string {
    return `tournament-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Test function for health checks
  static async generateMockTournament(userAId?: string, userBId?: string): Promise<Tournament> {
    const mockMovies: TournamentMovie[] = [
      { 
        id: 1, 
        title: 'The Shawshank Redemption', 
        posterPath: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', 
        fromUsers: [userAId || 'user1'] 
      },
      { 
        id: 2, 
        title: 'The Godfather', 
        posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', 
        fromUsers: [userBId || 'user2'] 
      },
      { 
        id: 3, 
        title: 'The Dark Knight', 
        posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', 
        fromUsers: [userAId || 'user1'] 
      },
      { 
        id: 4, 
        title: 'Pulp Fiction', 
        posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', 
        fromUsers: [userBId || 'user2'] 
      },
      { 
        id: 5, 
        title: 'Forrest Gump', 
        posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', 
        fromUsers: [userAId || 'user1'] 
      },
      { 
        id: 6, 
        title: 'Inception', 
        posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', 
        fromUsers: [userBId || 'user2'] 
      },
      { 
        id: 7, 
        title: 'The Matrix', 
        posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', 
        fromUsers: [userAId || 'user1'] 
      },
      { 
        id: 8, 
        title: 'Goodfellas', 
        posterPath: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg', 
        fromUsers: [userBId || 'user2'] 
      },
    ];
    
    const matches = this.generateBracketMatches(mockMovies);
    
    return {
      id: this.generateTournamentId(),
      totalRounds: Math.ceil(Math.log2(mockMovies.length)),
      matches,
      currentRound: 1
    };
  }

  // NEW: Handle round advancement within TournamentEngine
  static async advanceTournamentRound(roomId: string): Promise<{
    success: boolean;
    newMatches?: TournamentMatch[];
    isFinalRound?: boolean;
    isComplete?: boolean;
    winner?: TournamentMovie;
    error?: string;
  }> {
    try {
      console.log(`[TOURNAMENT_ENGINE] Advancing round for room ${roomId}`);
      
      // Get room and tournament data
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
      });
      
      if (!room || !room.tournamentData) {
        return { success: false, error: 'Tournament data not found' };
      }
      
      const tournament = room.tournamentData as Tournament;
      const currentRound = tournament.currentRound;
      
      // Get all picks for the current round
      const roundPicks = await db.query.bracketPicks.findMany({
        where: and(
          eq(bracketPicks.roomId, roomId),
          eq(bracketPicks.roundNumber, currentRound)
        ),
      });
      
      // Get current round matches
      const currentRoundMatches = tournament.matches.filter(m => m.roundNumber === currentRound);
      
      // Determine winners for each match
      const winners: TournamentMovie[] = [];
      
      for (const match of currentRoundMatches) {
        const matchPicks = roundPicks.filter(pick => pick.matchId === match.matchId);
        
        if (matchPicks.length < 2) {
          continue; // Skip incomplete matches
        }
        
        // Count votes for each movie
        const voteCounts = new Map<number, number>();
        matchPicks.forEach(pick => {
          voteCounts.set(pick.selectedMovieId, (voteCounts.get(pick.selectedMovieId) || 0) + 1);
        });
        
        // Determine winner (majority wins, random if tied)
        let winnerId = matchPicks[0].selectedMovieId;
        let maxVotes = 0;
        
        voteCounts.forEach((votes, movieId) => {
          if (votes > maxVotes) {
            maxVotes = votes;
            winnerId = movieId;
          }
        });
        
        // Find winner movie from match data (ONLY from existing match data)
        let winnerMovie: TournamentMovie | null = null;
        if (winnerId === match.movieA.id) {
          winnerMovie = match.movieA;
        } else if (winnerId === match.movieB.id) {
          winnerMovie = match.movieB;
        }
        
        if (!winnerMovie) {
          console.error(`[TOURNAMENT_ENGINE] Winner movie ${winnerId} not found in match ${match.matchId}`);
          return { success: false, error: `Winner movie ${winnerId} not found` };
        }
        
        // Validate winner movie has proper data
        if (!winnerMovie.title || winnerMovie.title.startsWith('Winner of Round')) {
          console.error(`[TOURNAMENT_ENGINE] Invalid winner movie data:`, winnerMovie);
          return { success: false, error: 'Invalid winner movie data' };
        }
        
        winners.push(winnerMovie);
        console.log(`[TOURNAMENT_ENGINE] Match ${match.matchId} winner: ${winnerMovie.title} (ID: ${winnerMovie.id})`);
      }
      
      if (winners.length === 0) {
        return { success: false, error: 'No winners found' };
      }
      
      // Check if tournament is complete
      if (winners.length === 1) {
        console.log(`[TOURNAMENT_ENGINE] Tournament complete! Winner: ${winners[0].title}`);
        return {
          success: true,
          isComplete: true,
          winner: winners[0]
        };
      }
      
      // Check if this is the final round (2 winners)
      if (winners.length === 2) {
        const finalMatch: TournamentMatch = {
          matchId: `final-round-${currentRound + 1}`,
          roundNumber: currentRound + 1,
          movieA: winners[0],
          movieB: winners[1]
        };
        
        console.log(`[TOURNAMENT_ENGINE] Final round! ${winners[0].title} vs ${winners[1].title}`);
        
        return {
          success: true,
          isFinalRound: true,
          newMatches: [finalMatch]
        };
      }
      
      // Generate matches for next round
      const nextRound = currentRound + 1;
      const newMatches: TournamentMatch[] = [];
      
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          const matchId = `round-${nextRound}-match-${Math.floor(i / 2) + 1}`;
          newMatches.push({
            matchId,
            roundNumber: nextRound,
            movieA: winners[i],
            movieB: winners[i + 1]
          });
        }
      }
      
      console.log(`[TOURNAMENT_ENGINE] Generated ${newMatches.length} matches for round ${nextRound}`);
      
      return {
        success: true,
        newMatches
      };
      
    } catch (error) {
      console.error('[TOURNAMENT_ENGINE] Error advancing round:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
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
    try {
      // Get room and tournament data
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
      });

      if (!room?.tournamentData) {
        return false;
      }

      const tournament = room.tournamentData as Tournament;
      const currentRound = tournament.currentRound;

      // Get all matches in current round
      const currentRoundMatches = tournament.matches.filter(m => m.roundNumber === currentRound);
      
      if (currentRoundMatches.length === 0) {
        return false;
      }

      // Get all active participants to check if we're in test mode
      const activeParticipants = await db.query.roomParticipants.findMany({
        where: and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.isActive, true)
        ),
      });

      // Get all picks for current round
      const roundPicks = await db.query.bracketPicks.findMany({
        where: and(
          eq(bracketPicks.roomId, roomId),
          eq(bracketPicks.roundNumber, currentRound)
        ),
      });

      console.log(`🎯 Room advancement check:`, {
        roomId,
        currentRound,
        totalMatches: currentRoundMatches.length,
        totalPicks: roundPicks.length,
        activeParticipants: activeParticipants.length,
        participantIds: activeParticipants.map(p => p.userId)
      });

      // Check if every match in the current round has picks from both users
      console.log(`🔍 Checking round advancement for round ${currentRound}:`, {
        totalMatches: currentRoundMatches.length,
        totalPicks: roundPicks.length,
        picksPerMatch: roundPicks.reduce((acc, pick) => {
          acc[pick.matchId] = (acc[pick.matchId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      for (const match of currentRoundMatches) {
        const matchPicks = roundPicks.filter(pick => pick.matchId === match.matchId);
        const uniqueUsers = new Set(matchPicks.map(pick => pick.userId));
        
        console.log(`Match ${match.matchId}: ${matchPicks.length} picks from ${uniqueUsers.size} users`, {
          picks: matchPicks.map(p => ({ userId: p.userId, selectedMovieId: p.selectedMovieId }))
        });
        
        // If this match doesn't have picks from both users, round cannot advance
        if (uniqueUsers.size < 2) {
          console.log(`❌ Match ${match.matchId} incomplete: only ${uniqueUsers.size} user(s) have picked`);
          return false;
        }
      }

      console.log(`✅ All ${currentRoundMatches.length} matches in round ${currentRound} are complete - can advance round`);
      return true;
      
    } catch (error) {
      console.error('Error checking if round can advance:', error);
      return false;
    }
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

      console.log(`🔍 Processing ${currentRoundMatches.length} matches from round ${currentRound}:`);

      for (const match of currentRoundMatches) {
        // Get picks for this match
        const matchPicks = roundPicks.filter(pick => pick.matchId === match.matchId);
        
        if (matchPicks.length === 0) continue;

        // Log the match details
        console.log(`Match ${match.matchId}:`, {
          movieA: { id: match.movieA.id, title: match.movieA.title },
          movieB: { id: match.movieB.id, title: match.movieB.title },
          picks: matchPicks.map(p => ({ userId: p.userId, selectedMovieId: p.selectedMovieId }))
        });

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
        
        console.log(`🏆 Winner of ${match.matchId}:`, {
          id: winnerMovie.id,
          title: winnerMovie.title,
          posterPath: winnerMovie.posterPath,
          votes: movieVotes[winnerMovie.id]
        });
        
        winners.push(winnerMovie);
      }

      console.log(`✅ Round ${currentRound} complete. Winners advancing to next round:`, 
        winners.map(w => ({ id: w.id, title: w.title }))
      );

      // 4. Generate next round matches or detect final round
      let nextRoundMatches: TournamentMatch[] = [];
      let isFinalRound = false;
      let finalMovies: TournamentMovie[] = [];
      
      if (winners.length === 1) {
        // Tournament complete - single winner
        console.log('🏆 Tournament complete with single winner:', winners[0]);
        nextRoundMatches = [];
      } else if (winners.length === 2) {
        // Final round - exactly 2 movies remain!
        console.log('🥊 Final round detected - 2 movies remain for championship!');
        isFinalRound = true;
        finalMovies = winners;
        
        // Create the final championship match
        const nextRound = currentRound + 1;
        const finalMatchId = `final-round-${nextRound}`;
        nextRoundMatches.push({
          matchId: finalMatchId,
          roundNumber: nextRound,
          movieA: winners[0],
          movieB: winners[1],
        });
      } else if (winners.length > 2) {
        // Generate next round bracket (more than 2 winners)
        const nextRound = currentRound + 1;
        
        console.log(`🎯 Creating Round ${nextRound} matches from ${winners.length} winners:`);
        
        for (let i = 0; i < winners.length; i += 2) {
          if (i + 1 < winners.length) {
            const matchId = `round-${nextRound}-match-${Math.floor(i / 2) + 1}`;
            
            const newMatch = {
              matchId,
              roundNumber: nextRound,
              movieA: winners[i],
              movieB: winners[i + 1],
            };
            
            console.log(`Created match ${matchId}:`, {
              movieA: { id: newMatch.movieA.id, title: newMatch.movieA.title },
              movieB: { id: newMatch.movieB.id, title: newMatch.movieB.title }
            });
            
            nextRoundMatches.push(newMatch);
          }
        }
        
        console.log(`📋 All Round ${nextRound} matches created:`, 
          nextRoundMatches.map(m => `${m.movieA.title} vs ${m.movieB.title}`)
        );
      }

      // 5. Update tournament_data in room
      const updatedTournament: Tournament = {
        ...tournament,
        currentRound: currentRound + 1,
        matches: [
          ...tournament.matches,
          ...nextRoundMatches
        ],
        isFinalRound,
        finalMovies: isFinalRound ? finalMovies : undefined
      };

      await db
        .update(rooms)
        .set({ 
          tournamentData: updatedTournament
        })
        .where(eq(rooms.id, roomId));

      console.log(`Advanced room ${roomId} to round ${currentRound + 1} with ${nextRoundMatches.length} new matches${isFinalRound ? ' - FINAL ROUND!' : ''}`);

      // 6. Return new matches (and final round status)
      return nextRoundMatches;

    } catch (error) {
      console.error('Error advancing tournament round:', error);
      throw new Error('Failed to advance tournament round');
    }
  }

  static async checkFinalPicksComplete(roomId: string): Promise<{
    isComplete: boolean;
    finalPickUserA?: TournamentMovie;
    finalPickUserB?: TournamentMovie;
    participants?: any[];
  }> {
    try {
      // Get room and tournament data
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
      });

      if (!room?.tournamentData) {
        console.log('❌ checkFinalPicksComplete: No tournament data found');
        return { isComplete: false };
      }

      const tournament = room.tournamentData as Tournament;
      
      console.log('🔍 checkFinalPicksComplete: Tournament state check:', {
        isFinalRound: tournament.isFinalRound,
        finalMoviesCount: tournament.finalMovies?.length,
        currentRound: tournament.currentRound,
        totalMatches: tournament.matches.length
      });
      
      // Check if this is the final round
      if (!tournament.isFinalRound || !tournament.finalMovies || tournament.finalMovies.length !== 2) {
        console.log('❌ checkFinalPicksComplete: Not final round or invalid final movies');
        return { isComplete: false };
      }

      // Get participants
      const participants = await db.query.roomParticipants.findMany({
        where: and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.isActive, true)
        ),
      });

      if (participants.length !== 2) {
        return { isComplete: false };
      }

      const [userA, userB] = participants;

      // Get picks for final round
      const finalRoundPicks = await db.query.bracketPicks.findMany({
        where: and(
          eq(bracketPicks.roomId, roomId),
          eq(bracketPicks.roundNumber, tournament.currentRound)
        ),
      });

      // Check if both users made final picks
      const userAFinalPick = finalRoundPicks.find(pick => pick.userId === userA.userId);
      const userBFinalPick = finalRoundPicks.find(pick => pick.userId === userB.userId);

      if (!userAFinalPick || !userBFinalPick) {
        return { isComplete: false };
      }

      // Find the selected movies
      const finalPickUserA = tournament.finalMovies.find(movie => movie.id === userAFinalPick.selectedMovieId);
      const finalPickUserB = tournament.finalMovies.find(movie => movie.id === userBFinalPick.selectedMovieId);

      return {
        isComplete: true,
        finalPickUserA,
        finalPickUserB,
        participants
      };

    } catch (error) {
      console.error('Error checking final picks completion:', error);
      return { isComplete: false };
    }
  }
} 