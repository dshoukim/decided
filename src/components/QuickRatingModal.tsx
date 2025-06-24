'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StarRating from '@/components/ui/star-rating'

interface Film {
  id: number
  tmdbId: number
  title: string
  overview: string
  posterPath: string | null
  releaseDate: string
}

interface QuickRatingModalProps {
  film: Film | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (rating: number, note: string) => void
  isLoading?: boolean
}

export default function QuickRatingModal({
  film,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false
}: QuickRatingModalProps) {
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')

  if (!isOpen || !film) return null

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, note)
      // Reset form
      setRating(0)
      setNote('')
    }
  }

  const handleClose = () => {
    setRating(0)
    setNote('')
    onClose()
  }

  const getPromptText = (rating: number) => {
    switch (rating) {
      case 1:
        return "What didn't you like about this movie?"
      case 2:
        return "What aspects could have been better?"
      case 3:
        return "What are your thoughts on this movie?"
      case 4:
        return "What did you enjoy about this movie?"
      case 5:
        return "What made this movie excellent for you?"
      default:
        return "Share your thoughts about this movie (optional)"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {film.posterPath && (
                <img
                  src={`https://image.tmdb.org/t/p/w92${film.posterPath}`}
                  alt={film.title}
                  className="w-12 h-18 object-cover rounded"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Rate Movie
                </h3>
                <p className="text-sm text-gray-600 line-clamp-1">
                  {film.title}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(film.releaseDate).getFullYear()}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Star Rating */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">How would you rate this movie?</p>
            <StarRating
              rating={rating}
              onRatingChange={setRating}
              size="lg"
              showLabel
              className="justify-center"
            />
          </div>

          {/* Feedback Input */}
          {rating > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                {getPromptText(rating)}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 text-right">
                {note.length}/500 characters
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            ) : (
              'Save Rating'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 