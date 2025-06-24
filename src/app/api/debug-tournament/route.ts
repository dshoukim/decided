import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rooms, roomStates, bracketPicks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SimplifiedTournamentManager } from '@/lib/services/simplified-tournament-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    
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

    // Get room state
    const roomState = await db.query.roomStates.findFirst({
      where: eq(roomStates.roomId, room.id),
    });

    // Get tournament manager cache
    const tournamentManager = SimplifiedTournamentManager.getInstance();
    const cachedTournament = tournamentManager.getCachedTournament(room.id);

    // Get all bracket picks
    const allPicks = await db.query.bracketPicks.findMany({
      where: eq(bracketPicks.roomId, room.id),
    });

    const debugData = {
      roomCode,
      roomId: room.id,
      roomStatus: room.status,
      
      // Database tournament data
      databaseTournamentData: {
        exists: !!room.tournamentData,
        data: room.tournamentData,
        matchCount: room.tournamentData ? (room.tournamentData as any).matches?.length : 0,
        matches: room.tournamentData ? (room.tournamentData as any).matches?.map((m: any) => ({
          matchId: m.matchId,
          roundNumber: m.roundNumber,
          movieA: { id: m.movieA.id, title: m.movieA.title },
          movieB: { id: m.movieB.id, title: m.movieB.title }
        })) : []
      },
      
      // Room state data
      roomStateData: {
        exists: !!roomState?.currentState,
        screen: roomState?.currentState ? (roomState.currentState as any).screen : null,
        tournamentExists: !!(roomState?.currentState as any)?.data?.tournament,
        tournamentMatches: (roomState?.currentState as any)?.data?.tournament?.matches?.map((m: any) => ({
          matchId: m.matchId,
          roundNumber: m.roundNumber,
          movieA: { id: m.movieA.id, title: m.movieA.title },
          movieB: { id: m.movieB.id, title: m.movieB.title }
        })) || []
      },
      
      // Cached tournament data
      cachedTournamentData: {
        exists: !!cachedTournament,
        matchCount: cachedTournament?.matches?.length || 0,
        matches: cachedTournament?.matches?.map(m => ({
          matchId: m.matchId,
          roundNumber: m.roundNumber,
          movieA: { id: m.movieA.id, title: m.movieA.title },
          movieB: { id: m.movieB.id, title: m.movieB.title }
        })) || []
      },
      
      // Bracket picks
      bracketPicks: {
        total: allPicks.length,
        byRound: allPicks.reduce((acc, pick) => {
          acc[pick.roundNumber] = (acc[pick.roundNumber] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
        picks: allPicks.map(pick => ({
          matchId: pick.matchId,
          roundNumber: pick.roundNumber,
          userId: pick.userId,
          selectedMovieId: pick.selectedMovieId,
          movieAId: pick.movieAId,
          movieBId: pick.movieBId
        }))
      },
      
      // Analysis
      analysis: {
        hasPlaceholderInDatabase: !!(room.tournamentData as any)?.matches?.some((m: any) => 
          m.movieA?.title?.includes('Winner of Round') || m.movieB?.title?.includes('Winner of Round')),
        hasPlaceholderInState: !!((roomState?.currentState as any)?.data?.tournament?.matches?.some((m: any) => 
          m.movieA?.title?.includes('Winner of Round') || m.movieB?.title?.includes('Winner of Round'))),
        hasPlaceholderInCache: !!(cachedTournament?.matches?.some(m => 
          m.movieA?.title?.includes('Winner of Round') || m.movieB?.title?.includes('Winner of Round')))
      }
    };

    return NextResponse.json(debugData);

  } catch (error) {
    console.error('Error debugging tournament:', error);
    return NextResponse.json(
      { error: 'Failed to debug tournament' }, 
      { status: 500 }
    );
  }
} 