'use client'

import { useState, useEffect } from 'react'
import { TMDBMovie } from '@/lib/tmdb'

interface MovieRating {
  id: number
  userId: string
  tmdbMovieId: number
  movieTitle: string
  ratingType: 'like' | 'dislike' | 'love' | 'not_seen'
  movieData: any
  userNote: string | null
  createdAt: string
  updatedAt: string
}

interface MovieDetailModalProps {
  movie: TMDBMovie | null
  isOpen: boolean
  onClose: () => void
  onAddToWatchList: (movie: TMDBMovie, note: string) => void
  onUpdateMovieRating?: (movie: TMDBMovie, ratingType: 'like' | 'dislike' | 'love', note: string) => void
  isInWatchList?: boolean
  existingNote?: string
  userId?: string
}

export default function MovieDetailModal({
  movie,
  isOpen,
  onClose,
  onAddToWatchList,
  onUpdateMovieRating,
  isInWatchList = false,
  existingNote = '',
  userId
}: MovieDetailModalProps) {
  const [note, setNote] = useState('')
  const [rating, setRating] = useState<'like' | 'dislike' | 'love' | null>(null)
  const [streamingProviders, setStreamingProviders] = useState<any>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [existingRating, setExistingRating] = useState<MovieRating | null>(null)
  const [loadingRating, setLoadingRating] = useState(false)

  useEffect(() => {
    if (existingNote) {
      setNote(existingNote)
    } else {
      setNote('')
    }
  }, [existingNote, movie])

  useEffect(() => {
    if (movie && isOpen && userId) {
      fetchStreamingProviders()
      fetchExistingRating()
    }
  }, [movie, isOpen, userId])

  const fetchExistingRating = async () => {
    if (!movie || !userId) return
    
    setLoadingRating(true)
    try {
      const response = await fetch(`/api/save-movie-rating?userId=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        const movieRating = data.data.find((rating: MovieRating) => 
          rating.tmdbMovieId === movie.id && rating.ratingType !== 'not_seen'
        )
        if (movieRating) {
          setExistingRating(movieRating)
          setRating(movieRating.ratingType as 'like' | 'dislike' | 'love')
          setNote(movieRating.userNote || '')
        } else {
          setExistingRating(null)
          setRating(null)
          setNote('')
        }
      }
    } catch (error) {
      console.error('Error fetching existing rating:', error)
    } finally {
      setLoadingRating(false)
    }
  }

  const fetchStreamingProviders = async () => {
    if (!movie) return
    
    setLoadingProviders(true)
    try {
      // Note: This is a placeholder - TMDB's streaming provider data is limited
      // You might want to integrate with a different service like JustWatch API
      const response = await fetch(`/api/streaming-providers?movieId=${movie.id}`)
      const data = await response.json()
      
      if (data.success) {
        setStreamingProviders(data.providers)
      }
    } catch (error) {
      console.error('Error fetching streaming providers:', error)
    } finally {
      setLoadingProviders(false)
    }
  }

  const handleAddToWatchList = () => {
    if (movie) {
      onAddToWatchList(movie, note)
      onClose()
    }
  }

  const handleUpdateRating = () => {
    if (movie && rating && onUpdateMovieRating) {
      onUpdateMovieRating(movie, rating, note)
      onClose()
    }
  }

  const getRatingIcon = (ratingType: string) => {
    switch (ratingType) {
      case 'love': return '❤️'
      case 'like': return '👍'
      case 'dislike': return '👎'
      default: return '⭐'
    }
  }

  const getRatingText = (ratingType: string) => {
    switch (ratingType) {
      case 'love': return 'Loved it!'
      case 'like': return 'Liked it'
      case 'dislike': return 'Didn\'t like it'
      default: return 'Rated'
    }
  }

  // Helper function to extract YouTube video ID from various YouTube URL formats
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null
    
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[7].length === 11) ? match[7] : null
  }

  if (!isOpen || !movie) return null

  // Get trailer info from the extended movie object (only after null check)
  const movieWithTrailer = movie as TMDBMovie & { trailerLink?: string | null }
  const trailerVideoId = movieWithTrailer.trailerLink ? getYouTubeVideoId(movieWithTrailer.trailerLink) : null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Movie Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Movie Poster */}
              <div className="md:col-span-1">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-6xl">🎬</span>
                  </div>
                )}
              </div>

              {/* Movie Info */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{movie.title}</h1>
                  {movie.original_title !== movie.title && (
                    <p className="text-lg text-gray-600 mb-2">({movie.original_title})</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    {movie.release_date && (
                      <span>📅 {new Date(movie.release_date).getFullYear()}</span>
                    )}
                    {movie.vote_average > 0 && (
                      <span>⭐ {movie.vote_average.toFixed(1)}/10 ({movie.vote_count.toLocaleString()} votes)</span>
                    )}
                    <span>🌐 {movie.original_language.toUpperCase()}</span>
                  </div>
                </div>

                {movie.overview && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Overview</h3>
                    <p className="text-gray-700 leading-relaxed">{movie.overview}</p>
                  </div>
                )}

                {/* Trailer */}
                {trailerVideoId && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">🎬 Watch Trailer</h3>
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                      <iframe
                        className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                        src={`https://www.youtube.com/embed/${trailerVideoId}?rel=0&modestbranding=1&fs=1&cc_load_policy=0&iv_load_policy=3&theme=dark&color=white&autohide=0&controls=1&enablejsapi=1`}
                        title={`${movie.title} - Trailer`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}

                {/* Streaming Providers */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Where to Watch</h3>
                  {loadingProviders ? (
                    <div className="flex items-center text-gray-500">
                      <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full mr-2"></div>
                      Loading streaming info...
                    </div>
                  ) : streamingProviders ? (
                    <div className="space-y-2">
                      {streamingProviders.flatrate && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Stream:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {streamingProviders.flatrate.map((provider: any) => (
                              <span key={provider.provider_id} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                {provider.provider_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {streamingProviders.rent && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Rent:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {streamingProviders.rent.map((provider: any) => (
                              <span key={provider.provider_id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {provider.provider_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {streamingProviders.buy && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Buy:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {streamingProviders.buy.map((provider: any) => (
                              <span key={provider.provider_id} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {provider.provider_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Streaming information not available</p>
                  )}
                </div>

                {/* Rating Section for movies you've already seen */}
                {loadingRating ? (
                  <div className="border-t pt-4">
                    <div className="flex items-center text-gray-500">
                      <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full mr-2"></div>
                      Loading your rating...
                    </div>
                  </div>
                ) : existingRating ? (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Update Your Rating</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-3">How did you like this movie?</p>
                        <div className="grid grid-cols-3 gap-3">
                          <button
                            onClick={() => setRating('love')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              rating === 'love'
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                            }`}
                          >
                            <div className="text-xl mb-1">❤️</div>
                            <div className="text-xs font-medium">Loved it!</div>
                          </button>
                          
                          <button
                            onClick={() => setRating('like')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              rating === 'like'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                          >
                            <div className="text-xl mb-1">👍</div>
                            <div className="text-xs font-medium">Liked it</div>
                          </button>
                          
                          <button
                            onClick={() => setRating('dislike')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              rating === 'dislike'
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                            }`}
                          >
                            <div className="text-xl mb-1">👎</div>
                            <div className="text-xs font-medium">Didn't like it</div>
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="rating-note" className="block text-sm font-medium text-gray-700 mb-1">
                          What did you think about it?
                        </label>
                        <textarea
                          id="rating-note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          placeholder="Share your thoughts, favorite moments, or what you learned..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Add to Watch List Section for unwatched movies */
                  !isInWatchList && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Add to Watch List</h3>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                            Why do you want to watch this? (optional)
                          </label>
                          <textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="Add a personal note about why this movie interests you..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}

                {isInWatchList && existingNote && !existingRating && (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Note</h3>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{existingNote}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            
            {existingRating ? (
              <button
                onClick={handleUpdateRating}
                disabled={!rating}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  rating
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Update Rating
              </button>
            ) : !isInWatchList ? (
              <button
                onClick={handleAddToWatchList}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Add to Watch List
              </button>
            ) : (
              <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                ✓ In Your Watch List
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 