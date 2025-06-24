import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { movieRatings } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { userId, tmdbMovieId, movieTitle, ratingType, starRating, movieData, userNote } = await request.json()

    if (!userId || !tmdbMovieId || !movieTitle || !ratingType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, tmdbMovieId, movieTitle, and ratingType' },
        { status: 400 }
      )
    }

    // Validate rating type
    const validRatingTypes = ['like', 'dislike', 'love', 'not_seen', 'star']
    if (!validRatingTypes.includes(ratingType)) {
      return NextResponse.json(
        { error: 'Invalid rating type. Must be one of: like, dislike, love, not_seen, star' },
        { status: 400 }
      )
    }

    // Validate star rating if provided
    if (ratingType === 'star') {
      if (!starRating || starRating < 1 || starRating > 5) {
        return NextResponse.json(
          { error: 'Star rating must be between 1 and 5' },
          { status: 400 }
        )
      }
    }

    // Check if rating already exists
    const existingRating = await db
      .select()
      .from(movieRatings)
      .where(
        and(
          eq(movieRatings.userId, userId),
          eq(movieRatings.tmdbMovieId, tmdbMovieId)
        )
      )
      .limit(1)

    let result
    
    if (existingRating.length > 0) {
      // Update existing rating
      result = await db
        .update(movieRatings)
        .set({
          movieTitle,
          ratingType,
          starRating: ratingType === 'star' ? starRating : null,
          movieData: movieData || null,
          userNote: userNote || null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(movieRatings.userId, userId),
            eq(movieRatings.tmdbMovieId, tmdbMovieId)
          )
        )
        .returning()
    } else {
      // Insert new rating
      result = await db
        .insert(movieRatings)
        .values({
          userId,
          tmdbMovieId,
          movieTitle,
          ratingType,
          starRating: ratingType === 'star' ? starRating : null,
          movieData: movieData || null,
          userNote: userNote || null
        })
        .returning()
    }

    return NextResponse.json({ 
      success: true, 
      data: result[0] || null,
      message: 'Movie rating saved successfully'
    })

  } catch (error) {
    console.error('Error in save-movie-rating API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    // Get all movie ratings for the user
    const data = await db
      .select()
      .from(movieRatings)
      .where(eq(movieRatings.userId, userId))
      .orderBy(desc(movieRatings.createdAt))

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('Error in get movie ratings API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const tmdbMovieId = searchParams.get('tmdbMovieId')

    if (!userId || !tmdbMovieId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId and tmdbMovieId' },
        { status: 400 }
      )
    }

    // Delete the movie rating
    await db
      .delete(movieRatings)
      .where(
        and(
          eq(movieRatings.userId, userId),
          eq(movieRatings.tmdbMovieId, parseInt(tmdbMovieId))
        )
      )

    return NextResponse.json({ 
      success: true, 
      message: 'Movie rating deleted successfully'
    })

  } catch (error) {
    console.error('Error in delete movie rating API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 