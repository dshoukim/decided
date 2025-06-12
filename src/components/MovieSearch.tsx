'use client'

import { useState, useEffect, useRef } from 'react'
import { TMDBMovie } from '@/lib/tmdb'

interface MovieSearchProps {
  onMovieSelect: (movie: TMDBMovie) => void
  placeholder?: string
}

export default function MovieSearch({ onMovieSelect, placeholder = "Search for movies..." }: MovieSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const searchMovies = async () => {
      if (query.length < 2) {
        setResults([])
        setShowResults(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/search-movies?query=${encodeURIComponent(query)}`)
        const data = await response.json()
        
        if (data.success) {
          setResults(data.results || [])
          setShowResults(true)
        }
      } catch (error) {
        console.error('Error searching movies:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchMovies, 300)
    return () => clearTimeout(debounceTimer)
  }, [query])

  const handleMovieSelect = (movie: TMDBMovie) => {
    onMovieSelect(movie)
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.length === 0 && !loading && query.length >= 2 && (
            <div className="p-4 text-gray-500 text-center">
              No movies found for "{query}"
            </div>
          )}
          
          {results.map((movie) => (
            <div
              key={movie.id}
              onClick={() => handleMovieSelect(movie)}
              className="flex items-start p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
            >
              <div className="flex-shrink-0 w-12 h-16 mr-3">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-gray-400 text-xs">🎬</span>
                  </div>
                )}
              </div>
              
              <div className="flex-grow min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {movie.title}
                </h4>
                {movie.release_date && (
                  <p className="text-xs text-gray-500">
                    {new Date(movie.release_date).getFullYear()}
                  </p>
                )}
                {movie.vote_average > 0 && (
                  <p className="text-xs text-gray-500">
                    ⭐ {movie.vote_average.toFixed(1)}/10
                  </p>
                )}
                {movie.overview && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {movie.overview.length > 100 
                      ? movie.overview.substring(0, 100) + '...'
                      : movie.overview
                    }
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 