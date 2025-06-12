import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/db'
import { users, genres, genreCharacteristics } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

// Debug OpenAI configuration
console.log('OpenAI Configuration Debug:')
console.log('- API Key exists:', !!process.env.OPENAI_API_KEY)
console.log('- API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10))
console.log('- Organization exists:', !!process.env.OPENAI_ORGANIZATION)
console.log('- Organization:', process.env.OPENAI_ORGANIZATION)
console.log('- Project ID exists:', !!process.env.OPENAI_PROJECT_ID)
console.log('- Project ID:', process.env.OPENAI_PROJECT_ID)

// Since curl works perfectly, let's match that exact configuration
console.log('Creating OpenAI client with same config that works in curl')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    'OpenAI-Project': process.env.OPENAI_PROJECT_ID,
  }
})

console.log('✓ OpenAI client created with project header configuration')

export async function POST(request: NextRequest) {
  try {
    const { selectedGenres, selectedCharacteristics, userId } = await request.json()

    if (!selectedGenres || !selectedCharacteristics || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: selectedGenres, selectedCharacteristics, and userId' },
        { status: 400 }
      )
    }

    // Debug: Log the exact userId and its type
    console.log('Received userId:', userId, 'Type:', typeof userId)
    
    // First, let's see if any users exist at all
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name
      })
      .from(users)
      .limit(5)
    
    console.log('All users in database (first 5):', allUsers)

    // Fetch user data to get age and gender
    console.log('Attempting to fetch user data for userId:', userId)
    const userResults = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name
      })
      .from(users)
      .where(eq(users.id, userId))

    const userData = userResults[0]

    if (!userData) {
      console.error('User not found for ID:', userId)
      return NextResponse.json(
        { error: 'User profile not found. Please complete your profile setup first.' },
        { status: 404 }
      )
    }

    console.log('Successfully fetched user data:', userData)

    // Since date_of_birth and gender are not in the schema, use default values
    const userAge = 'Not specified'
    const userGender = 'Not specified'

    // Fetch genre names
    console.log('Fetching genre names for IDs:', selectedGenres)
    const genresData = await db
      .select({ name: genres.name })
      .from(genres)
      .where(inArray(genres.id, selectedGenres.map(Number)))

    // Fetch characteristic names
    console.log('Fetching characteristic names for IDs:', selectedCharacteristics)
    const characteristicsData = await db
      .select({ name: genreCharacteristics.name })
      .from(genreCharacteristics)
      .where(inArray(genreCharacteristics.id, selectedCharacteristics.map(Number)))

    const genreNames = genresData?.map(g => g.name) || []
    const characteristicNames = characteristicsData?.map(c => c.name) || []

    // Debug OpenAI setup
    console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY)
    console.log('OpenAI API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 7))

    const prompt = `You are an expert film critic. A user will provide you with a list of genres, and characteristics about that genre that they enjoy. Using this information, create a list of 20 UNIQUE film titles that will help you to refine your understanding about what types of movies the user enjoys. you should maximize for overlap across the various characteristics they list, and you should also include some outliers to see if you can better understand the user. consider the user's age and gender in your decision.

IMPORTANT: Each film must be completely unique - do not repeat any film titles. Ensure all 20 recommendations are different movies.

User Information:
- Age: ${userAge}
- Gender: ${userGender}
- Selected Genres: ${genreNames.join(', ')}
- Selected Characteristics: ${characteristicNames.join(', ')}

Your response should be a structured JSON output that contains exactly 20 UNIQUE film recommendations. Each recommendation should be an object with:
- "name": the exact name of your recommended film (must be unique in this list)
- "explanation": an explanation about why you selected it
- "confidence": a confidence rating (1-10 scale)

REQUIREMENTS:
- All 20 film titles must be different
- No duplicate movies allowed
- Use exact film titles as they appear in movie databases
- Ensure variety across different years and subgenres within the selected categories

Please respond with ONLY a valid JSON array. Example format:
[
  {
    "name": "Film Title",
    "explanation": "Detailed explanation of why this film matches the user's preferences",
    "confidence": 8
  }
]

Do not include any text before or after the JSON array.`

    // Use OpenAI SDK with Bearer authorization
    console.log('Making OpenAI SDK request with Bearer authorization')
    console.log('Request details:')
    console.log('- API Key (first 20 chars):', process.env.OPENAI_API_KEY?.substring(0, 20))
    console.log('- Project ID:', process.env.OPENAI_PROJECT_ID || 'NOT SET')

    // Store original values and temporarily clear organization/project to prevent auto-headers
    const originalOrg = process.env.OPENAI_ORGANIZATION
    const originalProject = process.env.OPENAI_PROJECT_ID
    
    // Temporarily remove these to prevent SDK from auto-adding headers
    delete process.env.OPENAI_ORGANIZATION
    delete process.env.OPENAI_PROJECT_ID

    // Create OpenAI client with just the API key (Bearer authorization only)
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // This sets Bearer authorization only
    })
    
    console.log('OpenAI client created with API key only (no project headers)')
    
    const response = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo", // Using correct model name
      messages: [ // Using correct parameter name
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    })

    // Restore original environment variables
    if (originalOrg) process.env.OPENAI_ORGANIZATION = originalOrg
    if (originalProject) process.env.OPENAI_PROJECT_ID = originalProject

    console.log('OpenAI response received successfully')
    const recommendations = response.choices[0]?.message?.content

    if (!recommendations) {
      return NextResponse.json(
        { error: 'Failed to generate recommendations' },
        { status: 500 }
      )
    }

    // Try to parse the JSON response
    try {
      const parsedRecommendations = JSON.parse(recommendations)
      
      // Now fetch TMDB data for each recommendation
      const tmdbService = await import('@/lib/tmdb').then(m => m.default)
      const movieTitles = parsedRecommendations.map((rec: any) => rec.name)
      
      console.log('Fetching TMDB data for movies:', movieTitles)
      const tmdbResults = await tmdbService.batchFindMovies(movieTitles)
      
      // Combine LLM recommendations with TMDB data
      const enrichedRecommendations = parsedRecommendations.map((llmRec: any, index: number) => {
        const tmdbResult = tmdbResults[index]
        return {
          ...llmRec,
          tmdb_data: tmdbResult.movie ? {
            id: tmdbResult.movie.id,
            title: tmdbResult.movie.title,
            overview: tmdbResult.movie.overview,
            poster_path: tmdbResult.movie.poster_path,
            poster_url: tmdbService.getPosterUrl(tmdbResult.movie.poster_path),
            backdrop_path: tmdbResult.movie.backdrop_path,
            backdrop_url: tmdbService.getBackdropUrl(tmdbResult.movie.backdrop_path),
            release_date: tmdbResult.movie.release_date,
            vote_average: tmdbResult.movie.vote_average,
            vote_count: tmdbResult.movie.vote_count
          } : null,
          tmdb_error: tmdbResult.error || null
        }
      })
      
      return NextResponse.json({ 
        recommendations: enrichedRecommendations,
        tmdb_fetch_count: tmdbResults.filter(r => r.movie).length,
        tmdb_errors: tmdbResults.filter(r => r.error).length
      })
    } catch (parseError) {
      console.error('Error parsing recommendations or fetching TMDB data:', parseError)
      // If parsing fails, return the raw response
      return NextResponse.json({ 
        recommendations: recommendations,
        warning: 'Response was not valid JSON or TMDB fetch failed'
      })
    }

  } catch (error) {
    console.error('Error generating recommendations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}