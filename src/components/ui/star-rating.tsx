'use client'

import { useState } from 'react'

interface StarRatingProps {
  rating: number
  onRatingChange?: (rating: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export default function StarRating({ 
  rating, 
  onRatingChange, 
  readonly = false, 
  size = 'md',
  showLabel = false,
  className = ''
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0)

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1: return 'Terrible'
      case 2: return 'Bad'
      case 3: return 'Okay'
      case 4: return 'Good'
      case 5: return 'Excellent'
      default: return ''
    }
  }

  const handleStarClick = (star: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(star)
    }
  }

  const handleStarHover = (star: number) => {
    if (!readonly) {
      setHoverRating(star)
    }
  }

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0)
    }
  }

  const displayRating = hoverRating || rating

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div 
        className="flex items-center gap-0.5"
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`${sizeClasses[size]} transition-colors duration-150 ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => handleStarHover(star)}
          >
            <svg
              className={`w-full h-full transition-colors duration-150 ${
                star <= displayRating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300 fill-current'
              }`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
      </div>
      
      {showLabel && displayRating > 0 && (
        <span className="text-sm text-gray-600 ml-1">
          {getRatingLabel(displayRating)}
        </span>
      )}
    </div>
  )
} 