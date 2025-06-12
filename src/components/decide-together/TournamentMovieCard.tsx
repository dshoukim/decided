'use client'

import { TournamentMovie } from '@/lib/stores/tournamentStore'
import { Card } from '@/components/ui/card'
import { Check, Film } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TournamentMovieCardProps {
  movie: TournamentMovie
  onSelect: () => void
  isSelected?: boolean
  disabled?: boolean
}

export function TournamentMovieCard({ 
  movie, 
  onSelect, 
  isSelected, 
  disabled 
}: TournamentMovieCardProps) {
  return (
    <div 
      className={cn(
        "relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer",
        "transition-all duration-300 hover:shadow-xl hover:scale-105",
        isSelected && "ring-4 ring-purple-500 shadow-purple-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={!disabled ? onSelect : undefined}
    >
      <div className="aspect-[2/3] relative">
        {movie.poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Film className="h-16 w-16 text-gray-400" />
          </div>
        )}
        
        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute inset-0 bg-purple-500 bg-opacity-20 flex items-center justify-center">
            <div className="bg-purple-500 text-white rounded-full p-3">
              <Check className="w-8 h-8" />
            </div>
          </div>
        )}
        
        {/* From Users Indicator */}
        {movie.fromUsers && movie.fromUsers.length > 0 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            {movie.fromUsers.length === 2 ? 'Both lists' : 'Your list'}
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
          {movie.title}
        </h3>
        
        {movie.release_date && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date(movie.release_date).getFullYear()}
          </p>
        )}
        
        {movie.vote_average && movie.vote_average > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-yellow-500">★</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {movie.vote_average.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
} 