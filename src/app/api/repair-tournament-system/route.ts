import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rooms, roomStates, bracketPicks, matchCompletions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    
    if (!roomCode) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 });
    }

    console.log(`🔧 [REPAIR] Starting repair for room ${roomCode}`);

    // Get room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const roomId = room.id;
    
    // Step 1: Clear all tournament-related data
    console.log(`🔧 [REPAIR] Clearing bracket picks...`);
    const deletedPicks = await db.delete(bracketPicks)
      .where(eq(bracketPicks.roomId, roomId));
    
    console.log(`🔧 [REPAIR] Clearing match completions...`);
    const deletedCompletions = await db.delete(matchCompletions)
      .where(eq(matchCompletions.roomId, roomId));
    
    console.log(`🔧 [REPAIR] Clearing room state...`);
    const deletedStates = await db.delete(roomStates)
      .where(eq(roomStates.roomId, roomId));
    
    // Step 2: Reset room to waiting status and clear tournament data
    console.log(`🔧 [REPAIR] Resetting room status...`);
    await db
      .update(rooms)
      .set({
        status: 'waiting',
        startedAt: null,
        completedAt: null,
        closedAt: null,
        tournamentData: null,
        winnerMovieId: null,
        winnerTitle: null,
        winnerPosterPath: null,
      })
      .where(eq(rooms.id, roomId));

    // Step 3: Reset participant data
    console.log(`🔧 [REPAIR] Resetting participant data...`);
    await db.execute(`
      UPDATE room_participants 
      SET 
        completed_matches = '{}',
        current_match_index = 0
      WHERE room_id = '${roomId}'
    `);

    console.log(`🔧 [REPAIR] Repair completed successfully!`);

    return NextResponse.json({
      success: true,
      message: `Room ${roomCode} has been reset and is ready for a fresh tournament`,
      cleared: {
        bracketPicks: deletedPicks,
        matchCompletions: deletedCompletions,
        roomStates: deletedStates,
      }
    });

  } catch (error) {
    console.error('Error repairing tournament system:', error);
    return NextResponse.json(
      { error: 'Failed to repair tournament system' }, 
      { status: 500 }
    );
  }
} 