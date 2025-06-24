import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { rooms, roomParticipants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { RoomStateManager } from '@/lib/services/room-state-manager';

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const roomCode = params.code;

  // Get room
  const room = await db.query.rooms.findFirst({
    where: eq(rooms.code, roomCode),
  });

  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check if user is a participant
  const participant = await db.query.roomParticipants.findFirst({
    where: and(
      eq(roomParticipants.roomId, room.id),
      eq(roomParticipants.userId, user.id)
    ),
  });

  if (!participant) {
    return new Response(JSON.stringify({ error: 'Not a participant' }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stateManager = RoomStateManager.getInstance();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      try {
        const initialState = await stateManager.getState(room.id, user.id);
        const data = `data: ${JSON.stringify(initialState)}\n\n`;
        controller.enqueue(encoder.encode(data));
      } catch (error) {
        console.error('Error sending initial state:', error);
      }

      // Set up heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          // Connection closed
          clearInterval(heartbeat);
        }
      }, 30000); // Every 30 seconds

      // Subscribe to state changes
      const unsubscribe = stateManager.subscribe(room.id, async (newState) => {
        try {
          // Use the updated state directly and personalize it for this user
          const personalizedState = await stateManager.personalizeState(newState, user.id, room.id);
          const data = `data: ${JSON.stringify(personalizedState)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          console.error('Error sending state update:', error);
        }
      });

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
} 