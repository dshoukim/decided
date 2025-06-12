import assert from 'node:assert/strict'
import { buildTournamentBroadcastPayload } from '../src/lib/utils/tournament.ts'

// Mock data
const tournament = {
  id: 't1',
  totalRounds: 2,
  matches: [
    {
      matchId: 'm1',
      roundNumber: 1,
      movieA: { id: 1, title: 'A' } as any,
      movieB: { id: 2, title: 'B' } as any,
    },
    {
      matchId: 'm2',
      roundNumber: 2,
      movieA: { id: 3, title: 'C' } as any,
      movieB: { id: 4, title: 'D' } as any,
    },
  ],
}

const payload = buildTournamentBroadcastPayload(tournament as any)
assert.equal(payload.tournamentId, 't1')
assert.equal(payload.totalMovies, 4)
assert.equal(payload.totalRounds, 2)
assert.equal(payload.matchups.length, 2)
assert.equal(payload.type, 'tournament_started')
console.log('✅ tournament utils tests passed') 