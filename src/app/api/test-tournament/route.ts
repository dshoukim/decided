import { NextResponse } from 'next/server'
import { TournamentEngine } from '@/lib/tournament-engine'
import { db } from '@/db'
import { rooms, roomParticipants } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

export async function GET() {
  try {
    // Use real user UUIDs that exist in the database for testing
    const testUserA = 'add99a2e-48b0-475a-be64-db69980b1bc7'  // dan.shoukimas@gmail.com
    const testUserB = '1aea134a-38d1-4c34-acff-5fdf3182f2a9'  // dshoukim@gmail.com
    
    // Generate a mock tournament for testing
    const tournament = await TournamentEngine.generateTournament(
      testUserA, 
      testUserB, 
      { testMode: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Tournament generated successfully in test mode',
      tournament: {
        id: tournament.id,
        totalRounds: tournament.totalRounds,
        currentRound: tournament.currentRound,
        totalMatches: tournament.matches.length,
        firstRoundMatches: tournament.matches.filter(m => m.roundNumber === 1),
        movies: tournament.matches.flatMap(m => [m.movieA, m.movieB])
          .filter((movie, index, arr) => 
            arr.findIndex(m => m.id === movie.id) === index
          )
      }
    });

  } catch (error) {
    console.error('Test tournament generation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate test tournament',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Use real user UUIDs that exist in the database for testing
    const testUserA = 'add99a2e-48b0-475a-be64-db69980b1bc7'  // dan.shoukimas@gmail.com  
    const testUserB = '1aea134a-38d1-4c34-acff-5fdf3182f2a9'  // dshoukim@gmail.com

    console.log('Starting full integration test...');

    // 1. Create a room
    const roomCode = nanoid();
    console.log(`Creating room with code: ${roomCode}`);
    
    const newRoom = await db
      .insert(rooms)
      .values({
        code: roomCode,
        ownerId: testUserA,
      })
      .returning();

    // 2. Add both users as participants
    console.log('Adding participants to room...');
    await db
      .insert(roomParticipants)
      .values([
        {
          roomId: newRoom[0].id,
          userId: testUserA,
          isActive: true,
        },
        {
          roomId: newRoom[0].id,
          userId: testUserB,
          isActive: true,
        }
      ]);

    // 3. Generate tournament
    console.log('Generating tournament...');
    const tournament = await TournamentEngine.generateTournament(
      testUserA, 
      testUserB, 
      { testMode: true }
    );

    // 4. Update room with tournament data
    console.log('Updating room with tournament data...');
    await db
      .update(rooms)
      .set({
        status: 'active',
        startedAt: new Date(),
        tournamentData: tournament,
      })
      .where(eq(rooms.id, newRoom[0].id));

    return NextResponse.json({
      success: true,
      message: 'Full integration test completed successfully',
      testResults: {
        roomCreated: true,
        participantsAdded: true,
        tournamentGenerated: true,
        roomUpdated: true,
        roomCode: roomCode,
        roomId: newRoom[0].id,
        tournament: {
          id: tournament.id,
          totalRounds: tournament.totalRounds,
          currentRound: tournament.currentRound,
          totalMatches: tournament.matches.length,
          firstRoundMatches: tournament.matches.filter(m => m.roundNumber === 1),
        }
      }
    });

  } catch (error) {
    console.error('Integration test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Integration test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 