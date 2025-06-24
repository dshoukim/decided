import { db } from '@/db'
import { rooms, watchList, tournamentState, roomParticipants } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// Core types for the new tournament system
export interface TournamentMovie {
  id: number
  title: string
  posterPath?: string
  release_date?: string
  vote_average?: number
  fromUsers: string[]
  movieData?: any
}

export interface TournamentMatch {
  matchId: string
  roundNumber: number
  movieA: TournamentMovie
  movieB: TournamentMovie
}

export interface TournamentPick {
  matchId: string
  userId: string
  selectedMovieId: number
  responseTimeMs?: number
  submittedAt: string
}

export interface TournamentState {
  roomId: string
  status: 'generating' | 'round_1' | 'round_2' | 'round_3' | 'final' | 'completed'
  currentRound: number
  totalRounds: number
  currentMatches: TournamentMatch[]
  completedPicks: TournamentPick[]
  allMovies: TournamentMovie[]
  winnerMovieId?: number
  winnerTitle?: string
  winnerPosterPath?: string
  version: number
  createdAt: string
  updatedAt: string
  
  // Computed fields for UI
  userProgress?: {
    completedPicks: number
    totalPicks: number
    canAdvance: boolean
    currentMatch?: TournamentMatch
  }
}

export class TournamentService {
  
  /**
   * Start a new tournament for a room
   */
  static async startTournament(roomId: string): Promise<TournamentState> {
    return await db.transaction(async (tx) => {
      // Get room participants
      const participants = await tx.query.roomParticipants.findMany({
        where: eq(roomParticipants.roomId, roomId),
        with: { user: true }
      })

      if (participants.length !== 2) {
        throw new Error('Tournament requires exactly 2 participants')
      }

      const [userA, userB] = participants

      // Get movies from both users' watchlists
      const userAMovies = await this.getUserWatchlist(tx, userA.userId)
      const userBMovies = await this.getUserWatchlist(tx, userB.userId)

      // Merge and deduplicate movies
      const allMovies = this.mergeMovies(userAMovies, userBMovies, userA.userId, userB.userId)

      if (allMovies.length < 4) {
        // Use mock tournament for insufficient movies
        const mockMovies = this.generateMockMovies()
        return this.createTournamentState(tx, roomId, mockMovies)
      }

      // Ensure tournament size is power of 2
      const tournamentSize = Math.pow(2, Math.floor(Math.log2(Math.min(allMovies.length, 16))))
      const selectedMovies = allMovies.slice(0, tournamentSize)

      return this.createTournamentState(tx, roomId, selectedMovies)
    })
  }

  /**
   * Submit a pick and advance tournament if needed
   */
  static async submitPick(
    roomId: string, 
    userId: string, 
    pick: {
      matchId: string
      selectedMovieId: number
      responseTimeMs?: number
    }
  ): Promise<TournamentState> {
    return await db.transaction(async (tx) => {
      // Get current tournament state
      const current = await tx.query.tournamentState.findFirst({
        where: eq(tournamentState.roomId, roomId)
      })

      if (!current) {
        throw new Error('Tournament not found')
      }

      if (current.status === 'completed') {
        throw new Error('Tournament is already completed')
      }

      // Check if user already picked for this match
      const existingPicks = current.completedPicks as TournamentPick[]
      const existingPick = existingPicks.find(p => 
        p.matchId === pick.matchId && p.userId === userId
      )

      if (existingPick) {
        throw new Error('Pick already submitted for this match')
      }

      // Validate match exists in current round
      const currentMatches = current.currentMatches as TournamentMatch[]
      const match = currentMatches.find(m => m.matchId === pick.matchId)
      
      if (!match) {
        throw new Error('Invalid match ID for current round')
      }

      // Validate selected movie is valid for this match
      if (pick.selectedMovieId !== match.movieA.id && pick.selectedMovieId !== match.movieB.id) {
        throw new Error('Selected movie is not valid for this match')
      }

      // Add the new pick
      const newPick: TournamentPick = {
        matchId: pick.matchId,
        userId,
        selectedMovieId: pick.selectedMovieId,
        responseTimeMs: pick.responseTimeMs,
        submittedAt: new Date().toISOString()
      }

      const updatedPicks = [...existingPicks, newPick]

      // Check if round is complete (all matches have picks from both users)
      const participants = await tx.query.roomParticipants.findMany({
        where: eq(roomParticipants.roomId, roomId)
      })

      const canAdvance = this.checkRoundComplete(currentMatches, updatedPicks, participants.map(p => p.userId))

      let newState = current
      let newMatches = currentMatches

      if (canAdvance) {
        // Advance to next round
        const advancement = this.advanceRound(
          current.currentRound,
          current.totalRounds,
          currentMatches,
          updatedPicks,
          current.allMovies as TournamentMovie[]
        )

        newState = {
          ...current,
          status: advancement.status,
          currentRound: advancement.currentRound,
          currentMatches: advancement.matches,
          completedPicks: updatedPicks,
          winnerMovieId: advancement.winnerMovieId,
          winnerTitle: advancement.winnerTitle,
          winnerPosterPath: advancement.winnerPosterPath
        }
      } else {
        // Just update picks
        newState = {
          ...current,
          completedPicks: updatedPicks
        }
      }

      // Update tournament state in database
      await tx.update(tournamentState)
        .set({
          status: newState.status,
          currentRound: newState.currentRound,
          currentMatches: newState.currentMatches,
          completedPicks: newState.completedPicks,
          winnerMovieId: newState.winnerMovieId ?? null,
          winnerTitle: newState.winnerTitle ?? null,
          winnerPosterPath: newState.winnerPosterPath ?? null
        })
        .where(eq(tournamentState.roomId, roomId))

      // Update room status if tournament completed
      if (newState.status === 'completed') {
        await tx.update(rooms)
          .set({
            status: 'completed',
            completedAt: new Date(),
            winnerMovieId: newState.winnerMovieId,
            winnerTitle: newState.winnerTitle,
            winnerPosterPath: newState.winnerPosterPath
          })
          .where(eq(rooms.id, roomId))
      }

      return this.formatTournamentState(newState, userId)
    })
  }

