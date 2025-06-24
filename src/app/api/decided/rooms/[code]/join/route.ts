import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { rooms, roomParticipants, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { RoomStateManager } from '@/lib/services/room-state-manager';

export async function POST(
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

    if (room.status !== 'waiting') {
      return NextResponse.json({ 
        error: 'Room is not accepting new participants' 
      }, { status: 400 });
    }

    // Check if already a participant
    const existingParticipant = await db.query.roomParticipants.findFirst({
      where: and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.userId, user.id)
      ),
    });

    const stateManager = RoomStateManager.getInstance();

    if (existingParticipant) {
      if (existingParticipant.isActive) {
        return NextResponse.json({ 
          success: true,
          message: 'Already in room' 
        });
      }

      // Reactivate participant
      await db
        .update(roomParticipants)
        .set({
          isActive: true,
          leftAt: null,
        })
        .where(eq(roomParticipants.id, existingParticipant.id));
    } else {
      // Check room capacity first by getting current participant count
      const currentParticipants = await db.query.roomParticipants.findMany({
        where: and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.isActive, true)
        ),
      });

      if (currentParticipants.length >= 2) {
        return NextResponse.json({ 
          error: 'Room is full' 
        }, { status: 400 });
      }

      // Get user profile
      const userProfile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      if (!userProfile) {
        return NextResponse.json({ 
          error: 'User profile not found' 
        }, { status: 400 });
      }

      // Add as participant
      await db
        .insert(roomParticipants)
        .values({
          roomId: room.id,
          userId: user.id,
          isActive: true,
        });
    }

    // Now rebuild state from the updated participants in the database
    const freshState = await stateManager.rebuildFromParticipants(room.id);
    
    // Save the fresh state - this will broadcast to all connected users
    await stateManager.saveState(room.id, freshState, user.id);

    return NextResponse.json({ 
      success: true 
    });

  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ 
      error: 'Failed to join room' 
    }, { status: 500 });
  }
} 