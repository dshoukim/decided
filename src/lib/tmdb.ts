import axios from 'axios'

// TMDB API configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

export interface TMDBMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  adult: boolean
  original_language: string
  original_title: string
  popularity: number
  video: boolean
}

export interface TMDBSearchResponse {
  page: number
  results: TMDBMovie[]
  total_pages: number
  total_results: number
}

class TMDBService {
  private accessToken: string
  private apiKey: string

  constructor() {
    // Use NEXT_PUBLIC_ prefix for client-side access
    this.accessToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN || process.env.PUBLIC_TMDB_ACCESS_TOKEN || ''
    this.apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY || process.env.PUBLIC_TMDB_API_KEY || ''
    
    if (!this.accessToken && !this.apiKey) {
      throw new Error('TMDB API credentials are required. Please set NEXT_PUBLIC_TMDB_ACCESS_TOKEN or NEXT_PUBLIC_TMDB_API_KEY.')
    }
  }

  private getHeaders() {
    if (this.accessToken) {
      return {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    } else {
      return {
        'Content-Type': 'application/json'
      }
    }
  }

  private getApiKey() {
    return this.apiKey ? `?api_key=${this.apiKey}` : ''
  }

  /**
   * Search for movies by title
   */
  async searchMovies(query: string, page: number = 1): Promise<TMDBSearchResponse> {
    try {
      const headers = this.getHeaders()
      const apiKeyParam = this.apiKey ? `&api_key=${this.apiKey}` : ''
      
      const response = await axios.get(
        `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${page}${apiKeyParam}`,
        { headers }
      )
      
      return response.data
    } catch (error) {
      console.error('Error searching movies:', error)
      throw new Error('Failed to search movies')
    }
  }

  /**
   * Get movie details by ID
   */
  async getMovieDetails(movieId: number): Promise<TMDBMovie> {
    try {
      const headers = this.getHeaders()
      const apiKeyParam = this.getApiKey()
      
      const response = await axios.get(
        `${TMDB_BASE_URL}/movie/${movieId}${apiKeyParam}`,
        { headers }
      )
      
      return response.data
    } catch (error) {
      console.error('Error getting movie details:', error)
      throw new Error('Failed to get movie details')
    }
  }

  /**
   * Find the best matching movie for a given title
   */
  async findBestMatch(title: string): Promise<TMDBMovie | null> {
    try {
      const searchResults = await this.searchMovies(title)
      
      if (searchResults.results.length === 0) {
        return null
      }

      // Try to find exact match first
      const exactMatch = searchResults.results.find(
        movie => movie.title.toLowerCase() === title.toLowerCase() ||
                movie.original_title.toLowerCase() === title.toLowerCase()
      )

      if (exactMatch) {
        return exactMatch
      }

      // Otherwise return the most popular result
      return searchResults.results[0]
    } catch (error) {
      console.error('Error finding best match for title:', title, error)
      return null
    }
  }

  /**
   * Get full poster URL
   */
  getPosterUrl(posterPath: string | null, size: string = 'w500'): string | null {
    if (!posterPath) return null
    return `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}`
  }

  /**
   * Get full backdrop URL
   */
  getBackdropUrl(backdropPath: string | null, size: string = 'w1280'): string | null {
    if (!backdropPath) return null
    return `${TMDB_IMAGE_BASE_URL}/${size}${backdropPath}`
  }

  /**
   * Get streaming providers for a movie (note: limited availability)
   */
  async getStreamingProviders(movieId: number, region: string = 'US'): Promise<any> {
    try {
      const headers = this.getHeaders()
      const apiKeyParam = this.apiKey ? `&api_key=${this.apiKey}` : ''
      
             const response = await axios.get(
         `${TMDB_BASE_URL}/movie/${movieId}/watch/providers?${apiKeyParam ? apiKeyParam + '&' : ''}`,
         { headers }
       )
      
      return response.data.results?.[region] || null
    } catch (error) {
      console.error('Error getting streaming providers:', error)
      return null
    }
  }

  /**
   * Search movies with pagination and detailed results
   */
  async searchMoviesDetailed(query: string, page: number = 1): Promise<{
    results: TMDBMovie[],
    totalPages: number,
    totalResults: number,
    page: number
  }> {
    try {
      const searchResults = await this.searchMovies(query, page)
      
      return {
        results: searchResults.results,
        totalPages: searchResults.total_pages,
        totalResults: searchResults.total_results,
        page: searchResults.page
      }
    } catch (error) {
      console.error('Error in detailed search:', error)
      throw error
    }
  }

  /**
   * Get popular movies
   */
  async getPopularMovies(page: number = 1): Promise<TMDBSearchResponse> {
    try {
      const headers = this.getHeaders()
      const apiKeyParam = this.apiKey ? `&api_key=${this.apiKey}` : ''
      
      const response = await axios.get(
        `${TMDB_BASE_URL}/movie/popular?page=${page}${apiKeyParam}`,
        { headers }
      )
      
      return response.data
    } catch (error) {
      console.error('Error getting popular movies:', error)
      throw new Error('Failed to get popular movies')
    }
  }

  /**
   * Get trending movies
   */
  async getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBSearchResponse> {
    try {
      const headers = this.getHeaders()
      const apiKeyParam = this.apiKey ? `&api_key=${this.apiKey}` : ''
      
             const response = await axios.get(
         `${TMDB_BASE_URL}/trending/movie/${timeWindow}?${apiKeyParam ? apiKeyParam.substring(1) : ''}`,
         { headers }
       )
      
      return response.data
    } catch (error) {
      console.error('Error getting trending movies:', error)
      throw new Error('Failed to get trending movies')
    }
  }

  /**
   * Batch search for multiple movie titles
   */
  async batchFindMovies(titles: string[]): Promise<Array<{ title: string, movie: TMDBMovie | null, error?: string }>> {
    const results = await Promise.allSettled(
      titles.map(async (title) => {
        try {
          const movie = await this.findBestMatch(title)
          return { title, movie }
        } catch (error) {
          return { title, movie: null, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          title: titles[index],
          movie: null,
          error: result.reason instanceof Error ? result.reason.message : 'Failed to search movie'
        }
      }
    })
  }
}

// Export singleton instance
export const tmdbService = new TMDBService()
export default tmdbService 