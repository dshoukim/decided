#!/usr/bin/env npx tsx

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { films } from '../src/db/schema'
import { eq, sql } from 'drizzle-orm'
import axios from 'axios'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// TMDB API configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN || process.env.PUBLIC_TMDB_ACCESS_TOKEN
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || process.env.PUBLIC_TMDB_API_KEY

if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
  console.error('❌ TMDB API credentials are required. Please set NEXT_PUBLIC_TMDB_ACCESS_TOKEN or NEXT_PUBLIC_TMDB_API_KEY.')
  process.exit(1)
}

// Database setup
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

const client = postgres(connectionString, { 
  prepare: false,
  max: 1,
  connection: { application_name: 'films-populate-script' },
  connect_timeout: 10,
})

const db = drizzle(client, { schema: { films } })

// TMDB video interface for trailers and teasers
interface TMDBVideo {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string
  name: string
  site: string // 'YouTube', 'Vimeo', etc.
  size: number
  type: string // 'Trailer', 'Teaser', 'Clip', 'Featurette', etc.
  official: boolean
  published_at: string
}

// Enhanced TMDB movie interface with all details needed for our films table
interface TMDBMovieDetails {
  id: number
  imdb_id?: string
  title: string
  original_title: string
  overview?: string
  tagline?: string
  release_date?: string
  status?: string
  runtime?: number
  vote_average: number
  vote_count: number
  popularity: number
  adult: boolean
  original_language: string
  spoken_languages?: Array<{ iso_639_1: string; name: string }>
  poster_path?: string
  backdrop_path?: string
  budget?: number
  revenue?: number
  genres?: Array<{ id: number; name: string }>
  production_companies?: Array<{ id: number; name: string }>
  production_countries?: Array<{ iso_3166_1: string; name: string }>
  keywords?: { keywords: Array<{ id: number; name: string }> }
  videos?: { results: TMDBVideo[] }
}

