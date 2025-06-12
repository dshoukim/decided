import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/db'
import { watchList, rooms, roomParticipants } from '@/db/schema'

// GET - Load user's watch list
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

    // Get all watch list items for the user
    const data = await db
      .select()
      .from(watchList)
      .where(eq(watchList.userId, userId))
      .orderBy(desc(watchList.createdAt))

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('Error in get watch list API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add movie to watch list
export async function POST(request: NextRequest) {
  try {
    const { userId, tmdbMovieId, movieTitle, movieData, userNote, addedFrom } = await request.json()

    if (!userId || !tmdbMovieId || !movieTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, tmdbMovieId, movieTitle' },
        { status: 400 }
      )
    }

    // Check if movie already exists in user's watch list
    const existingItem = await db
      .select()
      .from(watchList)
      .where(
        and(
          eq(watchList.userId, userId),
          eq(watchList.tmdbMovieId, tmdbMovieId)
        )
      )
      .limit(1)

    if (existingItem.length > 0) {
      return NextResponse.json(
        { error: 'Movie is already in your watch list' },
        { status: 400 }
      )
    }

    // Insert new watch list item
    const result = await db
      .insert(watchList)
      .values({
        userId,
        tmdbMovieId,
        movieTitle,
        movieData: movieData || null,
        userNote: userNote || null,
        addedFrom: addedFrom || 'manual'
      })
      .returning()

    return NextResponse.json({ 
      success: true, 
      data: result[0] || null,
      message: 'Movie added to watch list successfully'
    })

  } catch (error) {
    console.error('Error in add to watch list API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update watch list item (mark as watched, etc.)
export async function PUT(request: NextRequest) {
  try {
    const { userId, tmdbMovieId, isWatched, userNote } = await request.json()

    if (!userId || !tmdbMovieId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, tmdbMovieId' },
        { status: 400 }
      )
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (typeof isWatched === 'boolean') {
      updateData.isWatched = isWatched
      updateData.watchedAt = isWatched ? new Date() : null
    }

    if (userNote !== undefined) {
      updateData.userNote = userNote
    }

    // Update the watch list item
    const result = await db
      .update(watchList)
      .set(updateData)
      .where(
        and(
          eq(watchList.userId, userId),
          eq(watchList.tmdbMovieId, tmdbMovieId)
        )
      )
      .returning()

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Watch list item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result[0],
      message: 'Watch list item updated successfully'
    })

  } catch (error) {
    console.error('Error in update watch list API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove movie from watch list
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

    // Delete the watch list item
    const result = await db
      .delete(watchList)
      .where(
        and(
          eq(watchList.userId, userId),
          eq(watchList.tmdbMovieId, parseInt(tmdbMovieId))
        )
      )
      .returning()

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Watch list item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Movie removed from watch list successfully'
    })

  } catch (error) {
    console.error('Error in delete watch list API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - For Decided functionality (update watch lists after room completion)
export async function PATCH(request: NextRequest) {
  try {
    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 })
    }

    // Get room details
    const room = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)

    if (!room || room.length === 0 || !room[0].winnerMovieId) {
      return NextResponse.json({ error: 'Room or winner not found' }, { status: 404 })
    }

    const roomData = room[0]
    
    // Get movie data from one of the participant's watch list.
    // This assumes the movie exists on at least one participant's list.
    const winnerMovieData = await db
      .select()
      .from(watchList)
      .where(eq(watchList.tmdbMovieId, roomData.winnerMovieId!))
      .limit(1)

    if (!winnerMovieData || winnerMovieData.length === 0) {
        return NextResponse.json({ error: 'Winning movie data not found in any watchlist' }, { status: 404 });
    }

    const movieData = winnerMovieData[0]

    // Get all participants for this room
    const participants = await db
      .select({ userId: roomParticipants.userId })
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, roomId))

    const participantUserIds = participants.map(p => p.userId);

    for (const userId of participantUserIds) {
      await db
        .insert(watchList)
        .values({
          userId,
          tmdbMovieId: roomData.winnerMovieId!,
          movieTitle: movieData.movieTitle,
          movieData: movieData.movieData,
          addedFrom: 'manual', // or another appropriate value
          decidedTogetherRoomId: roomId,
          pendingRating: true,
        })
        .onConflictDoUpdate({
          target: [watchList.userId, watchList.tmdbMovieId],
          set: {
            decidedTogetherRoomId: roomId,
            pendingRating: true,
            updatedAt: new Date(),
          },
        })
    }
    
    return NextResponse.json({ success: true, message: 'Watch lists updated for all participants' })

  } catch (error) {
    console.error('Error in Decided watch list update API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 