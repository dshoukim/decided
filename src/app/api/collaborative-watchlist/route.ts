import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/security/auth-middleware';
import { withRateLimit } from '@/lib/security/rate-limiting';
import { db } from '@/db';
import { watchList, roomHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function handleAddToCollaborativeWatchlist(request: Request) {
  try {
    const { 
      userAId, 
      userBId, 
      movieId, 
      movieTitle, 
      movieData, 
      roomId 
    } = await request.json();

    // Validate required fields
    if (!userAId || !userBId || !movieId || !movieTitle || !roomId) {
      return NextResponse.json({ 
        error: 'Missing required fields: userAId, userBId, movieId, movieTitle, roomId' 
      }, { status: 400 });
    }

    // Check if movie already exists in either user's watchlist
    const existingEntries = await db.query.watchList.findMany({
      where: eq(watchList.tmdbMovieId, movieId),
    });

    const userAEntry = existingEntries.find(entry => entry.userId === userAId);
    const userBEntry = existingEntries.find(entry => entry.userId === userBId);

    const currentTime = new Date();

    // 1. Add to user A's watchlist (or update if exists)
    if (userAEntry) {
      await db
        .update(watchList)
        .set({
          addedFrom: 'decided_together',
          decidedTogetherRoomId: roomId,
          pendingRating: true,
          updatedAt: currentTime
        })
        .where(eq(watchList.id, userAEntry.id));
    } else {
      await db.insert(watchList).values({
        userId: userAId,
        tmdbMovieId: movieId,
        movieTitle,
        movieData: movieData ? JSON.stringify(movieData) : null,
        addedFrom: 'decided_together',
        decidedTogetherRoomId: roomId,
        pendingRating: true,
        isWatched: false
      });
    }

    // 2. Add to user B's watchlist (or update if exists)  
    if (userBEntry) {
      await db
        .update(watchList)
        .set({
          addedFrom: 'decided_together',
          decidedTogetherRoomId: roomId,
          pendingRating: true,
          updatedAt: currentTime
        })
        .where(eq(watchList.id, userBEntry.id));
    } else {
      await db.insert(watchList).values({
        userId: userBId,
        tmdbMovieId: movieId,
        movieTitle,
        movieData: movieData ? JSON.stringify(movieData) : null,
        addedFrom: 'decided_together',
        decidedTogetherRoomId: roomId,
        pendingRating: true,
        isWatched: false
      });
    }

    // 3. Log collaboration event
    await db.insert(roomHistory).values({
      roomId,
      eventType: 'movie_added_to_watchlists',
      eventData: JSON.stringify({ 
        movieId, 
        movieTitle,
        userAId, 
        userBId,
        timestamp: currentTime.toISOString()
      })
    });

    return NextResponse.json({ 
      success: true,
      movieTitle,
      addedToUsers: [userAId, userBId],
      pendingRating: true
    });

  } catch (error) {
    console.error('Error adding movie to collaborative watchlist:', error);
    return NextResponse.json({ 
      error: 'Failed to add movie to collaborative watchlist' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleAddToCollaborativeWatchlist(request)
} 