// API request helpers
const getHeaders = () => {
  if (TMDB_ACCESS_TOKEN) {
    return {
      'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }
  return { 'Content-Type': 'application/json' }
}

const getApiKeyParam = () => TMDB_API_KEY ? `?api_key=${TMDB_API_KEY}` : ''

/**
 * Extract the best trailer URL from TMDB videos data
 * Prioritizes official YouTube trailers, then teasers, then any video
 */
function extractTrailerUrl(videos?: { results: TMDBVideo[] }): string | null {
  if (!videos?.results || videos.results.length === 0) {
    return null
  }

  const videoResults = videos.results
  
  // Filter for YouTube videos only (most reliable for embedding)
  const youtubeVideos = videoResults.filter(video => video.site === 'YouTube')
  
  if (youtubeVideos.length === 0) {
    return null
  }

  // Priority order: Official Trailer > Trailer > Official Teaser > Teaser > Any YouTube video
  const priorityOrder = [
    (v: TMDBVideo) => v.official && v.type === 'Trailer',
    (v: TMDBVideo) => v.type === 'Trailer',
    (v: TMDBVideo) => v.official && v.type === 'Teaser',
    (v: TMDBVideo) => v.type === 'Teaser',
    (v: TMDBVideo) => v.official,
    (v: TMDBVideo) => true // Any YouTube video as fallback
  ]

  for (const predicate of priorityOrder) {
    const matchingVideo = youtubeVideos.find(predicate)
    if (matchingVideo) {
      return `https://www.youtube.com/watch?v=${matchingVideo.key}`
    }
  }

  return null
}

/**
 * Fetch detailed movie information from TMDB API
 */
async function fetchMovieDetails(tmdbId: number): Promise<TMDBMovieDetails | null> {
  try {
    const headers = getHeaders()
    const apiKeyParam = getApiKeyParam()
    
    // Fetch basic movie details
    const movieResponse = await axios.get(
      `${TMDB_BASE_URL}/movie/${tmdbId}${apiKeyParam}`,
      { headers }
    )
    
    // Fetch keywords (additional metadata)
    let keywords = null
    try {
      const keywordsResponse = await axios.get(
        `${TMDB_BASE_URL}/movie/${tmdbId}/keywords${apiKeyParam}`,
        { headers }
      )
      keywords = keywordsResponse.data
    } catch (error: any) {
      console.warn(`⚠️  Could not fetch keywords for movie ${tmdbId}:`, error.message)
    }

    // Fetch videos/trailers
    let videos = null
    try {
      const videosResponse = await axios.get(
        `${TMDB_BASE_URL}/movie/${tmdbId}/videos${apiKeyParam}`,
        { headers }
      )
      videos = videosResponse.data
    } catch (error: any) {
      console.warn(`⚠️  Could not fetch videos for movie ${tmdbId}:`, error.message)
    }

    return {
      ...movieResponse.data,
      keywords,
      videos
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.error(`❌ Movie not found: TMDB ID ${tmdbId}`)
      return null
    }
    console.error(`❌ Error fetching movie ${tmdbId}:`, error.message)
    return null
  }
}

/**
 * Search for a movie by title and return the best match
 */
async function searchMovieByTitle(title: string): Promise<TMDBMovieDetails | null> {
  try {
    const headers = getHeaders()
    const apiKeyParam = TMDB_API_KEY ? `&api_key=${TMDB_API_KEY}` : ''
    
    const response = await axios.get(
      `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(title)}${apiKeyParam}`,
      { headers }
    )
    
    const results = response.data.results
    if (results.length === 0) {
      console.warn(`⚠️  No results found for title: "${title}"`)
      return null
    }

    // Find exact match or use most popular result
    const exactMatch = results.find(
      (movie: any) => movie.title.toLowerCase() === title.toLowerCase() ||
                     movie.original_title.toLowerCase() === title.toLowerCase()
    )
    
    const bestMatch = exactMatch || results[0]
    return await fetchMovieDetails(bestMatch.id)
  } catch (error: any) {
    console.error(`❌ Error searching for movie "${title}":`, error.message)
    return null
  }
}

/**
 * Transform TMDB movie data to our database schema format
 */
function transformMovieData(tmdbMovie: TMDBMovieDetails) {
  return {
    tmdbId: tmdbMovie.id,
    imdbId: tmdbMovie.imdb_id || null,
    title: tmdbMovie.title,
    originalTitle: tmdbMovie.original_title || null,
    overview: tmdbMovie.overview || null,
    tagline: tmdbMovie.tagline || null,
    releaseDate: tmdbMovie.release_date || null,
    status: tmdbMovie.status || null,
    runtime: tmdbMovie.runtime || null,
    voteAverage: Math.round((tmdbMovie.vote_average || 0) * 10), // Store as integer * 10
    voteCount: tmdbMovie.vote_count || 0,
    popularity: Math.round((tmdbMovie.popularity || 0) * 1000), // Store as integer * 1000
    adult: tmdbMovie.adult || false,
    originalLanguage: tmdbMovie.original_language || null,
    spokenLanguages: tmdbMovie.spoken_languages?.map(lang => lang.iso_639_1) || [],
    posterPath: tmdbMovie.poster_path || null,
    backdropPath: tmdbMovie.backdrop_path || null,
    trailerLink: extractTrailerUrl(tmdbMovie.videos),
    budget: tmdbMovie.budget || null,
    revenue: tmdbMovie.revenue || null,
    genres: tmdbMovie.genres?.map(genre => genre.name) || [],
    productionCompanies: tmdbMovie.production_companies?.map(company => company.name) || [],
    productionCountries: tmdbMovie.production_countries?.map(country => country.iso_3166_1) || [],
    keywords: tmdbMovie.keywords?.keywords?.map(keyword => keyword.name) || [],
    lastSyncedAt: new Date(),
  }
}

/**
 * Insert or update a movie in the database
 */
async function upsertMovie(movieData: ReturnType<typeof transformMovieData>) {
  try {
    const result = await db
      .insert(films)
      .values(movieData)
      .onConflictDoUpdate({
        target: films.tmdbId,
        set: {
          ...movieData,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: films.id, title: films.title, tmdbId: films.tmdbId })

    return result[0]
  } catch (error: any) {
    console.error(`❌ Database error for movie "${movieData.title}":`, error.message)
    throw error
  }
}

/**
 * Process a single movie (by TMDB ID or title)
 */
async function processMovie(identifier: number | string): Promise<{
  success: boolean
  identifier: number | string
  movie?: any
  error?: string
}> {
  try {
    console.log(`🔍 Processing: ${identifier}`)
    
    let tmdbMovie: TMDBMovieDetails | null = null
    
    if (typeof identifier === 'number') {
      // Process by TMDB ID
      tmdbMovie = await fetchMovieDetails(identifier)
    } else {
      // Process by title
      tmdbMovie = await searchMovieByTitle(identifier)
    }
    
    if (!tmdbMovie) {
      return {
        success: false,
        identifier,
        error: 'Movie not found or could not be fetched'
      }
    }
    
    const movieData = transformMovieData(tmdbMovie)
    const result = await upsertMovie(movieData)
    
    console.log(`✅ Successfully processed: ${result.title} (TMDB: ${result.tmdbId})`)
    
    return {
      success: true,
      identifier,
      movie: result
    }
  } catch (error: any) {
    console.error(`❌ Failed to process ${identifier}:`, error.message)
    return {
      success: false,
      identifier,
      error: error.message
    }
  }
}

/**
 * Main function to populate films from an array of identifiers
 */
async function populateFilms(identifiers: (number | string)[], options: {
  batchSize?: number
  delayMs?: number
} = {}) {
  const { batchSize = 5, delayMs = 1000 } = options
  
  console.log(`🎬 Starting to populate ${identifiers.length} films...`)
  console.log(`📊 Batch size: ${batchSize}, Delay: ${delayMs}ms`)
  
  const results = {
    total: identifiers.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ identifier: number | string, error: string }>
  }
  
  // Process in batches to respect API rate limits
  for (let i = 0; i < identifiers.length; i += batchSize) {
    const batch = identifiers.slice(i, i + batchSize)
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(identifiers.length / batchSize)}`)
    
    const batchPromises = batch.map(identifier => processMovie(identifier))
    const batchResults = await Promise.allSettled(batchPromises)
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.successful++
        } else {
          results.failed++
          results.errors.push({
            identifier: result.value.identifier,
            error: result.value.error || 'Unknown error'
          })
        }
      } else {
        results.failed++
        results.errors.push({
          identifier: batch[index],
          error: result.reason?.message || 'Promise rejected'
        })
      }
    })
    
    // Add delay between batches (except for the last batch)
    if (i + batchSize < identifiers.length) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  // Print summary
  console.log(`\n📈 Population complete!`)
  console.log(`✅ Successful: ${results.successful}`)
  console.log(`❌ Failed: ${results.failed}`)
  
  if (results.errors.length > 0) {
    console.log(`\n🚨 Errors:`)
    results.errors.forEach(({ identifier, error }) => {
      console.log(`  - ${identifier}: ${error}`)
    })
  }
  
  return results
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`
🎬 TMDB Films Populator

Fetches comprehensive movie data from TMDB including:
- Basic movie details (title, overview, release date, etc.)
- Ratings, popularity, and financial data
- Genres, production companies, and keywords
- Poster and backdrop images
- Trailer links (YouTube videos prioritized)

Usage:
  npm run populate-films -- [options] <identifiers...>
  npx tsx scripts/populate-films-from-tmdb.ts [options] <identifiers...>

Options:
  --batch-size <number>  Number of movies to process concurrently (default: 5)
  --delay <number>       Delay between batches in milliseconds (default: 1000)
  --file <path>          Read identifiers from a JSON file

Examples:
  # By TMDB IDs
  npm run populate-films -- 550 13 680 27205

  # By movie titles
  npm run populate-films -- "Fight Club" "Forrest Gump" "Pulp Fiction"

  # Mixed identifiers
  npm run populate-films -- 550 "The Dark Knight" 13 "Inception"

  # With custom batch size and delay
  npm run populate-films -- --batch-size 3 --delay 2000 550 13 680

  # From a JSON file
  npm run populate-films -- --file ./movie-ids.json
`)
    process.exit(0)
  }
  
  let identifiers: (number | string)[] = []
  let batchSize = 5
  let delayMs = 1000
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--batch-size' && i + 1 < args.length) {
      batchSize = parseInt(args[i + 1])
      i++ // Skip next argument
    } else if (arg === '--delay' && i + 1 < args.length) {
      delayMs = parseInt(args[i + 1])
      i++ // Skip next argument
    } else if (arg === '--file' && i + 1 < args.length) {
      const filePath = args[i + 1]
      try {
        const fileContent = await import('fs').then(fs => fs.promises.readFile(filePath, 'utf-8'))
        const jsonData = JSON.parse(fileContent)
        identifiers = Array.isArray(jsonData) ? jsonData : jsonData.movies || jsonData.identifiers || []
             } catch (error: any) {
         console.error(`❌ Error reading file ${filePath}:`, error.message)
         process.exit(1)
       }
      i++ // Skip next argument
    } else if (!arg.startsWith('--')) {
      // Try to parse as number, otherwise treat as string
      const numericValue = parseInt(arg)
      identifiers.push(isNaN(numericValue) ? arg : numericValue)
    }
  }
  
  if (identifiers.length === 0) {
    console.error('❌ No movie identifiers provided')
    process.exit(1)
  }
  
  try {
    await populateFilms(identifiers, { batchSize, delayMs })
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Export functions for programmatic use
export { populateFilms, processMovie, fetchMovieDetails, searchMovieByTitle }

// Run CLI if this script is executed directly
// ES module compatible check
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main().catch(console.error)
} 