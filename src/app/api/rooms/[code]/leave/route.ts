import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/security/auth-middleware'
import { withRateLimit } from '@/lib/security/rate-limiting'
import { RoomStateManager, RoomStatus } from '@/lib/room-state-manager'
import { db } from '@/db'
import { rooms, roomParticipants } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

async function handleLeaveRoom(request: Request, props: { params: Promise<{ code: string }> }) {
  try {
    const params = await props.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roomCode = params.code

    // Get the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if user is in the room
    const participant = await db.query.roomParticipants.findFirst({
      where: and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.userId, user.id),
        isNull(roomParticipants.leftAt)
      ),
    })

    if (!participant) {
      return NextResponse.json({ 
        error: 'You are not in this room' 
      }, { status: 400 })
    }

    // 1. Update participant left_at timestamp and set is_active = false
    await db
      .update(roomParticipants)
      .set({
        leftAt: new Date(),
        isActive: false
      })
      .where(eq(roomParticipants.id, participant.id))

    // 2. Get remaining active participants
    const remainingParticipants = await db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, room.id),
          isNull(roomParticipants.leftAt)
        )
      )

    // 3. Update room status based on remaining participants
    let newStatus: RoomStatus
    if (remainingParticipants.length === 0) {
      newStatus = RoomStatus.ABANDONED
    } else if (room.status === 'active') {
      // If tournament was active and someone left, abandon it
      newStatus = RoomStatus.ABANDONED
    } else {
      // If room was waiting and someone left, keep waiting
      newStatus = RoomStatus.WAITING
    }

    // Update room status if needed
    if (room.status !== newStatus) {
      await RoomStateManager.transitionTo(
        room.id, 
        newStatus, 
        { reason: 'participant_left', leftUserId: user.id },
        roomCode
      )
    }

    // 4. Broadcast user_left via Realtime
    await supabase.channel(`room:${roomCode}`)
      .send({
        type: 'broadcast',
        event: 'user_left',
        payload: {
          userId: user.id,
          participantCount: remainingParticipants.length,
          roomStatus: newStatus,
          timestamp: new Date().toISOString()
        }
      })

    // 5. Schedule room closure if empty
    if (remainingParticipants.length === 0) {
      console.log(`Room ${roomCode} is now empty and will be cleaned up`)
    }

    return NextResponse.json({ 
      success: true,
      participantCount: remainingParticipants.length,
      roomStatus: newStatus
    })

  } catch (error) {
    console.error('Error leaving room:', error)
    return NextResponse.json({ 
      error: 'Failed to leave room' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ code: string }> }) {
  return handleLeaveRoom(request, props)
} 