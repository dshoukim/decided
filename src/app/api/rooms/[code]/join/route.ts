import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/security/auth-middleware'
import { withRateLimit } from '@/lib/security/rate-limiting'
import { RoomStateManager } from '@/lib/room-state-manager'
import { db } from '@/db'
import { rooms, roomParticipants, users } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

async function handleJoinRoom(request: Request, props: { params: Promise<{ code: string }> }) {
  try {
    const params = await props.params
    // Accept userId from request body
    const body = await request.json()
    const { userId } = body
    
    let authenticatedUserId: string
    
    if (!userId) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      authenticatedUserId = user.id
    } else {
      authenticatedUserId = userId
    }

    const roomCode = params.code

    // Get the room
    const room = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, roomCode))
      .limit(1)

    if (room.length === 0) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const currentRoom = room[0]

    // Validate room status - must be 'waiting'
    if (currentRoom.status !== 'waiting') {
      return NextResponse.json({ 
        error: 'Cannot join room - room is not in waiting state' 
      }, { status: 400 })
    }

    // Check current participant count
    const participants = await db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, currentRoom.id),
          isNull(roomParticipants.leftAt)
        )
      )

    // Validate participant count (max 2)
    if (participants.length >= 2) {
      return NextResponse.json({ 
        error: 'Room is full - maximum 2 participants allowed' 
      }, { status: 400 })
    }

    // Check if user is already in the room
    const existingParticipant = participants.find(p => p.userId === authenticatedUserId)
    if (existingParticipant) {
      return NextResponse.json({ 
        error: 'You are already in this room' 
      }, { status: 400 })
    }

    // Check profile completeness
    const userProfile = await db
      .select()
      .from(users)
      .where(eq(users.id, authenticatedUserId))
      .limit(1)

    if (userProfile.length === 0) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 400 })
    }

    const profile = userProfile[0]

    // Check if user has selected genres and streaming services
    if (!profile.selectedGenres || profile.selectedGenres.length === 0 || 
        !profile.streamingServices || profile.streamingServices.length === 0) {
      return NextResponse.json({ 
        error: 'Please complete your preferences (genres and streaming services) before joining rooms' 
      }, { status: 400 })
    }

    // Add user to room
    await db
      .insert(roomParticipants)
      .values({
        roomId: currentRoom.id,
        userId: authenticatedUserId,
        isActive: true
      })
      .returning()

    // Broadcast join event via Realtime
    const supabaseAdmin = await createClient()
    await supabaseAdmin.channel(`room:${roomCode}`)
      .send({
        type: 'broadcast',
        event: 'user_joined',
        payload: {
          userId: authenticatedUserId,
          participantCount: participants.length + 1,
          roomStatus: currentRoom.status
        }
      })

    return NextResponse.json({ 
      success: true, 
      roomId: currentRoom.id,
      participantCount: participants.length + 1
    })

  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json({ 
      error: 'Failed to join room' 
    }, { status: 500 })
  }
}

export async function POST(request: Request, props: { params: Promise<{ code: string }> }) {
  return handleJoinRoom(request, props)
} 