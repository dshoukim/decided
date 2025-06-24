import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/security/auth-middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limiting'
import { TournamentService } from '@/lib/services/tournament-service'
import { z } from 'zod'

// Request schemas
const startTournamentSchema = z.object({
  action: z.literal('start')
})

const submitPickSchema = z.object({
  action: z.literal('pick'),
  matchId: z.string(),
  selectedMovieId: z.number(),
  responseTimeMs: z.number().optional()
})

const getStateSchema = z.object({
  action: z.literal('get_state')
})

const tournamentActionSchema = z.discriminatedUnion('action', [
  startTournamentSchema,
  submitPickSchema,
  getStateSchema
])

export async function POST(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params
  const roomCode = params.code

  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.BRACKET_PICKS, 'tournament-actions');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Authentication
  const authResult = await withAuth(request, { requireCompleteProfile: true });
  if (!authResult.success) {
    return authResult.response;
  }
  const user = authResult.user!;

  try {
    const body = await request.json();
    const parsed = tournamentActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: parsed.error.errors 
      }, { status: 400 });
    }

    const action = parsed.data;

    // Get room to verify user access
    const supabase = await createClient();
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select(`
        id,
        code,
        status,
        owner_id,
        room_participants!inner(user_id)
      `)
      .eq('code', roomCode)
      .eq('room_participants.user_id', user.id)
      .single();

    if (roomError || !roomData) {
      return NextResponse.json({ 
        error: 'Room not found or access denied' 
      }, { status: 404 });
    }

    const roomId = roomData.id;

    // Handle different actions
    switch (action.action) {
      case 'start': {
        console.log(`🚀 Starting tournament for room ${roomCode} by user ${user.id}`);
        
        const tournamentState = await TournamentService.startTournament(roomId);
        
        // Broadcast tournament started event
        const channelName = `room-${roomCode}`;
        await supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'tournament_updated',
          payload: {
            type: 'tournament_started',
            status: tournamentState.status,
            currentRound: tournamentState.currentRound,
            totalRounds: tournamentState.totalRounds,
            matchCount: tournamentState.currentMatches.length
          }
        });

        return NextResponse.json({
          success: true,
          tournamentState
        });
      }

      case 'pick': {
        console.log(`🎯 Pick submitted for room ${roomCode} by user ${user.id}:`, {
          matchId: action.matchId,
          selectedMovieId: action.selectedMovieId
        });

        const tournamentState = await TournamentService.submitPick(roomId, user.id, {
          matchId: action.matchId,
          selectedMovieId: action.selectedMovieId,
          responseTimeMs: action.responseTimeMs
        });

        // Broadcast pick made event
        const channelName = `room-${roomCode}`;
        await supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'tournament_updated',
          payload: {
            type: 'pick_made',
            userId: user.id,
            matchId: action.matchId,
            selectedMovieId: action.selectedMovieId,
            status: tournamentState.status,
            currentRound: tournamentState.currentRound,
            userProgress: tournamentState.userProgress
          }
        });

        // If tournament completed, broadcast completion
        if (tournamentState.status === 'completed') {
          await supabase.channel(channelName).send({
            type: 'broadcast',
            event: 'tournament_updated',
            payload: {
              type: 'tournament_completed',
              winnerMovieId: tournamentState.winnerMovieId,
              winnerTitle: tournamentState.winnerTitle,
              winnerPosterPath: tournamentState.winnerPosterPath
            }
          });
        }

        return NextResponse.json({
          success: true,
          tournamentState
        });
      }

      case 'get_state': {
        const tournamentState = await TournamentService.getTournamentState(roomId, user.id);
        
        return NextResponse.json({
          success: true,
          tournamentState
        });
      }

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Tournament API error:', error);
    
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

// GET endpoint for retrieving tournament state
export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const params = await props.params
  const roomCode = params.code

  // Authentication
  const authResult = await withAuth(request, { requireCompleteProfile: true });
  if (!authResult.success) {
    return authResult.response;
  }
  const user = authResult.user!;

  try {
    // Get room to verify user access
    const supabase = await createClient();
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select(`
        id,
        code,
        status,
        room_participants!inner(user_id)
      `)
      .eq('code', roomCode)
      .eq('room_participants.user_id', user.id)
      .single();

    if (roomError || !roomData) {
      return NextResponse.json({ 
        error: 'Room not found or access denied' 
      }, { status: 404 });
    }

    const tournamentState = await TournamentService.getTournamentState(roomData.id, user.id);
    
    return NextResponse.json({
      success: true,
      tournamentState,
      room: {
        id: roomData.id,
        code: roomData.code,
        status: roomData.status
      }
    });

  } catch (error: any) {
    console.error('Tournament GET error:', error);
    
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
} 