  /**
   * Get current tournament state for a user
   */
  static async getTournamentState(roomId: string, userId: string): Promise<TournamentState | null> {
    const state = await db.query.tournamentState.findFirst({
      where: eq(tournamentState.roomId, roomId)
    })

    if (!state) {
      return null
    }

    return this.formatTournamentState(state, userId)
  }

  /**
   * Private helper methods
   */
  private static async getUserWatchlist(tx: any, userId: string) {
    return await tx.query.watchList.findMany({
      where: and(
        eq(watchList.userId, userId),
        eq(watchList.isWatched, false)
      )
    })
  }

  private static mergeMovies(
    userAMovies: any[], 
    userBMovies: any[], 
    userAId: string, 
    userBId: string
  ): TournamentMovie[] {
    const movieMap = new Map<number, TournamentMovie>()

    // Add user A movies
    userAMovies.forEach(movie => {
      movieMap.set(movie.tmdbMovieId, {
        id: movie.tmdbMovieId,
        title: movie.movieTitle,
        posterPath: movie.movieData?.poster_path || '',
        fromUsers: [userAId],
        movieData: movie.movieData
      })
    })

    // Add user B movies (merge if duplicate)
    userBMovies.forEach(movie => {
      const existing = movieMap.get(movie.tmdbMovieId)
      if (existing) {
        existing.fromUsers.push(userBId)
      } else {
        movieMap.set(movie.tmdbMovieId, {
          id: movie.tmdbMovieId,
          title: movie.movieTitle,
          posterPath: movie.movieData?.poster_path || '',
          fromUsers: [userBId],
          movieData: movie.movieData
        })
      }
    })

    return Array.from(movieMap.values())
  }

