import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TournamentProgress } from '@/lib/tournament-engine'
import { db } from '@/db'
import { rooms } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

    console.log('🧪 Testing round advancement for room:', roomCode)
    
    // Check if round can advance
    const canAdvance = await TournamentProgress.canAdvanceRound(room.id)
    console.log('🧪 Can advance round:', canAdvance)
    
    if (canAdvance) {
      // Try to advance the round
      const nextMatches = await TournamentProgress.advanceRound(room.id)
      console.log('🧪 Advanced to next round with matches:', nextMatches.length)
      
      // Get updated tournament state
      const updatedRoom = await db.query.rooms.findFirst({
        where: eq(rooms.id, room.id),
      })
      
      const tournament = updatedRoom?.tournamentData as any
      
      return NextResponse.json({ 
        success: true,
        canAdvance,
        nextMatches: nextMatches.length,
        isFinalRound: tournament?.isFinalRound,
        finalMovies: tournament?.finalMovies?.length,
        currentRound: tournament?.currentRound
      })
    } else {
      return NextResponse.json({ 
        success: false,
        canAdvance,
        message: 'Round cannot advance yet'
      })
    }

  } catch (error) {
    console.error('Error in test advance round:', error)
    return NextResponse.json({ 
      error: 'Failed to test round advancement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 