import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/security/auth-middleware'
import { db } from '@/db'
import { rooms, bracketPicks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params

  // Authentication and authorization
  const authResult = await withAuth(request, { requireCompleteProfile: true });
  if (!authResult.success) {
    return authResult.response;
  }
  const user = authResult.user!;

  const roomCode = params.code;

  try {
    // Get room with tournament data
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status !== 'active' || !room.tournamentData) {
      return NextResponse.json({ 
        currentMatch: null,
        message: 'No active tournament',
        completedCount: 0,
        totalCount: 0
      });
    }

    const tournament = room.tournamentData as any;

    // Get user's completed picks
    const userPicks = await db.query.bracketPicks.findMany({
      where: and(
        eq(bracketPicks.roomId, room.id),
        eq(bracketPicks.userId, user.id)
      ),
    });

    const completedMatches = userPicks.map(pick => pick.matchId);
    
    console.log(`🔍 [CURRENT-MATCH] User ${user.id} in room ${roomCode}:`, {
      completedMatches: completedMatches.length,
      completedMatchIds: completedMatches
    });

    // Get current round matches
    const currentRound = tournament.currentRound || 1;
    const currentRoundMatches = tournament.matches.filter((m: any) => 
      m.roundNumber === currentRound
    );

    console.log(`🔍 [CURRENT-MATCH] Round ${currentRound} has ${currentRoundMatches.length} matches`);

    // Find first uncompleted match
    let nextMatch = null;
    for (const match of currentRoundMatches) {
      if (!completedMatches.includes(match.matchId)) {
        nextMatch = match;
        break;
      }
    }

    const debug = {
      userId: user.id.substring(0, 8) + '...',
      roomCode,
      currentRound,
      totalMatches: currentRoundMatches.length,
      completedCount: completedMatches.length,
      nextMatchId: nextMatch?.matchId || null,
      allMatches: currentRoundMatches.map((m: any) => ({
        matchId: m.matchId,
        completed: completedMatches.includes(m.matchId)
      }))
    };

    console.log(`🎯 [CURRENT-MATCH] Result:`, debug);

    return NextResponse.json({
      currentMatch: nextMatch,
      completedCount: completedMatches.length,
      totalCount: currentRoundMatches.length,
      message: nextMatch ? 
        `Match ${nextMatch.matchId} ready for user` : 
        'All matches completed for current round',
      debug
    });

  } catch (error) {
    console.error('Error fetching current match:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current match' },
      { status: 500 }
    );
  }
} 