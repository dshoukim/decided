import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { RoomStateManager } from '@/lib/services/room-state-manager';

export async function POST(request: NextRequest) {
  try {
    const { roomCode } = await request.json();
    
    if (!roomCode) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 });
    }

    // Get room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Clear cache and force fresh state load
    const stateManager = RoomStateManager.getInstance();
    stateManager.clearCache(room.id);

    console.log(`🔄 [REFRESH-ROOM] Refreshed room ${roomCode} - cache cleared`);

    return NextResponse.json({
      success: true,
      message: `Room ${roomCode} state refreshed`,
      room: {
        code: room.code,
        status: room.status,
        hasTournamentData: !!room.tournamentData,
      }
    });

  } catch (error) {
    console.error('Error refreshing room:', error);
    return NextResponse.json(
      { error: 'Failed to refresh room', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 