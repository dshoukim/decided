'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Genre {
  id: number
  name: string
  description: string
  icon: string
  color: string
}

interface Characteristic {
  id: number
  genre_id: number
  name: string
  description: string
}

export default function GenrePreferences() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false)
  const [genres, setGenres] = useState<Genre[]>([])
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  const [selectedGenres, setSelectedGenres] = useState<number[]>([])
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<number[]>([])
  const [expandedGenre, setExpandedGenre] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      
      setUser(session.user)
      loadData()
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

  const loadData = async () => {
    try {
      // Load genres
      const { data: genresData, error: genresError } = await supabase
        .from('genres')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (genresError) {
        console.error('Error loading genres:', genresError)
        return
      }

      setGenres(genresData || [])

      // Load all characteristics
      const { data: characteristicsData, error: characteristicsError } = await supabase
        .from('genre_characteristics')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (characteristicsError) {
        console.error('Error loading characteristics:', characteristicsError)
        return
      }

      setCharacteristics(characteristicsData || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const handleGenreToggle = (genreId: number) => {
    setSelectedGenres(prev => {
      const newSelection = prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
      
      // If deselecting a genre, also deselect its characteristics
      if (prev.includes(genreId)) {
        const genreCharacteristics = characteristics.filter(c => c.genre_id === genreId)
        setSelectedCharacteristics(prevChar => 
          prevChar.filter(charId => !genreCharacteristics.some(c => c.id === charId))
        )
        
        // Close expanded section if deselecting
        if (expandedGenre === genreId) {
          setExpandedGenre(null)
        }
      }
      
      return newSelection
    })
  }

  const handleCharacteristicToggle = (characteristicId: number) => {
    setSelectedCharacteristics(prev => {
      if (prev.includes(characteristicId)) {
        return prev.filter(id => id !== characteristicId)
      } else {
        return [...prev, characteristicId]
      }
    })
  }

  const handleGenreExpand = (genreId: number) => {
    if (!selectedGenres.includes(genreId)) {
      return // Can't expand if genre not selected
    }
    
    setExpandedGenre(expandedGenre === genreId ? null : genreId)
  }

  const getGenreCharacteristics = (genreId: number) => {
    return characteristics.filter(c => c.genre_id === genreId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    try {
      // First, save the preferences to the database
      const { error } = await supabase
        .from('users')
        .update({
          selected_genres: selectedGenres.map(String),
          selected_characteristics: selectedCharacteristics.map(String)
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error saving genre preferences:', error)
        alert('Error saving preferences. Please try again.')
        return
      }

      // If preferences saved successfully, generate recommendations
      setGeneratingRecommendations(true)
      try {
        const requestData = {
          selectedGenres,
          selectedCharacteristics,
          userId: user.id
        }
        
        console.log('Calling recommendations API with data:', requestData)
        console.log('User object:', user)
        console.log('User ID type:', typeof user.id, 'Value:', user.id)
        
        const response = await fetch('/api/generate-recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        })

        const data = await response.json()
        console.log('API response:', { status: response.status, data })

        if (!response.ok) {
          console.error('Error generating recommendations:', data.error)
          alert(`Preferences saved, but failed to generate recommendations: ${data.error}`)
        } else {
          console.log('Generated recommendations:', data.recommendations)
          
          // Store recommendations in sessionStorage for the rating page
          sessionStorage.setItem('movieRecommendations', JSON.stringify(data.recommendations))
          
          // Redirect to movie recommendations page
          router.push('/movie-recommendations')
          return
        }
              } catch (recommendationError) {
          console.error('Error calling recommendations API:', recommendationError)
          alert('Preferences saved, but failed to generate recommendations. You can view them later from your dashboard.')
        } finally {
          setGeneratingRecommendations(false)
        }

      router.push('/dashboard')
    } catch (error) {
      console.error('Unexpected error:', error)
      alert('Unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push('/dashboard')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8 px-4">
      {generatingRecommendations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <LoadingSpinner 
              message="Generating your personalized movie recommendations..." 
              size="large"
            />
            <p className="text-gray-600 mt-4">
              This may take a few moments while we search for the perfect movies for you!
            </p>
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Choose Your Favorite Genres</h1>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Sign Out
            </button>
          </div>

          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-purple-800">
              Select the genres you enjoy most. Click on selected genres to explore specific characteristics you prefer.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {genres.map((genre) => {
                const genreCharacteristics = getGenreCharacteristics(genre.id)
                const isSelected = selectedGenres.includes(genre.id)
                const selectedGenreCharacteristics = genreCharacteristics.filter(c => 
                  selectedCharacteristics.includes(c.id)
                )
                
                return (
                  <div
                    key={genre.id}
                    className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleGenreToggle(genre.id)}
                    style={{
                      borderColor: isSelected ? genre.color : undefined,
                      backgroundColor: isSelected ? `${genre.color}10` : undefined
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{genre.icon}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{genre.name}</h3>
                          <p className="text-sm text-gray-600">{genre.description}</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    {/* Show selected characteristics as compact chips */}
                    {isSelected && selectedGenreCharacteristics.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {selectedGenreCharacteristics.slice(0, 3).map((characteristic) => (
                            <span
                              key={characteristic.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                            >
                              {characteristic.name}
                            </span>
                          ))}
                          {selectedGenreCharacteristics.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              +{selectedGenreCharacteristics.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {isSelected && genreCharacteristics.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGenreExpand(genre.id)
                        }}
                        className="w-full text-sm text-purple-600 hover:text-purple-800 flex items-center justify-center space-x-1 py-2 border border-purple-200 rounded hover:bg-purple-50 transition-colors"
                      >
                        <span>Customize preferences</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Modal for characteristics selection */}
            {expandedGenre && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {genres.find(g => g.id === expandedGenre)?.icon}
                        </span>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {genres.find(g => g.id === expandedGenre)?.name} Preferences
                        </h3>
                      </div>
                      <button
                        onClick={() => setExpandedGenre(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-gray-600 mt-2">
                      Select the specific characteristics you enjoy about this genre.
                    </p>
                  </div>
                  
                  <div className="p-6 overflow-y-auto max-h-96">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {getGenreCharacteristics(expandedGenre).map((characteristic) => (
                        <label 
                          key={characteristic.id}
                          className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border border-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCharacteristics.includes(characteristic.id)}
                            onChange={() => handleCharacteristicToggle(characteristic.id)}
                            className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              {characteristic.name}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {characteristic.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-6 border-t bg-gray-50">
                    <button
                      onClick={() => setExpandedGenre(null)}
                      className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary section */}
            {(selectedGenres.length > 0 || selectedCharacteristics.length > 0) && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">Your Preferences Summary</h3>
                <div className="text-green-700 space-y-1">
                  <p>
                    <span className="font-medium">Genres:</span> {selectedGenres.length} selected
                  </p>
                  <p>
                    <span className="font-medium">Specific characteristics:</span> {selectedCharacteristics.length} selected
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={saving || generatingRecommendations}
                className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : generatingRecommendations ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Recommendations...
                  </>
                ) : (
                  `Save Preferences${selectedGenres.length > 0 ? ` (${selectedGenres.length} genres)` : ''}`
                )}
              </button>
              
              <button
                type="button"
                onClick={handleSkip}
                className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Skip for Now
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
} 