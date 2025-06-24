import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { films } from '@/db/schema'
import { desc, asc, ilike, and, gte, lte, sql, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    const offset = (page - 1) * limit

    // Search and filter parameters
    const search = searchParams.get('search')
    const genre = searchParams.get('genre')
    const yearFrom = searchParams.get('yearFrom')
    const yearTo = searchParams.get('yearTo')
    const sortBy = searchParams.get('sortBy') || 'popularity' // popularity, release_date, vote_average, title
    const sortOrder = searchParams.get('sortOrder') || 'desc' // asc, desc
    const minRating = searchParams.get('minRating')

    // Build where conditions
    const conditions = []

    // Search by title
    if (search && search.length >= 2) {
      conditions.push(
        ilike(films.title, `%${search}%`)
      )
    }

    // Filter by genre
    if (genre) {
      conditions.push(
        sql`${films.genres} @> ARRAY[${genre}]::text[]`
      )
    }

    // Filter by release year range
    if (yearFrom) {
      conditions.push(gte(films.releaseDate, `${yearFrom}-01-01`))
    }
    if (yearTo) {
      conditions.push(lte(films.releaseDate, `${yearTo}-12-31`))
    }

    // Filter by minimum rating
    if (minRating) {
      const minRatingInt = parseInt(minRating) * 10 // Convert to our integer format
      conditions.push(gte(films.voteAverage, minRatingInt))
    }

    // Exclude adult content by default
    conditions.push(sql`${films.adult} = false`)

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Build sort clause
    let sortClause
    const orderDirection = sortOrder === 'asc' ? asc : desc

    switch (sortBy) {
      case 'release_date':
        sortClause = orderDirection(films.releaseDate)
        break
      case 'vote_average':
        sortClause = orderDirection(films.voteAverage)
        break
      case 'title':
        sortClause = orderDirection(films.title)
        break
      case 'popularity':
      default:
        sortClause = orderDirection(films.popularity)
        break
    }

    // Get total count for pagination
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(films)
      .where(whereClause)

    // Get films with pagination
    const results = await db
      .select({
        id: films.id,
        tmdbId: films.tmdbId,
        title: films.title,
        overview: films.overview,
        posterPath: films.posterPath,
        backdropPath: films.backdropPath,
        releaseDate: films.releaseDate,
        voteAverage: films.voteAverage,
        voteCount: films.voteCount,
        popularity: films.popularity,
        genres: films.genres,
        runtime: films.runtime,
        originalLanguage: films.originalLanguage,
        trailerLink: films.trailerLink,
      })
      .from(films)
      .where(whereClause)
      .orderBy(sortClause)
      .limit(limit)
      .offset(offset)

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        search,
        genre,
        yearFrom,
        yearTo,
        sortBy,
        sortOrder,
        minRating,
      }
    })

  } catch (error) {
    console.error('Error fetching films:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch films',
        success: false,
        data: [],
        pagination: {
          page: 1,
          limit: 24,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      },
      { status: 500 }
    )
  }
} 