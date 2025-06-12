import { TournamentMatch } from '@/lib/stores/tournamentStore'

export interface TournamentBroadcastPayload {
  type: 'tournament_started'
  tournamentId: string
  totalMovies: number
  totalRounds: number
  matchups: Array<{
    matchId: string
    roundNumber: number
    movieA: { id: number; title: string; poster_path?: string }
    movieB: { id: number; title: string; poster_path?: string }
  }>
}

export function buildTournamentBroadcastPayload(tournament: {
  id: string
  totalRounds: number
  matches: TournamentMatch[]
}): TournamentBroadcastPayload {
  const totalMovies = new Set(
    tournament.matches.flatMap((m) => [m.movieA.id, m.movieB.id])
  ).size

  return {
    type: 'tournament_started',
    tournamentId: tournament.id,
    totalMovies,
    totalRounds: tournament.totalRounds,
    matchups: tournament.matches.map((m) => ({
      matchId: m.matchId,
      roundNumber: m.roundNumber,
      movieA: {
        id: m.movieA.id,
        title: m.movieA.title,
        poster_path: (m.movieA as any).poster_path ?? (m.movieA as any).posterPath,
      },
      movieB: {
        id: m.movieB.id,
        title: m.movieB.title,
        poster_path: (m.movieB as any).poster_path ?? (m.movieB as any).posterPath,
      },
    })),
  }
} 