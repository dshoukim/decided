import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { rooms, roomParticipants, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  let authenticatedUserId: string
  
  if (!userId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    authenticatedUserId = user.id
  } else {
    authenticatedUserId = userId
  }

  const roomCode = params.code

  try {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
      with: {
        participants: {
          with: {
            user: true,
          },
        },
      },
    })

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 })
    }

    // Extract tournament data if room is active and has tournament data
    const response: any = { success: true, room }
    if (room.status === 'active' && room.tournamentData) {
      response.tournament = room.tournamentData
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting room:', error)
    return NextResponse.json({ success: false, error: 'Failed to get room' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roomCode = params.code

  try {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    })

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 })
    }

    const newParticipant = await db
      .insert(roomParticipants)
      .values({
        roomId: room.id,
        userId: user.id,
      })
      .returning()

    return NextResponse.json({ success: true, participant: newParticipant[0] })
  } catch (error: any) {
    console.error('Error joining room:', error)
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json({ success: false, error: 'User already in room' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: 'Failed to join room' }, { status: 500 })
  }
} 