import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRoomChannelName } from '@/lib/utils/realtime'
import { buildTournamentBroadcastPayload } from '@/lib/utils/tournament'
import { db } from '@/db'
import { rooms, roomParticipants, roomHistory } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { TournamentEngine } from '@/lib/tournament-engine'
import { TransactionManager } from '@/lib/db/transactions'
import { TournamentMetrics } from '@/lib/monitoring/tournament-metrics'
import { withAuth } from '@/lib/security/auth-middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limiting'

export async function POST(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params
  
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.TOURNAMENT_START, 'tournament-start');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Authentication and authorization
  const authResult = await withAuth(request, { requireCompleteProfile: true });
  if (!authResult.success) {
    return authResult.response;
  }
  const user = authResult.user!;

  const roomCode = params.code;
  const startTime = Date.now();

  try {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
      with: {
        participants: {
          where: eq(roomParticipants.isActive, true)
        },
      },
    });

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.ownerId !== user.id) {
      return NextResponse.json({ success: false, error: 'Only the room owner can start the session' }, { status: 403 });
    }

    const activeParticipants = (room.participants as any[]) || [];
    if (activeParticipants.length !== 2) {
      return NextResponse.json({ 
        success: false, 
        error: `Room must have exactly 2 participants to start. Found ${activeParticipants.length}` 
      }, { status: 400 });
    }

    if (room.status !== 'waiting') {
      if (room.status === 'active' && room.tournamentData) {
        // Idempotent: return existing tournament details so client can proceed
        const tournament = room.tournamentData as any
        return NextResponse.json({
          success: true,
          room,
          tournament: {
            id: tournament.id,
            totalRounds: tournament.totalRounds,
            currentRound: tournament.currentRound,
            firstRoundMatches: tournament.matches.filter((m: any) => m.roundNumber === 1),
          }
        })
      }
      return NextResponse.json({ 
        success: false, 
        error: `Room is already ${room.status}` 
      }, { status: 400 });
    }

    // Extract participant user IDs
    const participantIds = activeParticipants.map((p: any) => p.userId);
    const [userAId, userBId] = participantIds;

    // Generate tournament using the tournament engine
    const tournament = await TournamentMetrics.measureAsync(
      'tournament_generation',
      { roomId: room.id, participantCount: 2, movieCount: 0 },
      async () => TournamentEngine.generateTournament(userAId, userBId)
    );

    // Use atomic transaction to update room state and save tournament data
    await TransactionManager.executeInTransaction(async (tx) => {
      // Update room status and tournament data
      await tx
        .update(rooms)
        .set({
          status: 'active',
          startedAt: new Date(),
          tournamentData: tournament,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(rooms.id, room.id));

             // Log tournament start event
       await tx.insert(roomHistory).values({
        roomId: room.id,
        eventType: 'tournament_started',
        eventData: {
          participantIds,
          totalRounds: tournament.totalRounds,
          totalMatches: tournament.matches.length,
        },
      });
    });

    // Track metrics
    const generationTime = Date.now() - startTime;
    await TournamentMetrics.trackTournamentGeneration(
      room.id,
      2,
      tournament.matches.length,
      generationTime
    );

    await TournamentMetrics.trackUserEvent('tournament_started', user.id, {
      room_code: roomCode,
      tournament_id: tournament.id,
      total_rounds: tournament.totalRounds,
    });

    // Broadcast the 'tournament_started' event to the room's Realtime channel
    try {
      const supabaseAdmin = await createClient();
      const payload = buildTournamentBroadcastPayload(tournament as any)

      await supabaseAdmin.channel(getRoomChannelName(roomCode)).send({
        type: 'broadcast',
        event: 'tournament_started',
        payload,
      });
    } catch (broadcastError) {
      console.error('Failed to broadcast tournament_started:', broadcastError);
    }

    return NextResponse.json({ 
      success: true, 
      room: { ...room, status: 'active', tournamentData: tournament },
      tournament: {
        id: tournament.id,
        totalRounds: tournament.totalRounds,
        currentRound: tournament.currentRound,
        firstRoundMatches: tournament.matches.filter(m => m.roundNumber === 1),
      }
    });

  } catch (error) {
    console.error('Error starting room:', error);
    
    await TournamentMetrics.trackError('tournament_start', error as Error, {
      room_code: roomCode,
      user_id: user.id,
    });

    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start tournament'
    }, { status: 500 });
  }
} 