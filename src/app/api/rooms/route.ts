import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { customAlphabet } from 'nanoid'
import { db } from '@/db'
import { rooms, roomParticipants } from '@/db/schema'

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

export async function POST(request: Request) {
  console.log('POST /api/rooms called')
  
  // Temporary: Accept userId from request body
  const body = await request.json()
  const { userId } = body
  console.log('Request body:', body)
  console.log('userId from body:', userId)
  
  let authenticatedUserId: string
  
  if (!userId) {
    // Try to get user from Supabase auth
    const supabase = await createClient()
    console.log('Supabase client created:', !!supabase)
    
    const { data: { user }, error } = await supabase.auth.getUser()
    console.log('Auth check result:', { user: !!user, error })

    if (!user) {
      console.log('No user found - returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Use the authenticated user's ID
    authenticatedUserId = user.id
  } else {
    // Use the provided userId
    authenticatedUserId = userId
  }

  try {
    const roomCode = nanoid()
    
    // 1. Create the room
    const newRoom = await db
      .insert(rooms)
      .values({
        code: roomCode,
        ownerId: authenticatedUserId,
      })
      .returning()

    // 2. Automatically add the owner as the first (active) participant
    await db
      .insert(roomParticipants)
      .values({
        roomId: newRoom[0].id,
        userId: authenticatedUserId,
        isActive: true,
      })

    return NextResponse.json({ success: true, room: newRoom[0] })
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({ success: false, error: 'Failed to create room' }, { status: 500 })
  }
} 