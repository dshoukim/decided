import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { rooms, roomParticipants, roomStates } from '@/db/schema';
import { customAlphabet } from 'nanoid';
import { RoomStateManager, RoomState } from '@/lib/services/room-state-manager';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate unique room code
    const roomCode = nanoid();

    // Create room
    const [room] = await db
      .insert(rooms)
      .values({
        code: roomCode,
        ownerId: user.id,
        status: 'waiting',
      })
      .returning();

    // Add owner as participant
    await db
      .insert(roomParticipants)
      .values({
        roomId: room.id,
        userId: user.id,
        isActive: true,
      });

    // Create initial room state
    const stateManager = RoomStateManager.getInstance();
    const initialState: RoomState = {
      version: 0,
      screen: 'lobby',
      data: {
        room: {
          code: roomCode,
          participants: [{
            userId: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
            avatarUrl: user.user_metadata?.avatar_url,
            isActive: true,
            isReady: false,
            isOwner: true,
          }],
        },
      },
      availableActions: ['leave'],
      lastUpdated: new Date().toISOString(),
    };

    await stateManager.saveState(room.id, initialState, user.id);

    return NextResponse.json({ 
      success: true,
      roomCode: room.code 
    });

  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ 
      error: 'Failed to create room' 
    }, { status: 500 });
  }
} 