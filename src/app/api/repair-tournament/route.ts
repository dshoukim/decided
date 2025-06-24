import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { rooms, bracketPicks, roomParticipants } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const { roomCode, matchId, movieAId, movieBId } = await request.json()
    
    if (!roomCode || !matchId) {
      return NextResponse.json({ error: 'Room code and match ID required' }, { status: 400 })
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

    if (participants.length !== 2) {
      return NextResponse.json({ error: 'Need exactly 2 participants' }, { status: 400 })
    }

    console.log('🔧 Repairing missing picks for match:', matchId)

    // Add picks for both users (randomly choose between the two movies)
    const repairPicks = participants.map((participant, index) => ({
      roomId: room.id,
      userId: participant.userId,
      matchId,
      roundNumber: 1, // Current round
      movieAId,
      movieBId,
      selectedMovieId: index === 0 ? movieAId : movieBId, // Alternate choices
      responseTimeMs: 1000, // Fake response time
    }))

    // Insert the repair picks
    await db.insert(bracketPicks).values(repairPicks)

    console.log('✅ Added repair picks:', repairPicks)

    return NextResponse.json({ 
      success: true,
      message: 'Repair picks added',
      addedPicks: repairPicks.length
    })

  } catch (error) {
    console.error('Error repairing tournament:', error)
    return NextResponse.json({ 
      error: 'Failed to repair tournament',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 