  private static generateMockMovies(): TournamentMovie[] {
    return [
      { id: 550, title: "Fight Club", posterPath: "/adw6Lq9FiC9zjYEpOqfq03ituwp.jpg", fromUsers: ["mock"] },
      { id: 13, title: "Forrest Gump", posterPath: "/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg", fromUsers: ["mock"] },
      { id: 155, title: "The Dark Knight", posterPath: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg", fromUsers: ["mock"] },
      { id: 497, title: "The Green Mile", posterPath: "/velWPhVMQeQKcxggNEU8YmIo52R.jpg", fromUsers: ["mock"] },
      { id: 680, title: "Pulp Fiction", posterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", fromUsers: ["mock"] },
      { id: 389, title: "12 Angry Men", posterPath: "/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg", fromUsers: ["mock"] },
      { id: 129, title: "Spirited Away", posterPath: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg", fromUsers: ["mock"] },
      { id: 19404, title: "Dilwale Dulhania Le Jayenge", posterPath: "/uC6TTUhPpQCmgldGyYveKRAu8JN.jpg", fromUsers: ["mock"] }
    ]
  }

  private static async createTournamentState(tx: any, roomId: string, movies: TournamentMovie[]): Promise<TournamentState> {
    const totalRounds = Math.ceil(Math.log2(movies.length))
    const firstRoundMatches = this.generateFirstRoundMatches(movies)

    const newState = {
      roomId,
      status: 'round_1' as const,
      currentRound: 1,
      totalRounds,
      currentMatches: firstRoundMatches,
      completedPicks: [],
      allMovies: movies,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await tx.insert(tournamentState).values(newState)

    // Update room status to active
    await tx.update(rooms)
      .set({
        status: 'active',
        startedAt: new Date()
      })
      .where(eq(rooms.id, roomId))

    return this.formatTournamentState(newState, '')
  }

  private static generateFirstRoundMatches(movies: TournamentMovie[]): TournamentMatch[] {
    const shuffled = [...movies].sort(() => Math.random() - 0.5)
    const matches: TournamentMatch[] = []

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({
          matchId: `r1m${Math.floor(i / 2) + 1}`,
          roundNumber: 1,
          movieA: shuffled[i],
          movieB: shuffled[i + 1]
        })
      }
    }

    return matches
  }

  private static checkRoundComplete(
    matches: TournamentMatch[], 
    picks: TournamentPick[], 
    userIds: string[]
  ): boolean {
    for (const match of matches) {
      const matchPicks = picks.filter(p => p.matchId === match.matchId)
      const uniqueUsers = new Set(matchPicks.map(p => p.userId))
      if (uniqueUsers.size < userIds.length) {
        return false
      }
    }
    return true
  }

  private static advanceRound(
    currentRound: number,
    totalRounds: number,
    currentMatches: TournamentMatch[],
    picks: TournamentPick[],
    allMovies: TournamentMovie[]
  ) {
    const winners: TournamentMovie[] = []

    // Determine winners from current round
    for (const match of currentMatches) {
      const matchPicks = picks.filter(p => p.matchId === match.matchId)
      const votes = new Map<number, number>()
      
      matchPicks.forEach(pick => {
        votes.set(pick.selectedMovieId, (votes.get(pick.selectedMovieId) || 0) + 1)
      })

      let winner: TournamentMovie
      if (votes.get(match.movieA.id) > votes.get(match.movieB.id)) {
        winner = match.movieA
      } else if (votes.get(match.movieB.id) > votes.get(match.movieA.id)) {
        winner = match.movieB
      } else {
        // Tie - random selection
        winner = Math.random() < 0.5 ? match.movieA : match.movieB
      }

      winners.push(winner)
    }

    const nextRound = currentRound + 1

    // Check if tournament is complete
    if (winners.length === 1) {
      const winner = winners[0]
      return {
        status: 'completed' as const,
        currentRound: nextRound,
        matches: [],
        winnerMovieId: winner.id,
        winnerTitle: winner.title,
        winnerPosterPath: winner.posterPath
      }
    }

    // Check if this is the final round
    if (winners.length === 2) {
      const finalMatch: TournamentMatch = {
        matchId: `r${nextRound}m1`,
        roundNumber: nextRound,
        movieA: winners[0],
        movieB: winners[1]
      }

      return {
        status: 'final' as const,
        currentRound: nextRound,
        matches: [finalMatch]
      }
    }

    // Generate next round matches
    const nextMatches: TournamentMatch[] = []
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        nextMatches.push({
          matchId: `r${nextRound}m${Math.floor(i / 2) + 1}`,
          roundNumber: nextRound,
          movieA: winners[i],
          movieB: winners[i + 1]
        })
      }
    }

    return {
      status: `round_${nextRound}` as const,
      currentRound: nextRound,
      matches: nextMatches
    }
  }

  private static formatTournamentState(state: any, userId: string): TournamentState {
    const picks = state.completedPicks as TournamentPick[]
    const matches = state.currentMatches as TournamentMatch[]
    
    // Calculate user progress
    const userPicks = picks.filter(p => p.userId === userId)
    const completedMatches = new Set(userPicks.map(p => p.matchId))
    const nextMatch = matches.find(m => !completedMatches.has(m.matchId))

    return {
      roomId: state.roomId,
      status: state.status,
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      currentMatches: matches,
      completedPicks: picks,
      allMovies: state.allMovies as TournamentMovie[],
      winnerMovieId: state.winnerMovieId,
      winnerTitle: state.winnerTitle,
      winnerPosterPath: state.winnerPosterPath,
      version: state.version,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      userProgress: {
        completedPicks: userPicks.length,
        totalPicks: matches.length,
        canAdvance: !nextMatch,
        currentMatch: nextMatch
      }
    }
  }
} 