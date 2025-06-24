import { db } from '@/db';
import { watchList, bracketPicks, matchCompletions, roomParticipants, roomStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface TournamentMovie {
  id: number;
  title: string;
  posterPath?: string;
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
}

export interface RoundAdvanceData {
  currentRound: number;
  matchesInRound: number;
  nextMatch?: TournamentMatch;
  isFinalRound: boolean;
  isComplete: boolean;
  winner?: TournamentMovie;
}

export class SimplifiedTournamentManager {
  private static instance: SimplifiedTournamentManager;
  private tournamentCache: Map<string, Tournament> = new Map();

  private constructor() {}

  static getInstance(): SimplifiedTournamentManager {
    if (!SimplifiedTournamentManager.instance) {
      SimplifiedTournamentManager.instance = new SimplifiedTournamentManager();
    }
    return SimplifiedTournamentManager.instance;
  }

  async generateTournament(userAId: string, userBId: string): Promise<Tournament> {
    // Fetch movies from both users
    const [userAMovies, userBMovies] = await Promise.all([
      this.getUserMovies(userAId),
      this.getUserMovies(userBId)
    ]);

    // Merge and deduplicate
    const movieMap = new Map<number, TournamentMovie>();
    
    [...userAMovies, ...userBMovies].forEach(movie => {
      if (!movieMap.has(movie.id)) {
        movieMap.set(movie.id, movie);
      }
    });

    let movies = Array.from(movieMap.values());

    // Ensure we have at least 8 movies
    if (movies.length < 8) {
      movies = this.padWithDefaultMovies(movies);
    }

    // Limit to power of 2
    const targetSize = Math.min(32, Math.pow(2, Math.floor(Math.log2(movies.length))));
    movies = movies.slice(0, targetSize);

    // Shuffle movies
    movies = this.shuffle(movies);

    // Generate bracket
    const tournament: Tournament = {
      id: `tournament-${Date.now()}`,
      totalRounds: Math.log2(movies.length),
      matches: this.generateMatches(movies)
    };

    return tournament;
  }

  private async getUserMovies(userId: string): Promise<TournamentMovie[]> {
    const watchListItems = await db.query.watchList.findMany({
      where: and(
        eq(watchList.userId, userId),
        eq(watchList.isWatched, false)
      ),
    });

    return watchListItems.map(item => ({
      id: item.tmdbMovieId,
      title: item.movieTitle,
      posterPath: typeof item.movieData === 'object' && item.movieData && 'poster_path' in item.movieData 
        ? (item.movieData as any).poster_path 
        : undefined,
      movieData: item.movieData
    }));
  }

  private padWithDefaultMovies(movies: TournamentMovie[]): TournamentMovie[] {
    const defaultMovies: TournamentMovie[] = [
      { id: 1001, title: 'The Shawshank Redemption', posterPath: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg' },
      { id: 1002, title: 'The Godfather', posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg' },
      { id: 1003, title: 'The Dark Knight', posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
      { id: 1004, title: 'Pulp Fiction', posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg' },
      { id: 1005, title: 'Forrest Gump', posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg' },
      { id: 1006, title: 'Inception', posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg' },
      { id: 1007, title: 'The Matrix', posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' },
      { id: 1008, title: 'Goodfellas', posterPath: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg' },
    ];

    const combined = [...movies];
    let index = 0;

    while (combined.length < 8 && index < defaultMovies.length) {
      const defaultMovie = defaultMovies[index];
      if (!combined.some(m => m.id === defaultMovie.id)) {
        combined.push(defaultMovie);
      }
      index++;
    }

    return combined;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateMatches(movies: TournamentMovie[]): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    
    // Only generate matches for round 1
    // Future rounds will be generated dynamically as the tournament progresses
    for (let i = 0; i < movies.length; i += 2) {
      if (i + 1 < movies.length) {
        matches.push({
          matchId: `r1m${Math.floor(i / 2) + 1}`,
          roundNumber: 1,
          movieA: movies[i],
          movieB: movies[i + 1]
        });
      }
    }

    return matches;
  }

  async getNextMatchForUser(roomId: string, userId: string): Promise<TournamentMatch | null> {
    // Get user's completed matches
    const participant = await db.query.roomParticipants.findFirst({
      where: and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.userId, userId)
      ),
    });

    if (!participant) return null;

    const completedMatches = (participant as any).completedMatches || [];

    // Try to get tournament from cache first
    const tournament = this.tournamentCache.get(roomId);
    if (!tournament) {
      // If no cached tournament, try to get from room state
      const roomState = await db.query.roomStates.findFirst({
        where: eq(roomStates.roomId, roomId),
      });

      if (!roomState?.currentState) return null;
      
      const state = roomState.currentState as any;
      if (!state.data?.tournament?.matches) return null;

      // Use matches from state
      const currentRound = state.data.tournament.progress.currentRound;
      const currentRoundMatches = state.data.tournament.matches.filter((m: any) => 
        m.matchId.startsWith(`r${currentRound}`)
      );

      // Find first match not completed by user
      for (const match of currentRoundMatches) {
        if (!completedMatches.includes(match.matchId)) {
          return match;
        }
      }

      return null;
    }

    // Use cached tournament
    const roomState = await db.query.roomStates.findFirst({
      where: eq(roomStates.roomId, roomId),
    });

    if (!roomState?.currentState) return null;
    
    const state = roomState.currentState as any;
    const currentRound = state.data?.tournament?.progress?.currentRound || 1;
    
    const currentRoundMatches = tournament.matches.filter(m => m.roundNumber === currentRound);
    
    // Find first match not completed by user
    for (const match of currentRoundMatches) {
      if (!completedMatches.includes(match.matchId)) {
        return match;
      }
    }

    return null;
  }

  async checkRoundComplete(roomId: string, roundNumber: number): Promise<boolean> {
    // Get all match completions for this round
    const completions = await db.query.matchCompletions.findMany({
      where: and(
        eq(matchCompletions.roomId, roomId),
        eq(matchCompletions.roundNumber, roundNumber)
      ),
    });

    // Get expected number of matches in round from tournament data
    const tournament = this.tournamentCache.get(roomId);
    let expectedMatches = 0;
    
    if (tournament) {
      // Count matches in the specific round from cached tournament
      expectedMatches = tournament.matches.filter(m => m.roundNumber === roundNumber).length;
    } else {
      // Fallback: get from room state
      const roomState = await db.query.roomStates.findFirst({
        where: eq(roomStates.roomId, roomId),
      });
      
      if (roomState?.currentState) {
        const state = roomState.currentState as any;
        if (state.data?.tournament?.matches) {
          expectedMatches = state.data.tournament.matches.filter((m: any) => 
            m.matchId.startsWith(`r${roundNumber}`)
          ).length;
        }
      }
    }
    
    console.log(`[ROUND_CHECK] Round ${roundNumber}: ${completions.length}/${expectedMatches} matches complete`);
    return completions.length >= expectedMatches;
  }

  async advanceRound(roomId: string): Promise<RoundAdvanceData> {
    // Get current round data
    const roomState = await db.query.roomStates.findFirst({
      where: eq(roomStates.roomId, roomId),
    });

    if (!roomState?.currentState) {
      throw new Error('No room state found');
    }

    const state = roomState.currentState as any;
    const currentRound = state.data.tournament.progress.currentRound;

    // Build a comprehensive movie lookup
    const movieLookup = new Map<number, TournamentMovie>();
    
    // Add default movies to lookup
    const defaultMovies: TournamentMovie[] = [
      { id: 1001, title: 'The Shawshank Redemption', posterPath: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg' },
      { id: 1002, title: 'The Godfather', posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg' },
      { id: 1003, title: 'The Dark Knight', posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
      { id: 1004, title: 'Pulp Fiction', posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg' },
      { id: 1005, title: 'Forrest Gump', posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg' },
      { id: 1006, title: 'Inception', posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg' },
      { id: 1007, title: 'The Matrix', posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' },
      { id: 1008, title: 'Goodfellas', posterPath: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg' },
    ];
    
    defaultMovies.forEach(movie => {
      movieLookup.set(movie.id, movie);
    });

    // Get tournament data for movie information
    const tournament = this.tournamentCache.get(roomId);
    
    // Add cached tournament movies to lookup
    if (tournament) {
      tournament.matches.forEach(match => {
        if (match.movieA.title !== `Winner of Round ${match.roundNumber - 1}`) {
          movieLookup.set(match.movieA.id, match.movieA);
        }
        if (match.movieB.title !== `Winner of Round ${match.roundNumber - 1}`) {
          movieLookup.set(match.movieB.id, match.movieB);
        }
      });
    }
    
    // Add state tournament matches to lookup
    if (state.data.tournament.matches) {
      state.data.tournament.matches.forEach((match: any) => {
        if (match.movieA && match.movieA.title && !match.movieA.title.startsWith('Winner of Round')) {
          movieLookup.set(match.movieA.id, match.movieA);
        }
        if (match.movieB && match.movieB.title && !match.movieB.title.startsWith('Winner of Round')) {
          movieLookup.set(match.movieB.id, match.movieB);
        }
      });
    }

    // Get picks from current round to determine winners
    const roundPicks = await db.query.bracketPicks.findMany({
      where: and(
        eq(bracketPicks.roomId, roomId),
        eq(bracketPicks.roundNumber, currentRound)
      ),
    });

    // Group picks by match
    const matchWinners = new Map<string, TournamentMovie>();
    const picksByMatch = new Map<string, any[]>();

    roundPicks.forEach(pick => {
      const picks = picksByMatch.get(pick.matchId) || [];
      picks.push(pick);
      picksByMatch.set(pick.matchId, picks);
    });

    // Determine winners for each match
    for (const [matchId, picks] of picksByMatch) {
      if (picks.length === 2) {
        // Both users picked - determine winner by majority or random if tied
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

        // Get winner movie data from our comprehensive lookup
        let winnerMovie = movieLookup.get(winnerId);
        
        // If still not found, try to get from watchlist
        if (!winnerMovie) {
          const watchListItem = await db.query.watchList.findFirst({
            where: eq(watchList.tmdbMovieId, winnerId),
          });
          
          if (watchListItem) {
            winnerMovie = {
              id: watchListItem.tmdbMovieId,
              title: watchListItem.movieTitle,
              posterPath: typeof watchListItem.movieData === 'object' && watchListItem.movieData && 'poster_path' in watchListItem.movieData 
                ? (watchListItem.movieData as any).poster_path 
                : undefined,
              movieData: watchListItem.movieData
            };
            // Add to lookup for future use
            movieLookup.set(winnerMovie.id, winnerMovie);
          }
        }
        
        // As last resort, create basic movie object
        if (!winnerMovie) {
          // Try to infer from the match data in picks
          const matchPick = picks[0];
          if (winnerId === matchPick.movieAId || winnerId === matchPick.movieBId) {
            // Look for any movie with this ID in all previous rounds
            const allPicks = await db.query.bracketPicks.findMany({
              where: eq(bracketPicks.roomId, roomId),
            });
            
            for (const prevPick of allPicks) {
              if (prevPick.movieAId === winnerId || prevPick.movieBId === winnerId) {
                // Found a match, now try to get the title from state or cache
                const prevMatch = state.data.tournament.matches.find((m: any) => m.matchId === prevPick.matchId);
                if (prevMatch) {
                  if (prevMatch.movieA.id === winnerId) {
                    winnerMovie = prevMatch.movieA;
                  } else if (prevMatch.movieB.id === winnerId) {
                    winnerMovie = prevMatch.movieB;
                  }
                  break;
                }
              }
            }
          }
        }
        
        if (winnerMovie) {
          matchWinners.set(matchId, winnerMovie);
        } else {
          console.error(`[ADVANCE_ROUND] Could not find movie data for winner ${winnerId} in match ${matchId}`);
          // Create a fallback movie object
          matchWinners.set(matchId, {
            id: winnerId,
            title: `Movie ${winnerId}`,
            posterPath: undefined
          });
        }
      }
    }

    const winners = Array.from(matchWinners.values());
    const nextRound = currentRound + 1;

    console.log(`[ADVANCE_ROUND] Advancing from round ${currentRound} to ${nextRound} with ${winners.length} winners`);
    winners.forEach(w => console.log(`  - ${w.title} (ID: ${w.id})`));

    // Check if tournament is complete
    if (winners.length === 1) {
      console.log(`[ADVANCE_ROUND] Tournament complete! Winner: ${winners[0].title}`);
      return {
        currentRound: nextRound,
        matchesInRound: 0,
        isFinalRound: false,
        isComplete: true,
        winner: winners[0]
      };
    }

    // Check if this is final round
    if (winners.length === 2) {
      console.log(`[ADVANCE_ROUND] Final round reached with movies: ${winners[0].title} vs ${winners[1].title}`);
      return {
        currentRound: nextRound,
        matchesInRound: 1,
        nextMatch: {
          matchId: `r${nextRound}m1`,
          roundNumber: nextRound,
          movieA: winners[0],
          movieB: winners[1]
        },
        isFinalRound: true,
        isComplete: false
      };
    }

    // Generate next round matches
    const nextMatches: TournamentMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        nextMatches.push({
          matchId: `r${nextRound}m${Math.floor(i / 2) + 1}`,
          roundNumber: nextRound,
          movieA: winners[i],
          movieB: winners[i + 1]
        });
      }
    }

    console.log(`[ADVANCE_ROUND] Generated ${nextMatches.length} matches for round ${nextRound}`);
    return {
      currentRound: nextRound,
      matchesInRound: nextMatches.length,
      nextMatch: nextMatches[0],
      isFinalRound: false,
      isComplete: false
    };
  }

  cacheTournament(roomId: string, tournament: Tournament): void {
    this.tournamentCache.set(roomId, tournament);
  }

  getCachedTournament(roomId: string): Tournament | undefined {
    return this.tournamentCache.get(roomId);
  }

  clearCache(roomId: string): void {
    this.tournamentCache.delete(roomId);
  }
} 