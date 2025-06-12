import { NextRequest, NextResponse } from 'next/server'
import tmdbService from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const page = parseInt(searchParams.get('page') || '1')

    if (!query) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      )
    }

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        totalPages: 0,
        totalResults: 0,
        page: 1
      })
    }

    // Search movies using TMDB service
    const searchResults = await tmdbService.searchMoviesDetailed(query, page)

    return NextResponse.json({
      success: true,
      results: searchResults.results,
      totalPages: searchResults.totalPages,
      totalResults: searchResults.totalResults,
      page: searchResults.page
    })

  } catch (error) {
    console.error('Error in search movies API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search movies',
        success: false,
        results: [],
        totalPages: 0,
        totalResults: 0,
        page: 1
      },
      { status: 500 }
    )
  }
} 