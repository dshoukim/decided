import { NextResponse } from 'next/server'
import { db } from '@/db'
import { rooms, bracketPicks, roomParticipants } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const { roomCode } = await request.json()
    
    if (!roomCode) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 })
    }

    // Get room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get participants
    const participants = await db.query.roomParticipants.findMany({
      where: and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.isActive, true)
      ),
    })

    // Get tournament data
    const tournament = room.tournamentData as any
    if (!tournament) {
      return NextResponse.json({ error: 'No tournament data' }, { status: 400 })
    }

    const currentRound = tournament.currentRound
    const currentRoundMatches = tournament.matches.filter((m: any) => m.roundNumber === currentRound)

    // Get all picks for current round
    const roundPicks = await db.query.bracketPicks.findMany({
      where: and(
        eq(bracketPicks.roomId, room.id),
        eq(bracketPicks.roundNumber, currentRound)
      ),
    })

    // Analyze pick status per match
    const matchStatus = currentRoundMatches.map((match: any) => {
      const matchPicks = roundPicks.filter(pick => pick.matchId === match.matchId)
      const uniqueUsers = new Set(matchPicks.map(pick => pick.userId))
      
      return {
        matchId: match.matchId,
        movieA: match.movieA.title,
        movieB: match.movieB.title,
        totalPicks: matchPicks.length,
        uniqueUsers: uniqueUsers.size,
        userPicks: matchPicks.map(pick => ({
          userId: pick.userId,
          selectedMovie: pick.selectedMovieId === match.movieA.id ? match.movieA.title : match.movieB.title,
          selectedMovieId: pick.selectedMovieId
        })),
        isComplete: uniqueUsers.size >= 2
      }
    })

    const allMatchesComplete = matchStatus.every((m: any) => m.isComplete)

    return NextResponse.json({ 
      success: true,
      roomCode,
      currentRound,
      totalMatches: currentRoundMatches.length,
      totalPicks: roundPicks.length,
      activeParticipants: participants.length,
      participantIds: participants.map(p => p.userId),
      allMatchesComplete,
      canAdvance: allMatchesComplete,
      matchStatus
    })

  } catch (error) {
    console.error('Error checking pick status:', error)
    return NextResponse.json({ 
      error: 'Failed to check pick status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 