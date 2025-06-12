'use client'

import { useState, useEffect } from 'react'
import { TMDBMovie } from '@/lib/tmdb'

interface RateMovieModalProps {
  movie: TMDBMovie | null
  isOpen: boolean
  onClose: () => void
  onAddMovieRating: (movie: TMDBMovie, ratingType: 'like' | 'dislike' | 'love', note: string) => void
}

export default function RateMovieModal({
  movie,
  isOpen,
  onClose,
  onAddMovieRating
}: RateMovieModalProps) {
  const [rating, setRating] = useState<'like' | 'dislike' | 'love' | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      setRating(null)
      setNote('')
    }
  }, [isOpen, movie])

  const handleSubmit = () => {
    if (movie && rating) {
      onAddMovieRating(movie, rating, note)
      onClose()
    }
  }

  if (!isOpen || !movie) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Rate Movie</h2>
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
            <div className="flex gap-6">
              {/* Movie Poster */}
              <div className="flex-shrink-0">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                    alt={movie.title}
                    className="w-32 rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-32 aspect-[2/3] bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-4xl">🎬</span>
                  </div>
                )}
              </div>

              {/* Movie Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-2">{movie.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    {movie.release_date && (
                      <span>📅 {new Date(movie.release_date).getFullYear()}</span>
                    )}
                    {movie.vote_average > 0 && (
                      <span>⭐ {movie.vote_average.toFixed(1)}/10</span>
                    )}
                  </div>
                </div>

                {movie.overview && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Overview</h3>
                    <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">{movie.overview}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rating Section */}
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How did you like this movie?</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setRating('love')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      rating === 'love'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">❤️</div>
                    <div className="text-sm font-medium">Loved it!</div>
                  </button>
                  
                  <button
                    onClick={() => setRating('like')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      rating === 'like'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">👍</div>
                    <div className="text-sm font-medium">Liked it</div>
                  </button>
                  
                  <button
                    onClick={() => setRating('dislike')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      rating === 'dislike'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">👎</div>
                    <div className="text-sm font-medium">Didn't like it</div>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
                  What did you think about it? (optional)
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Share your thoughts, favorite moments, or what you learned..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
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
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!rating}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                rating
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Add to Movies I've Seen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 