import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users, streamingServices, genres, genreCharacteristics } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userId = searchParams.get('userId')

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Missing email or userId parameter' },
        { status: 400 }
      )
    }

    // Get user data by email or userId - only select columns we need
    let userData = null
    try {
      const userResults = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          username: users.username,
          streamingServices: users.streamingServices,
          selectedGenres: users.selectedGenres,
          selectedCharacteristics: users.selectedCharacteristics
        })
        .from(users)
        .where(email ? eq(users.email, email) : eq(users.id, userId!))
        .limit(1)
      
      userData = userResults[0]
    } catch (dbError) {
      console.error('Database error fetching user:', dbError)
      // If there's a database error, we'll continue with null userData
    }

    if (!userData) {
      // User doesn't exist yet - return empty response (not an error)
      return NextResponse.json({
        success: true,
        userData: null,
        streamingServices: [],
        userGenres: [],
        userCharacteristics: []
      })
    }

    // Fetch streaming services if user has them
    let userStreamingServices: any[] = []
    if (userData.streamingServices && userData.streamingServices.length > 0) {
      try {
        const serviceIds = userData.streamingServices.map(Number).filter(id => !isNaN(id))
        if (serviceIds.length > 0) {
          userStreamingServices = await db
            .select()
            .from(streamingServices)
            .where(inArray(streamingServices.id, serviceIds))
        }
      } catch (error) {
        console.error('Error fetching streaming services:', error)
      }
    }

    // Fetch genres if user has them
    let userGenres: any[] = []
    if (userData.selectedGenres && userData.selectedGenres.length > 0) {
      try {
        userGenres = await db
          .select()
          .from(genres)
          .where(inArray(genres.name, userData.selectedGenres))
      } catch (error) {
        console.error('Error fetching genres:', error)
      }
    }

    // Fetch characteristics if user has them
    let userCharacteristics: any[] = []
    if (userData.selectedCharacteristics && userData.selectedCharacteristics.length > 0) {
      try {
        userCharacteristics = await db
          .select()
          .from(genreCharacteristics)
          .where(inArray(genreCharacteristics.name, userData.selectedCharacteristics))
      } catch (error) {
        console.error('Error fetching characteristics:', error)
      }
    }

    return NextResponse.json({
      success: true,
      userData: {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        streaming_services: userData.streamingServices,
        selected_genres: userData.selectedGenres,
        selected_characteristics: userData.selectedCharacteristics
      },
      streamingServices: userStreamingServices,
      userGenres: userGenres,
      userCharacteristics: userCharacteristics
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updateData = await request.json()
    const { userId, email, streaming_services, selected_genres, selected_characteristics } = updateData

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      )
    }

    // Prepare update object
    const updateObject: any = {}
    
    if (streaming_services !== undefined) {
      updateObject.streamingServices = streaming_services.map(String)
    }
    
    if (selected_genres !== undefined) {
      updateObject.selectedGenres = selected_genres
    }
    
    if (selected_characteristics !== undefined) {
      updateObject.selectedCharacteristics = selected_characteristics
    }

    // Update user profile
    const result = await db
      .update(users)
      .set(updateObject)
      .where(userId ? eq(users.id, userId) : eq(users.email, email!))
      .returning()

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User profile updated successfully',
      userData: result[0]
    })

  } catch (error: any) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 