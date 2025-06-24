import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { rooms, roomParticipants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ActionProcessor, Action } from '@/lib/services/action-processor';
import { TournamentEngine } from '@/lib/tournament-engine';
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
    const body = await request.json();

    // Validate request body
    if (!body.action) {
      return NextResponse.json({ 
        error: 'Action is required' 
      }, { status: 400 });
    }

    const validActions = ['start', 'pick', 'leave', 'extend'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json({ 
        error: 'Invalid action' 
      }, { status: 400 });
    }

    // Get room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if user is an active participant
    const participant = await db.query.roomParticipants.findFirst({
      where: and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.userId, user.id),
        eq(roomParticipants.isActive, true)
      ),
    });

    if (!participant) {
      return NextResponse.json({ 
        error: 'Not an active participant of this room' 
      }, { status: 403 });
    }

    // Process action
    const processor = ActionProcessor.getInstance();
    const action: Action = {
      action: body.action,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
    };

    const result = await processor.process(room.id, user.id, action);

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Action failed' 
      }, { status: 400 });
    }

    // Get personalized state for this user
    const stateManager = RoomStateManager.getInstance();
    const personalizedState = await stateManager.getState(room.id, user.id);

    return NextResponse.json({ 
      success: true,
      state: personalizedState 
    });

  } catch (error) {
    console.error('Error processing action:', error);
    return NextResponse.json({ 
      error: 'Failed to process action' 
    }, { status: 500 });
  }
} 