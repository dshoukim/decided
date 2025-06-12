'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { TMDBMovie } from '@/lib/tmdb'
import MovieSearch from './MovieSearch'
import MovieDetailModal from './MovieDetailModal'
import RateMovieModal from './RateMovieModal'
import LoadingSpinner from './LoadingSpinner'

interface WatchListItem {
  id: number
  userId: string
  tmdbMovieId: number
  movieTitle: string
  movieData: any
  userNote: string | null
  addedFrom: 'survey' | 'search' | 'manual'
  isWatched: boolean
  watchedAt: string | null
  createdAt: string
  updatedAt: string
}

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

interface WatchListProps {
  user: User
}

export default function WatchList({ user }: WatchListProps) {
  const [watchList, setWatchList] = useState<WatchListItem[]>([])
  const [movieRatings, setMovieRatings] = useState<MovieRating[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(true)
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [autoPopulated, setAutoPopulated] = useState(false)
  const [activeTab, setActiveTab] = useState<'watchlist' | 'rated'>('watchlist')

  useEffect(() => {
    loadWatchList()
    loadMovieRatings()
    autoPopulateFromSurvey()
  }, [user])

  const loadWatchList = async () => {
    try {
      const response = await fetch(`/api/watch-list?userId=${user.id}`)
      const data = await response.json()
      
      if (data.success) {
        setWatchList(data.data || [])
      }
    } catch (error) {
      console.error('Error loading watch list:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMovieRatings = async () => {
    try {
      const response = await fetch(`/api/save-movie-rating?userId=${user.id}`)
      const data = await response.json()
      
      if (data.success) {
        // Filter out 'not_seen' ratings since those aren't movies they've actually seen
        const seenMovies = data.data.filter((rating: MovieRating) => rating.ratingType !== 'not_seen')
        setMovieRatings(seenMovies)
      }
    } catch (error) {
      console.error('Error loading movie ratings:', error)
    } finally {
      setRatingsLoading(false)
    }
  }

  const autoPopulateFromSurvey = async () => {
    try {
      const response = await fetch('/api/populate-watch-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      })

      const data = await response.json()
      
      if (data.success && data.addedCount > 0) {
        setAutoPopulated(true)
        // Reload watch list to show new items
        setTimeout(loadWatchList, 500)
      }
    } catch (error) {
      console.error('Error auto-populating watch list:', error)
    }
  }

  const handleMovieSelect = (movie: TMDBMovie) => {
    setSelectedMovie(movie)
    if (activeTab === 'watchlist') {
      setShowModal(true)
    } else {
      setShowRateModal(true)
    }
    setShowSearch(false)
  }

  const handleAddToWatchList = async (movie: TMDBMovie, note: string) => {
    try {
      const response = await fetch('/api/watch-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          tmdbMovieId: movie.id,
          movieTitle: movie.title,
          movieData: {
            poster_path: movie.poster_path,
            poster_url: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            overview: movie.overview,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count
          },
          userNote: note,
          addedFrom: 'search'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        loadWatchList() // Reload to show new item
      } else {
        alert('Failed to add movie to watch list')
      }
    } catch (error) {
      console.error('Error adding to watch list:', error)
      alert('Failed to add movie to watch list')
    }
  }

  const handleAddMovieRating = async (movie: TMDBMovie, ratingType: 'like' | 'dislike' | 'love', note: string) => {
    try {
      const response = await fetch('/api/save-movie-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          tmdbMovieId: movie.id,
          movieTitle: movie.title,
          ratingType: ratingType,
          movieData: {
            poster_path: movie.poster_path,
            poster_url: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            overview: movie.overview,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count
          },
          userNote: note
        })
      })

      const data = await response.json()
      
      if (data.success) {
        loadMovieRatings() // Reload to show new rating
      } else {
        alert('Failed to add movie rating')
      }
    } catch (error) {
      console.error('Error adding movie rating:', error)
      alert('Failed to add movie rating')
    }
  }

  const handleRemoveFromWatchList = async (tmdbMovieId: number) => {
    if (!confirm('Are you sure you want to remove this movie from your watch list?')) {
      return
    }

    try {
      const response = await fetch(`/api/watch-list?userId=${user.id}&tmdbMovieId=${tmdbMovieId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        loadWatchList() // Reload to remove item
      } else {
        alert('Failed to remove movie from watch list')
      }
    } catch (error) {
      console.error('Error removing from watch list:', error)
      alert('Failed to remove movie from watch list')
    }
  }

  const handleRemoveMovieRating = async (tmdbMovieId: number) => {
    if (!confirm('Are you sure you want to remove this movie from your rated movies?')) {
      return
    }

    try {
      const response = await fetch(`/api/save-movie-rating?userId=${user.id}&tmdbMovieId=${tmdbMovieId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        loadMovieRatings() // Reload to remove item
      } else {
        alert('Failed to remove movie rating')
      }
    } catch (error) {
      console.error('Error removing movie rating:', error)
      alert('Failed to remove movie rating')
    }
  }

  const handleMarkAsWatched = async (tmdbMovieId: number, isWatched: boolean) => {
    try {
      const response = await fetch('/api/watch-list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          tmdbMovieId: tmdbMovieId,
          isWatched: isWatched
        })
      })

      const data = await response.json()
      
      if (data.success) {
        loadWatchList() // Reload to update status
      } else {
        alert('Failed to update movie status')
      }
    } catch (error) {
      console.error('Error updating movie status:', error)
      alert('Failed to update movie status')
    }
  }

  const unwatchedMovies = watchList.filter(item => !item.isWatched)
  const watchedMovies = watchList.filter(item => item.isWatched)

  if (loading && ratingsLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner message="Loading your movies..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'watchlist'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Movies to Watch
            </button>
            <button
              onClick={() => setActiveTab('rated')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rated'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Movies I've Seen
            </button>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900">
            {activeTab === 'watchlist' ? 'Your Watch List' : 'Movies You\'ve Seen'}
          </h2>
          <p className="text-gray-600">
            {activeTab === 'watchlist' 
              ? `${unwatchedMovies.length} movies to watch${watchedMovies.length > 0 ? `, ${watchedMovies.length} completed` : ''}`
              : `${movieRatings.length} movies rated`
            }
          </p>
        </div>
        
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          {showSearch ? 'Hide Search' : activeTab === 'watchlist' ? 'Add Movies' : 'Add Rated Movie'}
        </button>
      </div>

      {/* Auto-population notification */}
      {autoPopulated && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                Great! We've added movies you marked as "haven't seen" from your survey to your watch list.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Movie Search */}
      {showSearch && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {activeTab === 'watchlist' ? 'Search for Movies' : 'Search for Movies to Rate'}
          </h3>
          <MovieSearch onMovieSelect={handleMovieSelect} />
        </div>
      )}

      {/* Unwatched Movies */}
      {activeTab === 'watchlist' && unwatchedMovies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Movies to Watch</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {unwatchedMovies.map((item) => (
              <WatchListCard
                key={item.id}
                item={item}
                onViewDetails={(movie) => {
                  setSelectedMovie(movie)
                  setShowModal(true)
                }}
                onRemove={() => handleRemoveFromWatchList(item.tmdbMovieId)}
                onMarkAsWatched={() => handleMarkAsWatched(item.tmdbMovieId, true)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Watched Movies */}
      {activeTab === 'watchlist' && watchedMovies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Watched Movies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {watchedMovies.map((item) => (
              <WatchListCard
                key={item.id}
                item={item}
                onViewDetails={(movie) => {
                  setSelectedMovie(movie)
                  setShowModal(true)
                }}
                onRemove={() => handleRemoveFromWatchList(item.tmdbMovieId)}
                onMarkAsWatched={() => handleMarkAsWatched(item.tmdbMovieId, false)}
                isWatched
              />
            ))}
          </div>
        </div>
      )}

      {/* Rated Movies */}
      {activeTab === 'rated' && movieRatings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Movies You've Seen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {movieRatings.map((item) => (
              <RatedMovieCard
                key={item.id}
                item={item}
                onViewDetails={(movie) => {
                  setSelectedMovie(movie)
                  setShowModal(true)
                }}
                onRemove={() => handleRemoveMovieRating(item.tmdbMovieId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {((activeTab === 'watchlist' && watchList.length === 0) || (activeTab === 'rated' && movieRatings.length === 0)) && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {activeTab === 'watchlist' ? 'Your watch list is empty' : 'No rated movies yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {activeTab === 'watchlist' 
              ? 'Start by searching for movies you want to watch, or complete the movie survey to get personalized recommendations.'
              : 'Start by searching for movies you\'ve seen and rate them to build your collection.'
            }
          </p>
          <button
            onClick={() => setShowSearch(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {activeTab === 'watchlist' ? 'Add Your First Movie' : 'Rate Your First Movie'}
          </button>
        </div>
      )}

      {/* Movie Detail Modal */}
      <MovieDetailModal
        movie={selectedMovie}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedMovie(null)
        }}
        onAddToWatchList={handleAddToWatchList}
        onUpdateMovieRating={handleAddMovieRating}
        isInWatchList={watchList.some(item => item.tmdbMovieId === selectedMovie?.id)}
        existingNote={watchList.find(item => item.tmdbMovieId === selectedMovie?.id)?.userNote || ''}
        userId={user.id}
      />

      {/* Rate Movie Modal */}
      <RateMovieModal
        movie={selectedMovie}
        isOpen={showRateModal}
        onClose={() => {
          setShowRateModal(false)
          setSelectedMovie(null)
        }}
        onAddMovieRating={handleAddMovieRating}
      />
    </div>
  )
}

// Watch List Card Component
interface WatchListCardProps {
  item: WatchListItem
  onViewDetails: (movie: TMDBMovie) => void
  onRemove: () => void
  onMarkAsWatched: () => void
  isWatched?: boolean
}

function WatchListCard({ item, onViewDetails, onRemove, onMarkAsWatched, isWatched = false }: WatchListCardProps) {
  const handleViewDetails = () => {
    // Convert watch list item to TMDBMovie format
    const movie: TMDBMovie = {
      id: item.tmdbMovieId,
      title: item.movieTitle,
      overview: item.movieData?.overview || '',
      poster_path: item.movieData?.poster_path || null,
      backdrop_path: null,
      release_date: item.movieData?.release_date || '',
      vote_average: item.movieData?.vote_average || 0,
      vote_count: item.movieData?.vote_count || 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      original_title: item.movieTitle,
      popularity: 0,
      video: false
    }
    onViewDetails(movie)
  }

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${isWatched ? 'opacity-75' : ''}`}>
      <div className="aspect-[2/3] relative">
        {item.movieData?.poster_url ? (
          <img
            src={item.movieData.poster_url}
            alt={item.movieTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        {isWatched && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
            ✓ Watched
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.movieTitle}</h4>
        
        {item.movieData?.release_date && (
          <p className="text-sm text-gray-600 mb-2">
            {new Date(item.movieData.release_date).getFullYear()}
          </p>
        )}
        
        {item.userNote && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            "{item.userNote}"
          </p>
        )}
        
        <div className="flex flex-col gap-2">
          <button
            onClick={handleViewDetails}
            className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
          >
            View Details
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onMarkAsWatched}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                isWatched
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isWatched ? 'Mark Unwatched' : 'Mark Watched'}
            </button>
            
            <button
              onClick={onRemove}
              className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Rated Movie Card Component
interface RatedMovieCardProps {
  item: MovieRating
  onViewDetails: (movie: TMDBMovie) => void
  onRemove: () => void
}

function RatedMovieCard({ item, onViewDetails, onRemove }: RatedMovieCardProps) {
  const handleViewDetails = () => {
    // Convert movie rating to TMDBMovie format
    const movie: TMDBMovie = {
      id: item.tmdbMovieId,
      title: item.movieTitle,
      overview: item.movieData?.overview || '',
      poster_path: item.movieData?.poster_path || null,
      backdrop_path: null,
      release_date: item.movieData?.release_date || '',
      vote_average: item.movieData?.vote_average || 0,
      vote_count: item.movieData?.vote_count || 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      original_title: item.movieTitle,
      popularity: 0,
      video: false
    }
    onViewDetails(movie)
  }

  const getRatingIcon = () => {
    switch (item.ratingType) {
      case 'love': return '❤️'
      case 'like': return '👍'
      case 'dislike': return '👎'
      default: return '⭐'
    }
  }

  const getRatingText = () => {
    switch (item.ratingType) {
      case 'love': return 'Loved it!'
      case 'like': return 'Liked it'
      case 'dislike': return 'Didn\'t like it'
      default: return 'Rated'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="aspect-[2/3] relative">
        {item.movieData?.poster_url ? (
          <img
            src={item.movieData.poster_url}
            alt={item.movieTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-medium">
          {getRatingIcon()} {getRatingText()}
        </div>
      </div>
      
      <div className="p-4">
        <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.movieTitle}</h4>
        
        {item.movieData?.release_date && (
          <p className="text-sm text-gray-600 mb-2">
            {new Date(item.movieData.release_date).getFullYear()}
          </p>
        )}
        
        {item.userNote && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            "{item.userNote}"
          </p>
        )}
        
        <div className="flex flex-col gap-2">
          <button
            onClick={handleViewDetails}
            className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
          >
            View Details
          </button>
          
          <button
            onClick={onRemove}
            className="w-full px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Remove Rating
          </button>
        </div>
      </div>
    </div>
  )
} 