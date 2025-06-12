'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface MovieRecommendation {
  name: string
  explanation: string
  confidence: number
  tmdb_data?: {
    id: number
    title: string
    overview: string
    poster_url: string | null
    backdrop_url: string | null
    release_date: string
    vote_average: number
    vote_count: number
  } | null
  tmdb_error?: string | null
}

type RatingType = 'like' | 'dislike' | 'love' | 'not_seen'

export default function MovieRecommendations() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [completedRatings, setCompletedRatings] = useState<Set<number>>(new Set())
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      
      setUser(session.user)
      loadRecommendations()
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const loadRecommendations = async () => {
    try {
      // Check if we have recommendations in sessionStorage
      const storedRecommendations = sessionStorage.getItem('movieRecommendations')
      if (storedRecommendations) {
        const parsedRecommendations = JSON.parse(storedRecommendations)
        setRecommendations(parsedRecommendations)
        setLoading(false)
        return
      }

      // If no stored recommendations, redirect back to genre preferences
      router.push('/genre-preferences')
    } catch (error) {
      console.error('Error loading recommendations:', error)
      setLoading(false)
    }
  }

  const handleRating = async (ratingType: RatingType) => {
    if (!user || !recommendations[currentIndex]) return

    setSaving(true)
    try {
      const currentMovie = recommendations[currentIndex]
      
      // Only save if we have TMDB data
      if (currentMovie.tmdb_data) {
        const response = await fetch('/api/save-movie-rating', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            tmdbMovieId: currentMovie.tmdb_data.id,
            movieTitle: currentMovie.tmdb_data.title,
            ratingType: ratingType,
            movieData: {
              poster_url: currentMovie.tmdb_data.poster_url,
              overview: currentMovie.tmdb_data.overview,
              release_date: currentMovie.tmdb_data.release_date,
              vote_average: currentMovie.tmdb_data.vote_average,
              llm_explanation: currentMovie.explanation,
              llm_confidence: currentMovie.confidence
            }
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Error saving rating:', errorData)
          alert('Failed to save rating. Please try again.')
          return
        }

        console.log('Rating saved successfully')
      }

      // Mark as completed
      setCompletedRatings(prev => new Set([...prev, currentIndex]))

      // Move to next movie or finish
      if (currentIndex < recommendations.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        // All movies rated, go to dashboard
        sessionStorage.removeItem('movieRecommendations')
        router.push('/dashboard')
      }

    } catch (error) {
      console.error('Error saving rating:', error)
      alert('Failed to save rating. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (currentIndex < recommendations.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // All movies processed, go to dashboard
      sessionStorage.removeItem('movieRecommendations')
      router.push('/dashboard')
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <LoadingSpinner 
          message="Loading your personalized movie recommendations..." 
          size="large"
        />
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Recommendations Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn't find any movie recommendations. Please try generating them again.
          </p>
          <button
            onClick={() => router.push('/genre-preferences')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Generate New Recommendations
          </button>
        </div>
      </div>
    )
  }

  const currentMovie = recommendations[currentIndex]
  const progress = ((currentIndex + 1) / recommendations.length) * 100

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b bg-purple-600 text-white">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">Rate Your Movies</h1>
              <button
                onClick={signOut}
                className="text-purple-200 hover:text-white text-sm"
              >
                Sign Out
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-purple-500 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-purple-200 text-sm mt-2">
              Movie {currentIndex + 1} of {recommendations.length}
            </p>
          </div>

          {/* Movie Card */}
          <div className="p-8">
            {currentMovie.tmdb_data ? (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Movie Poster */}
                <div className="flex justify-center">
                  {currentMovie.tmdb_data.poster_url ? (
                    <img
                      src={currentMovie.tmdb_data.poster_url}
                      alt={currentMovie.tmdb_data.title}
                      className="rounded-lg shadow-lg max-w-full h-auto max-h-96 object-cover"
                    />
                  ) : (
                    <div className="w-64 h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-6xl">🎬</span>
                    </div>
                  )}
                </div>

                {/* Movie Details */}
                <div className="space-y-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {currentMovie.tmdb_data.title}
                    </h2>
                    {currentMovie.tmdb_data.release_date && (
                      <p className="text-gray-600">
                        Released: {new Date(currentMovie.tmdb_data.release_date).getFullYear()}
                      </p>
                    )}
                    {currentMovie.tmdb_data.vote_average > 0 && (
                      <p className="text-gray-600">
                        ⭐ {currentMovie.tmdb_data.vote_average.toFixed(1)}/10 
                        ({currentMovie.tmdb_data.vote_count.toLocaleString()} votes)
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Overview</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {currentMovie.tmdb_data.overview || 'No description available.'}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Why we recommended this (Confidence: {currentMovie.confidence}/10)
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      {currentMovie.explanation}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">😞</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Movie Not Found
                </h2>
                <p className="text-gray-600 mb-2">
                  We couldn't find "{currentMovie.name}" in our movie database.
                </p>
                {currentMovie.tmdb_error && (
                  <p className="text-red-600 text-sm">
                    Error: {currentMovie.tmdb_error}
                  </p>
                )}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Why we recommended this (Confidence: {currentMovie.confidence}/10)
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {currentMovie.explanation}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rating Buttons */}
          <div className="p-6 border-t bg-gray-50">
            <div className="flex flex-col space-y-4">
              <p className="text-center text-gray-700 font-medium">
                How do you feel about this movie?
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => handleRating('love')}
                  disabled={saving || !currentMovie.tmdb_data}
                  className="flex flex-col items-center p-4 border-2 border-red-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl mb-2">❤️</span>
                  <span className="text-sm font-medium">Love it!</span>
                </button>

                <button
                  onClick={() => handleRating('like')}
                  disabled={saving || !currentMovie.tmdb_data}
                  className="flex flex-col items-center p-4 border-2 border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl mb-2">👍</span>
                  <span className="text-sm font-medium">Like it</span>
                </button>

                <button
                  onClick={() => handleRating('dislike')}
                  disabled={saving || !currentMovie.tmdb_data}
                  className="flex flex-col items-center p-4 border-2 border-red-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl mb-2">👎</span>
                  <span className="text-sm font-medium">Don't like</span>
                </button>

                <button
                  onClick={() => handleRating('not_seen')}
                  disabled={saving || !currentMovie.tmdb_data}
                  className="flex flex-col items-center p-4 border-2 border-gray-300 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl mb-2">🤷</span>
                  <span className="text-sm font-medium">Haven't seen</span>
                </button>
              </div>

              {!currentMovie.tmdb_data && (
                <p className="text-center text-red-600 text-sm">
                  Cannot rate this movie as it wasn't found in our database.
                </p>
              )}

              {saving && (
                <div className="flex items-center justify-center">
                  <LoadingSpinner message="Saving your rating..." size="small" />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              <button
                onClick={handleSkip}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Skip {currentIndex === recommendations.length - 1 ? '& Finish' : '→'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 