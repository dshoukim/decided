import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { rooms, roomParticipants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { RoomStateManager } from '@/lib/services/room-state-manager';

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roomCode = params.code;

    // Get room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if user is a participant
    const participant = await db.query.roomParticipants.findFirst({
      where: and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.userId, user.id)
      ),
    });

    if (!participant) {
      return NextResponse.json({ 
        error: 'Not a participant of this room' 
      }, { status: 403 });
    }

    // Get current state
    const stateManager = RoomStateManager.getInstance();
    const state = await stateManager.getState(room.id, user.id);

    // Add cache headers for efficient polling
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return NextResponse.json(state, { headers });

  } catch (error) {
    console.error('Error getting room state:', error);
    return NextResponse.json({ 
      error: 'Failed to get room state' 
    }, { status: 500 });
  }
} 