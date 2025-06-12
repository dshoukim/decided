import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/security/auth-middleware';
import { withRateLimit } from '@/lib/security/rate-limiting';
import { RoomStateManager, RoomStatus } from '@/lib/room-state-manager';
import { TournamentMetrics } from '@/lib/monitoring/tournament-metrics';
import { db } from '@/db';
import { rooms, roomParticipants, watchList, bracketPicks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Tournament, TournamentMovie } from '@/lib/tournament-engine';

async function handleWinnerDetermination(request: Request, props: { params: Promise<{ code: string }> }) {
  try {
    const params = await props.params
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roomCode = params.code;
    const { finalPickUserA, finalPickUserB } = await request.json();

    // Get the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Validate room is in active state
    const stateValidation = await RoomStateManager.validateStateForOperation(
      room.id, 
      RoomStatus.ACTIVE
    );

    if (!stateValidation.valid) {
      return NextResponse.json({ 
        error: stateValidation.error || 'Invalid room state for winner determination' 
      }, { status: 400 });
    }

    // Get participants
    const participants = await db.query.roomParticipants.findMany({
      where: and(
        eq(roomParticipants.roomId, room.id),
        eq(roomParticipants.isActive, true)
      ),
    });

    if (participants.length !== 2) {
      return NextResponse.json({ 
        error: 'Tournament requires exactly 2 participants' 
      }, { status: 400 });
    }

    const [userA, userB] = participants;

    // 1. Validate both users made final picks
    if (!finalPickUserA || !finalPickUserB) {
      return NextResponse.json({ 
        error: 'Both users must make final picks' 
      }, { status: 400 });
    }

    // Get tournament data
    if (!room.tournamentData) {
      return NextResponse.json({ 
        error: 'Room has no tournament data' 
      }, { status: 400 });
    }

    const tournament = room.tournamentData as Tournament;

    // 2. Determine winner based on final picks
    let winnerMovie: TournamentMovie;
    
    if (finalPickUserA === finalPickUserB) {
      // Both users picked the same movie - that's the winner
      winnerMovie = finalPickUserA;
    } else {
      // Users picked different movies - use ELO or random selection
      // For MVP, we'll use random selection weighted by ELO if available
      const movies = [finalPickUserA, finalPickUserB];
      winnerMovie = movies[Math.floor(Math.random() * movies.length)];
    }

    // 3. Update room with winner information
    const winnerData = {
      winnerMovie,
      finalPickUserA,
      finalPickUserB,
      completedAt: new Date().toISOString(),
      participants: participants.map(p => p.userId)
    };

    await db
      .update(rooms)
      .set({ 
        winnerMovieId: winnerMovie.id,
        winnerTitle: winnerMovie.title,
        winnerPosterPath: winnerMovie.posterPath,
        completedAt: new Date(),
        tournamentData: {
          ...tournament,
          winnerData
        }
      })
      .where(eq(rooms.id, room.id));

    // 4. Add movie to both users' watchlists with decided_together_room_id
    const watchlistEntries = participants.map(participant => ({
      userId: participant.userId,
      tmdbMovieId: winnerMovie.id,
      movieTitle: winnerMovie.title,
      movieData: winnerMovie.movieData ? JSON.stringify(winnerMovie.movieData) : null,
      addedFrom: 'decided_together',
      decidedTogetherRoomId: room.id,
      pendingRating: true,
      isWatched: false,
      addedAt: new Date().toISOString()
    }));

    await db.insert(watchList).values(watchlistEntries);

    // 5. Set pending_rating = true for both users (already done above)
    
    // 6. Update room status to 'completed'
    await RoomStateManager.transitionTo(
      room.id,
      RoomStatus.COMPLETED,
      { 
        winnerMovie: winnerMovie.title,
        tournamentId: tournament.id,
        completedAt: new Date().toISOString()
      },
      roomCode
    );

    // 7. Broadcast winner announcement
    await supabase.channel(`room:${roomCode}`)
      .send({
        type: 'broadcast',
        event: 'tournament_completed',
        payload: {
          winner: winnerMovie,
          completedAt: new Date().toISOString(),
          addedToWatchlists: true,
          roomStatus: RoomStatus.COMPLETED
        }
      });

    // Track metrics
    await TournamentMetrics.trackRoundCompletion(
      room.id,
      tournament.currentRound || 1,
      Date.now() - new Date(room.startedAt || Date.now()).getTime(),
      participants.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {})
    );

    return NextResponse.json({ 
      success: true, 
      winner: winnerMovie,
      addedToWatchlists: true,
      roomStatus: RoomStatus.COMPLETED
    });

  } catch (error) {
    console.error('Error determining winner:', error);
    return NextResponse.json({ 
      error: 'Failed to determine tournament winner' 
    }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ code: string }> }) {
  return handleWinnerDetermination(request, props)
} 