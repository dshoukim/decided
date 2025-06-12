import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { rooms, bracketPicks, userMovieElo } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { updateElo } from '@/lib/elo'
import { EloBatchProcessor } from '@/lib/services/elo-batch-processor'
import { TournamentMetrics } from '@/lib/monitoring/tournament-metrics'
import { TournamentProgress } from '@/lib/tournament-engine'
import { withAuth } from '@/lib/security/auth-middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limiting'
import { z } from 'zod'

const pickSchema = z.object({
  matchId: z.string(),
  roundNumber: z.number(),
  movieAId: z.number(),
  movieBId: z.number(),
  selectedMovieId: z.number(),
  responseTimeMs: z.number().optional(),
})

export async function PATCH(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params
  
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.BRACKET_PICKS, 'bracket-picks');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Authentication
  const authResult = await withAuth(request, { requireCompleteProfile: true });
  if (!authResult.success) {
    return authResult.response;
  }
  const user = authResult.user!;

  const roomCode = params.code;
  const body = await request.json();

  const parsed = pickSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error }, { status: 400 });
  }

  const { matchId, roundNumber, movieAId, movieBId, selectedMovieId, responseTimeMs } = parsed.data;
  const startTime = Date.now();

  try {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.status !== 'active') {
      return NextResponse.json({ 
        success: false, 
        error: `Tournament is not active. Current status: ${room.status}` 
      }, { status: 400 });
    }

    // Check if pick already exists for this match and user
    const existingPick = await db.query.bracketPicks.findFirst({
      where: and(
        eq(bracketPicks.roomId, room.id),
        eq(bracketPicks.userId, user.id),
        eq(bracketPicks.matchId, matchId)
      ),
    });

    if (existingPick) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pick already submitted for this match' 
      }, { status: 409 });
    }

    // Insert the bracket pick
    await db.insert(bracketPicks).values({
      roomId: room.id,
      userId: user.id,
      matchId,
      roundNumber,
      movieAId,
      movieBId,
      selectedMovieId,
      responseTimeMs,
    });

    // Add ELO processing job to batch processor
    EloBatchProcessor.addJob({
      roomId: room.id,
      userId: user.id,
      picks: [{
        movieAId,
        movieBId,
        selectedMovieId,
        responseTimeMs,
      }],
      priority: 'normal',
    });

    // Track user response time
    const actualResponseTime = responseTimeMs || (Date.now() - startTime);
    await TournamentMetrics.trackUserEvent('bracket_pick_submitted', user.id, {
      room_id: room.id,
      room_code: roomCode,
      match_id: matchId,
      round_number: roundNumber,
      response_time_ms: actualResponseTime,
      selected_movie_id: selectedMovieId,
    });

    // Check if user can advance to next round
    const progress = await TournamentProgress.getUserProgress(room.id, user.id);
    const canAdvanceRound = await TournamentProgress.canAdvanceRound(room.id);

    // TODO: Broadcast the 'pick_made' event to the room's Realtime channel
    // TODO: If canAdvanceRound, trigger round advancement

    return NextResponse.json({ 
      success: true,
      progress: {
        completedPicks: progress.completedPicks + 1, // Include the pick we just submitted
        totalPicks: progress.totalPicks,
        currentRound: progress.currentRound,
        canAdvance: progress.canAdvance,
      },
      roomStatus: {
        canAdvanceRound,
        eloQueueSize: EloBatchProcessor.getQueueSize(),
      }
    });

  } catch (error) {
    console.error('Error submitting pick:', error);
    
    await TournamentMetrics.trackError('bracket_pick_submission', error as Error, {
      room_code: roomCode,
      user_id: user.id,
      match_id: matchId,
    });

    return NextResponse.json({ success: false, error: 'Failed to submit pick' }, { status: 500 });
  }
} 