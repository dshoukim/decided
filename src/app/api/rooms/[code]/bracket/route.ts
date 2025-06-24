import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { rooms, bracketPicks, userMovieElo, watchList } from '@/db/schema'
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

    // Cap response time to prevent integer overflow (max ~24 days in ms)
    const cappedResponseTime = responseTimeMs ? Math.min(responseTimeMs, 2147483647) : null;
    
    // Insert the bracket pick
    await db.insert(bracketPicks).values({
      roomId: room.id,
      userId: user.id,
      matchId,
      roundNumber,
      movieAId,
      movieBId,
      selectedMovieId,
      responseTimeMs: cappedResponseTime,
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
    
    console.log(`Pick submission complete for ${user.id} in match ${matchId}:`, {
      progress: { ...progress, completedPicks: progress.completedPicks + 1 },
      canAdvanceRound,
      currentRound: progress.currentRound,
      roomId: room.id
    });

    // Broadcast the 'pick_made' event to the room's Realtime channel
    const supabase = await createClient();
    const channelName = `room-${roomCode}`;
    
    try {
      await supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'pick_made',
        payload: {
          type: 'pick_made',
          userId: user.id,
          matchId,
          roundNumber,
          progress: {
            userPicks: progress.completedPicks + 1,
            totalPicks: progress.totalPicks,
          },
        },
      });
    } catch (broadcastError) {
      console.error('Error broadcasting pick_made event:', broadcastError);
    }

    // If round is complete, advance to next round
    if (canAdvanceRound) {
      console.log(`🎉 Round ${roundNumber} complete! Advancing to next round...`);
      
      // Debug current tournament state before advancement
      const currentTournament = room.tournamentData as any;
      console.log(`📊 Current tournament state before advancement:`, {
        currentRound: currentTournament?.currentRound,
        totalMatches: currentTournament?.matches?.length,
        isFinalRound: currentTournament?.isFinalRound,
        totalRounds: currentTournament?.totalRounds
      });
      
      try {
        const nextRoundMatches = await TournamentProgress.advanceRound(room.id);
        console.log(`✅ Round advancement successful. Generated ${nextRoundMatches.length} matches for round ${roundNumber + 1}`);
        
        // Check if we reached the final round
        const updatedRoom = await db.query.rooms.findFirst({
          where: eq(rooms.id, room.id),
        });
        
        const updatedTournament = updatedRoom?.tournamentData as any;
        const isFinalRound = updatedTournament?.isFinalRound;

        if (isFinalRound) {
          // Broadcast final round started
          await supabase.channel(channelName).send({
            type: 'broadcast',
            event: 'final_round_started',
            payload: {
              type: 'final_round_started',
              roundNumber: roundNumber + 1,
              finalMovies: updatedTournament.finalMovies,
              nextRoundMatchups: nextRoundMatches,
            },
          });
          console.log(`🏆 Broadcasted final_round_started event for round ${roundNumber + 1}`);
        } else {
          // Broadcast regular round completion
          await supabase.channel(channelName).send({
            type: 'broadcast',
            event: 'round_completed',
            payload: {
              type: 'round_completed',
              roundNumber,
              nextRoundMatchups: nextRoundMatches,
            },
          });
          console.log(`📡 Broadcasted round_completed event for round ${roundNumber}`);
        }
        
        // After final round picks, check if we can auto-determine winner
        if (isFinalRound) {
          console.log('🔍 Checking if final picks are complete for auto-winner determination...');
          const finalPicksCheck = await TournamentProgress.checkFinalPicksComplete(room.id);
          
          if (finalPicksCheck.isComplete) {
            console.log('🏁 Final picks complete! Auto-determining winner...');
            try {
              // Import and call winner logic directly
              const { RoomStateManager, RoomStatus } = await import('@/lib/room-state-manager');
              const { TournamentMetrics } = await import('@/lib/monitoring/tournament-metrics');
              const { createClient } = await import('@/lib/supabase/server');
              
              // Get updated tournament data
              const updatedRoom = await db.query.rooms.findFirst({
                where: eq(rooms.id, room.id),
              });
              
              if (!updatedRoom?.tournamentData) {
                throw new Error('Tournament data not found');
              }

              const tournament = updatedRoom.tournamentData as any;

              // Determine winner
              let winnerMovie;
              if (finalPicksCheck.finalPickUserA!.id === finalPicksCheck.finalPickUserB!.id) {
                // Both users picked the same movie
                winnerMovie = finalPicksCheck.finalPickUserA;
              } else {
                // Different picks - use simple majority or random selection for MVP
                const movies = [finalPicksCheck.finalPickUserA!, finalPicksCheck.finalPickUserB!];
                winnerMovie = movies[Math.floor(Math.random() * movies.length)];
              }

              // Update room with winner
              await db
                .update(rooms)
                .set({ 
                  winnerMovieId: winnerMovie!.id,
                  winnerTitle: winnerMovie!.title,
                  winnerPosterPath: winnerMovie!.posterPath,
                  completedAt: new Date(),
                  tournamentData: {
                    ...tournament,
                    winnerData: {
                      winnerMovie,
                      finalPickUserA: finalPicksCheck.finalPickUserA,
                      finalPickUserB: finalPicksCheck.finalPickUserB,
                      completedAt: new Date().toISOString(),
                      participants: finalPicksCheck.participants!.map(p => p.userId)
                    }
                  }
                })
                .where(eq(rooms.id, room.id));

              // Add to watchlists
              const watchlistEntries = finalPicksCheck.participants!.map(participant => ({
                userId: participant.userId,
                tmdbMovieId: winnerMovie!.id,
                movieTitle: winnerMovie!.title,
                movieData: winnerMovie!.movieData ? JSON.stringify(winnerMovie!.movieData) : null,
                addedFrom: 'decided_together',
                decidedTogetherRoomId: room.id,
                pendingRating: true,
                isWatched: false,
                addedAt: new Date().toISOString()
              }));

              await db.insert(watchList).values(watchlistEntries);

              // Update room status
              await RoomStateManager.transitionTo(
                room.id,
                RoomStatus.COMPLETED,
                { 
                  winnerMovie: winnerMovie!.title,
                  tournamentId: tournament.id,
                  completedAt: new Date().toISOString()
                },
                roomCode
              );

              // Broadcast tournament completion
              await supabase.channel(channelName).send({
                type: 'broadcast',
                event: 'tournament_completed',
                payload: {
                  winner: winnerMovie,
                  completedAt: new Date().toISOString(),
                  addedToWatchlists: true,
                  roomStatus: RoomStatus.COMPLETED
                }
              });

              console.log('✅ Winner auto-determination successful:', winnerMovie!.title);
              
            } catch (winnerError) {
              console.error('❌ Error in winner auto-determination:', winnerError);
            }
          }
        }
        
      } catch (advanceError) {
        console.error('❌ Error advancing round:', advanceError);
      }
    } else {
      console.log(`⏳ Round ${roundNumber} not yet complete - waiting for more picks`);
    }

    // Return the response with pick data and progress
    return NextResponse.json({
      message: 'Pick submitted successfully',
      pick: {
        matchId,
        selectedMovieId,
        roundNumber,
        userId: user.id,
      },
      progress: {
        completedPicks: progress.completedPicks + 1, // Include the pick we just submitted
        totalPicks: progress.totalPicks,
        currentRound: progress.currentRound,
        canAdvance: progress.completedPicks + 1 >= progress.totalPicks,
      },
      canAdvanceRound,
      message_for_client: 'IMPORTANT: Client should refetch current match from /current-match endpoint to prevent skipping matches'
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