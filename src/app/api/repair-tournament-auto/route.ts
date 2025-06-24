import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { rooms, roomStates, bracketPicks, matchCompletions, roomParticipants } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { SimplifiedTournamentManager } from '@/lib/services/simplified-tournament-manager'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomCode = searchParams.get('roomCode')
    const forceClear = searchParams.get('forceClear') === 'true'
    
    // Clear all caches first
    const tournamentManager = SimplifiedTournamentManager.getInstance()
    
    if (roomCode) {
      // Clear specific room
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.code, roomCode),
      })
      
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      }
      
      // Always clear cache if forceClear is true
      if (forceClear) {
        await tournamentManager.clearCache(roomCode)
        console.log(`🧹 [REPAIR] Force cleared cache for room ${roomCode}`)
      }
      
      // Check for placeholders in database
      let hadPlaceholders = false
      if (room.tournamentData) {
        const tournamentData = room.tournamentData as any
        if (tournamentData.matches) {
          for (const match of tournamentData.matches) {
            if (match.movieA?.title?.includes('Winner of Round') || 
                match.movieB?.title?.includes('Winner of Round') ||
                match.movieA?.id < 0 || match.movieB?.id < 0) {
              hadPlaceholders = true
              break
            }
          }
        }
      }
      
      // Check room state for placeholders
      const roomState = await db.query.roomStates.findFirst({
        where: eq(roomStates.roomId, room.id),
      })
      
      if (roomState?.currentState) {
        const state = roomState.currentState as any
        if (state.tournament?.matches) {
          for (const match of state.tournament.matches) {
            if (match.movieA?.title?.includes('Winner of Round') || 
                match.movieB?.title?.includes('Winner of Round') ||
                match.movieA?.id < 0 || match.movieB?.id < 0) {
              hadPlaceholders = true
              break
            }
          }
        }
      }
      
      if (hadPlaceholders || forceClear) {
        // Clear tournament data
        await db
          .update(rooms)
          .set({ tournamentData: null })
          .where(eq(rooms.id, room.id))
        
        // Clear room state tournament data
        if (roomState?.currentState) {
          const state = roomState.currentState as any
          if (state.tournament) {
            delete state.tournament
            await db
              .update(roomStates)
              .set({ currentState: state })
              .where(eq(roomStates.roomId, room.id))
          }
        }
        
        // Clear all related picks and completions
        await db.delete(bracketPicks).where(eq(bracketPicks.roomId, room.id))
        await db.delete(matchCompletions).where(eq(matchCompletions.roomId, room.id))
        
        // Clear cache
        await tournamentManager.clearCache(roomCode)
        
        console.log(`🧹 [REPAIR] Cleaned room ${roomCode} with placeholders`)
        
        return NextResponse.json({
          success: true,
          message: `Room ${roomCode} tournament data cleaned and reset`,
          hadPlaceholders: true
        })
      }
      
      return NextResponse.json({
        success: true,
        message: `Room ${roomCode} tournament data is already clean`,
        hadPlaceholders: false
      })
      
    } else {
      // Clear all rooms with placeholders
      let cleanedRooms = 0
      
      const allRooms = await db.query.rooms.findMany({
        where: and(
          eq(rooms.status, 'active')
        )
      })
      
      for (const room of allRooms) {
        let hasPlaceholders = false
        
        if (room.tournamentData) {
          const tournamentData = room.tournamentData as any
          if (tournamentData.matches) {
            for (const match of tournamentData.matches) {
              if (match.movieA?.title?.includes('Winner of Round') || 
                  match.movieB?.title?.includes('Winner of Round') ||
                  match.movieA?.id < 0 || match.movieB?.id < 0) {
                hasPlaceholders = true
                break
              }
            }
          }
        }
        
        if (hasPlaceholders) {
          // Clean this room
          await db
            .update(rooms)
            .set({ tournamentData: null })
            .where(eq(rooms.id, room.id))
          
          await db.delete(bracketPicks).where(eq(bracketPicks.roomId, room.id))
          await db.delete(matchCompletions).where(eq(matchCompletions.roomId, room.id))
          
          await tournamentManager.clearCache(room.code)
          cleanedRooms++
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Cleaned ${cleanedRooms} rooms with placeholder matches`,
        cleanedRooms
      })
    }
    
  } catch (error) {
    console.error('Error repairing tournaments:', error)
    return NextResponse.json(
      { error: 'Failed to repair tournaments' }, 
      { status: 500 }
    )
  }
} 