'use client'

import { useState } from 'react'
import { TournamentMovie } from '@/lib/stores/tournamentStore'
import { Card } from '@/components/ui/card'
import { CheckCircle, Film, Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileTournamentMovieCardProps {
  movie: TournamentMovie
  onSelect: () => void
  isSelected?: boolean
  disabled?: boolean
}

export function MobileTournamentMovieCard({ 
  movie, 
  onSelect, 
  isSelected, 
  disabled 
}: MobileTournamentMovieCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 cursor-pointer min-h-[120px]",
        isSelected && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950",
        disabled && "opacity-50 cursor-not-allowed",
        "active:scale-95 touch-manipulation" // Mobile touch optimization
      )}
      onClick={disabled ? undefined : onSelect}
    >
      <div className="flex gap-4 p-4">
        {/* Progressive image loading */}
        <div className="relative w-20 h-28 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
          {!imageError && movie.poster_path && (
            <img
              src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
              alt={movie.title}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          {!imageLoaded && !imageError && movie.poster_path && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
          {(imageError || !movie.poster_path) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <Film className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>
        
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
            {movie.title}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {movie.release_date ? new Date(movie.release_date).getFullYear() : 'TBA'}
          </p>
          {movie.vote_average && movie.vote_average > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500 fill-current" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {movie.vote_average.toFixed(1)}
              </span>
            </div>
          )}
          {movie.fromUsers && movie.fromUsers.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {movie.fromUsers.length === 2 ? 'In both lists' : 'In your list'}
            </p>
          )}
        </div>
        
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="h-5 w-5 text-blue-500" />
          </div>
        )}
      </div>
    </Card>
  )
} 