import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { movieRatings, watchList } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      )
    }

    // Get all movies the user marked as "not_seen" from their ratings
    const notSeenMovies = await db
      .select()
      .from(movieRatings)
      .where(
        and(
          eq(movieRatings.userId, userId),
          eq(movieRatings.ratingType, 'not_seen')
        )
      )

    if (!notSeenMovies || notSeenMovies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No movies marked as not seen to add to watch list',
        addedCount: 0
      })
    }

    // Check which movies are already in the watch list
    const existingWatchList = await db
      .select({ tmdbMovieId: watchList.tmdbMovieId })
      .from(watchList)
      .where(eq(watchList.userId, userId))

    const existingMovieIds = new Set(existingWatchList.map(item => item.tmdbMovieId))

    // Filter out movies that are already in the watch list
    const moviesToAdd = notSeenMovies.filter(movie => 
      !existingMovieIds.has(movie.tmdbMovieId)
    )

    if (moviesToAdd.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All not seen movies are already in watch list',
        addedCount: 0
      })
    }

    // Insert movies one by one to handle potential duplicates gracefully
    const insertedItems = []
    const errors = []
    
    for (const movie of moviesToAdd) {
      try {
        const watchListItem = {
          userId: userId,
          tmdbMovieId: movie.tmdbMovieId,
          movieTitle: movie.movieTitle,
          movieData: movie.movieData,
          userNote: 'Added from your movie preferences survey',
          addedFrom: 'survey' as const,
        }
        
        // Check if it already exists (double-check to avoid race conditions)
        const existing = await db
          .select()
          .from(watchList)
          .where(
            and(
              eq(watchList.userId, userId),
              eq(watchList.tmdbMovieId, movie.tmdbMovieId)
            )
          )
          .limit(1)
        
        if (existing.length === 0) {
          // Insert only if it doesn't exist
          const result = await db
            .insert(watchList)
            .values(watchListItem)
            .returning()
          
          if (result && result.length > 0) {
            insertedItems.push(result[0])
          }
        }
      } catch (error: any) {
        console.error(`Error adding movie ${movie.movieTitle} to watch list:`, error)
        // If it's a duplicate key error, we can ignore it
        if (error?.code === '23505') {
          console.log(`Movie ${movie.movieTitle} already exists in watch list, skipping`)
        } else {
          errors.push({ movie: movie.movieTitle, error: error.message })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${insertedItems.length} movies to your watch list`,
      addedCount: insertedItems.length,
      data: insertedItems,
      skipped: moviesToAdd.length - insertedItems.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error in populate watch list API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 