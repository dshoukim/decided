'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import LoadingSpinner from '@/components/LoadingSpinner'
import MovieDetailModal from '@/components/MovieDetailModal'
import QuickRatingModal from '@/components/QuickRatingModal'
import StarRating from '@/components/ui/star-rating'
import { TMDBMovie } from '@/lib/tmdb'
import { useUser } from '@/lib/hooks/useUser'

interface Film {
  id: number
  tmdbId: number
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  voteAverage: number
  voteCount: number
  popularity: number
  genres: string[]
  runtime: number
  originalLanguage: string
  trailerLink: string | null
}

interface FilmsResponse {
  success: boolean
  data: Film[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  filters: {
    search: string | null
    genre: string | null
    yearFrom: string | null
    yearTo: string | null
    sortBy: string
    sortOrder: string
    minRating: string | null
  }
}

export default function ExplorePage() {
  const { user } = useUser()
  const [films, setFilms] = useState<Film[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  })

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [sortBy, setSortBy] = useState('popularity')
  const [sortOrder, setSortOrder] = useState('desc')
  const [minRating, setMinRating] = useState('')

  // Modal states
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [watchList, setWatchList] = useState<any[]>([])

  // Rating states
  const [userRatings, setUserRatings] = useState<Record<number, { starRating: number; userNote: string }>>({})
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [filmToRate, setFilmToRate] = useState<Film | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)

  // Convert Film to TMDBMovie for the modal (extended with trailer info)
  const convertFilmToTMDBMovie = (film: Film): TMDBMovie & { trailerLink?: string | null } => {
    return {
      id: film.tmdbId,
      title: film.title,
      overview: film.overview,
      poster_path: film.posterPath,
      backdrop_path: film.backdropPath,
      release_date: film.releaseDate,
      vote_average: film.voteAverage / 10, // Convert back from integer
      vote_count: film.voteCount,
      genre_ids: [], // We don't have genre IDs, just names
      adult: false, // Assume false since we filter out adult content
      original_language: film.originalLanguage,
      original_title: film.title, // Use title as fallback
      popularity: film.popularity / 1000, // Convert back from integer
      video: false,
      trailerLink: film.trailerLink
    }
  }

  // Load user's watchlist
  const loadWatchList = async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`/api/watch-list?userId=${user.id}`)
      const data = await response.json()
      if (data.success) {
        setWatchList(data.data)
      }
    } catch (error) {
      console.error('Error loading watchlist:', error)
    }
  }

  // Load user's movie ratings
  const loadUserRatings = async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`/api/save-movie-rating?userId=${user.id}`)
      const data = await response.json()
      if (data.success) {
        const ratingsMap: Record<number, { starRating: number; userNote: string }> = {}
        data.data.forEach((rating: any) => {
          if (rating.ratingType === 'star' && rating.starRating) {
            ratingsMap[rating.tmdbMovieId] = {
              starRating: rating.starRating,
              userNote: rating.userNote || ''
            }
          }
        })
        setUserRatings(ratingsMap)
      }
    } catch (error) {
      console.error('Error loading user ratings:', error)
    }
  }

  useEffect(() => {
    loadWatchList()
    loadUserRatings()
  }, [user])

  const handleMovieClick = (film: Film) => {
    const tmdbMovie = convertFilmToTMDBMovie(film)
    setSelectedMovie(tmdbMovie)
    setShowModal(true)
  }

  const handleAddToWatchList = async (movie: TMDBMovie, note: string) => {
    if (!user?.id) return

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
          userNote: note || null,
          addedFrom: 'explore'
        }),
      })

      const data = await response.json()
      if (data.success) {
        await loadWatchList() // Refresh watchlist
      } else {
        console.error('Failed to add to watchlist:', data.error)
        alert(data.error || 'Failed to add movie to watchlist')
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error)
      alert('Failed to add movie to watchlist')
    }
  }

  const handleUpdateMovieRating = async (movie: TMDBMovie, ratingType: 'like' | 'dislike' | 'love', note: string) => {
    if (!user?.id) return

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
          ratingType,
          movieData: movie,
          userNote: note || null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        // Rating updated successfully
      }
    } catch (error) {
      console.error('Error updating movie rating:', error)
    }
  }

  // Handle star rating click
  const handleStarRatingClick = (film: Film, rating: number, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent triggering movie detail modal
    
    if (!user?.id) return
    
    setFilmToRate(film)
    setShowRatingModal(true)
  }

  // Handle quick rating submission
  const handleQuickRatingSubmit = async (rating: number, note: string) => {
    if (!user?.id || !filmToRate) return

    setRatingLoading(true)
    try {
      const response = await fetch('/api/save-movie-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          tmdbMovieId: filmToRate.tmdbId,
          movieTitle: filmToRate.title,
          ratingType: 'star',
          starRating: rating,
          movieData: {
            id: filmToRate.tmdbId,
            title: filmToRate.title,
            poster_path: filmToRate.posterPath,
            release_date: filmToRate.releaseDate,
            overview: filmToRate.overview,
          },
          userNote: note || null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        // Update local ratings state
        setUserRatings(prev => ({
          ...prev,
          [filmToRate.tmdbId]: { starRating: rating, userNote: note }
        }))
        setShowRatingModal(false)
        setFilmToRate(null)
      }
    } catch (error) {
      console.error('Error saving star rating:', error)
    } finally {
      setRatingLoading(false)
    }
  }

  const fetchFilms = async (page: number = currentPage) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '24',
        sortBy,
        sortOrder,
      })

      if (searchTerm.trim()) params.append('search', searchTerm.trim())
      if (selectedGenre) params.append('genre', selectedGenre)
      if (yearFrom) params.append('yearFrom', yearFrom)
      if (yearTo) params.append('yearTo', yearTo)
      if (minRating) params.append('minRating', minRating)

      const url = `/api/films?${params}`
      const response = await fetch(url)
      const data: FilmsResponse = await response.json()

      if (data.success) {
        setFilms(data.data)
        setPagination(data.pagination)
      } else {
        console.error('Failed to fetch films')
        setFilms([])
      }
    } catch (error) {
      console.error('Error fetching films:', error)
      setFilms([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFilms(1)
    setCurrentPage(1)
  }, [searchTerm, selectedGenre, yearFrom, yearTo, sortBy, sortOrder, minRating])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    fetchFilms(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPosterUrl = (posterPath: string | null) => {
    if (!posterPath) return '/placeholder-movie.svg'
    return `https://image.tmdb.org/t/p/w500${posterPath}`
  }

  const formatRating = (rating: number) => {
    return (rating / 10).toFixed(1)
  }

  const formatYear = (dateString: string) => {
    return dateString ? new Date(dateString).getFullYear() : 'Unknown'
  }

  const commonGenres = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'Horror', 'Music', 'Mystery', 'Romance',
    'Science Fiction', 'Thriller', 'War', 'Western'
  ]

  const renderPaginationButtons = () => {
    const buttons = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Previous button
    buttons.push(
      <Button
        key="prev"
        variant="outline"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={!pagination.hasPreviousPage}
        className="mx-1"
      >
        Previous
      </Button>
    )

    // First page if not visible
    if (startPage > 1) {
      buttons.push(
        <Button
          key={1}
          variant={currentPage === 1 ? "default" : "outline"}
          onClick={() => handlePageChange(1)}
          className="mx-1"
        >
          1
        </Button>
      )
      if (startPage > 2) {
        buttons.push(<span key="ellipsis1" className="mx-2">...</span>)
      }
    }

    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <Button
          key={i}
          variant={currentPage === i ? "default" : "outline"}
          onClick={() => handlePageChange(i)}
          className="mx-1"
        >
          {i}
        </Button>
      )
    }

    // Last page if not visible
    if (endPage < pagination.totalPages) {
      if (endPage < pagination.totalPages - 1) {
        buttons.push(<span key="ellipsis2" className="mx-2">...</span>)
      }
      buttons.push(
        <Button
          key={pagination.totalPages}
          variant={currentPage === pagination.totalPages ? "default" : "outline"}
          onClick={() => handlePageChange(pagination.totalPages)}
          className="mx-1"
        >
          {pagination.totalPages}
        </Button>
      )
    }

    // Next button
    buttons.push(
      <Button
        key="next"
        variant="outline"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={!pagination.hasNextPage}
        className="mx-1"
      >
        Next
      </Button>
    )

    return buttons
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Explore Films</h1>
        <p className="text-gray-600">
          Discover movies from our comprehensive film database
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium mb-1">Search</label>
          <Input
            type="text"
            placeholder="Search movies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Genre */}
        <div>
          <label className="block text-sm font-medium mb-1">Genre</label>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Genres</option>
            {commonGenres.map(genre => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>

        {/* Year Range */}
        <div>
          <label className="block text-sm font-medium mb-1">Release Year</label>
          <div className="flex space-x-1">
            <Input
              type="number"
              placeholder="From"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              min="1900"
              max="2030"
            />
            <Input
              type="number"
              placeholder="To"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              min="1900"
              max="2030"
            />
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium mb-1">Min Rating</label>
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any Rating</option>
            <option value="5">5.0+</option>
            <option value="6">6.0+</option>
            <option value="7">7.0+</option>
            <option value="8">8.0+</option>
            <option value="9">9.0+</option>
          </select>
        </div>
      </div>

      {/* Sort Options */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="popularity">Popularity</option>
            <option value="release_date">Release Date</option>
            <option value="vote_average">Rating</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Order:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>



      {/* Results Info */}
      {!loading && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {((currentPage - 1) * pagination.limit) + 1} - {Math.min(currentPage * pagination.limit, pagination.totalCount)} of {pagination.totalCount} films
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {/* Films Grid */}
      {!loading && films.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {films.map((film) => (
            <Card 
              key={film.id} 
              className="group hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleMovieClick(film)}
            >
              <CardContent className="p-0">
                <div className="aspect-[2/3] relative overflow-hidden rounded-t-lg">
                  <img
                    src={getPosterUrl(film.posterPath)}
                    alt={film.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = '/placeholder-movie.svg'
                    }}
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                    ⭐ {formatRating(film.voteAverage)}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                    {film.title}
                  </h3>
                  <div className="text-xs text-gray-500 mb-1">
                    {formatYear(film.releaseDate)}
                  </div>
                  {film.genres && film.genres.length > 0 && (
                    <div className="text-xs text-gray-400 line-clamp-1 mb-2">
                      {film.genres.slice(0, 2).join(', ')}
                    </div>
                  )}
                  
                  {/* Star Rating */}
                  <div className="flex items-center justify-between">
                    <div onClick={(e) => e.stopPropagation()}>
                      <StarRating
                        rating={userRatings[film.tmdbId]?.starRating || 0}
                        onRatingChange={(rating) => {
                          setFilmToRate(film)
                          setShowRatingModal(true)
                        }}
                        size="sm"
                        readonly={!user?.id}
                      />
                    </div>
                    {userRatings[film.tmdbId] && (
                      <div className="text-xs text-blue-600 font-medium">
                        Rated
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && films.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No films found matching your criteria.</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search terms.</p>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          {renderPaginationButtons()}
        </div>
      )}

      {/* Quick Rating Modal */}
      <QuickRatingModal
        film={filmToRate}
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false)
          setFilmToRate(null)
        }}
        onSubmit={handleQuickRatingSubmit}
        isLoading={ratingLoading}
      />

      {/* Movie Detail Modal */}
      <MovieDetailModal
        movie={selectedMovie}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedMovie(null)
        }}
        onAddToWatchList={handleAddToWatchList}
        onUpdateMovieRating={handleUpdateMovieRating}
        isInWatchList={watchList.some(item => item.tmdbMovieId === selectedMovie?.id)}
        existingNote={watchList.find(item => item.tmdbMovieId === selectedMovie?.id)?.userNote || ''}
        userId={user?.id}
      />
    </div>
  )
} 