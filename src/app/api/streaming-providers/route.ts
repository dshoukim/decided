import { NextRequest, NextResponse } from 'next/server'
import tmdbService from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const movieId = searchParams.get('movieId')
    const region = searchParams.get('region') || 'US'

    if (!movieId) {
      return NextResponse.json(
        { error: 'Missing movieId parameter' },
        { status: 400 }
      )
    }

    // Get streaming providers using TMDB service
    const providers = await tmdbService.getStreamingProviders(parseInt(movieId), region)

    return NextResponse.json({
      success: true,
      providers: providers
    })

  } catch (error) {
    console.error('Error in streaming providers API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch streaming providers',
        success: false,
        providers: null
      },
      { status: 500 }
    )
  }
} 