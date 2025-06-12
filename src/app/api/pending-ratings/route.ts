import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/security/auth-middleware';
import { withRateLimit } from '@/lib/security/rate-limiting';
import { db } from '@/db';
import { watchList } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

async function handleGetPendingRatings(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ 
        error: 'userId parameter is required' 
      }, { status: 400 });
    }

    const pendingRatings = await db.query.watchList.findMany({
      where: and(
        eq(watchList.userId, userId),
        eq(watchList.pendingRating, true),
        eq(watchList.isWatched, true)
      ),
    });

    return NextResponse.json({ 
      success: true, 
      pendingRatings: pendingRatings.map(item => ({
        id: item.id,
        movieId: item.tmdbMovieId,
        movieTitle: item.movieTitle,
        movieData: item.movieData ? JSON.parse(item.movieData) : null,
        decidedTogetherRoomId: item.decidedTogetherRoomId,
        watchedAt: item.watchedAt,
        addedFrom: item.addedFrom
      }))
    });

  } catch (error) {
    console.error('Error getting pending ratings:', error);
    return NextResponse.json({ 
      error: 'Failed to get pending ratings' 
    }, { status: 500 });
  }
}

async function handleSubmitRating(request: Request) {
  try {
    const { userId, movieId, rating, liked, review, skipRating } = await request.json();

    if (!userId || !movieId) {
      return NextResponse.json({ 
        error: 'userId and movieId are required' 
      }, { status: 400 });
    }

    if (skipRating) {
      // Keep pending_rating = true, will be prompted again later
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        message: 'Rating skipped - will be prompted again later'
      });
    }

    // Update with rating and clear pending flag
    const updateData: any = {
      pendingRating: false,
      watchedAt: new Date().toISOString()
    };

    if (rating !== undefined) {
      updateData.rating = rating;
    }

    if (liked !== undefined) {
      updateData.liked = liked;
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    const result = await db
      .update(watchList)
      .set(updateData)
      .where(
        and(
          eq(watchList.userId, userId),
          eq(watchList.tmdbMovieId, movieId)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ 
        error: 'Movie not found in user watchlist' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      rated: true,
      movieTitle: result[0].movieTitle,
      rating: rating,
      liked: liked
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    return NextResponse.json({ 
      error: 'Failed to submit rating' 
    }, { status: 500 });
  }
}

// Basic rate-limit settings for this endpoint (30 requests/min per user/IP)
const RATE_LIMIT_CONFIG = { windowMs: 60_000, max: 30 } as const;

export async function GET(request: Request) {
  // Rate limit first
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_CONFIG, 'pending-ratings');
  if (rateLimitResponse) return rateLimitResponse;

  // Auth check
  const authResult = await withAuth(request);
  if (!authResult.success) return authResult.response as Response;

  return handleGetPendingRatings(request);
}

export async function POST(request: Request) {
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_CONFIG, 'pending-ratings');
  if (rateLimitResponse) return rateLimitResponse;

  const authResult = await withAuth(request);
  if (!authResult.success) return authResult.response as Response;

  return handleSubmitRating(request);
} 