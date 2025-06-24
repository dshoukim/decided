'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useUser } from '@/lib/hooks/useUser'
import { supabase } from '@/lib/supabase'

interface StreamingService {
  id: number
  name: string
  logo_url: string
  description: string
  monthly_price: number
  website_url: string
}

export default function StreamingPreferences() {
  const router = useRouter()
  const { user, isLoading } = useUser()
  const [streamingServices, setStreamingServices] = useState<StreamingService[]>([])
  const [selectedServices, setSelectedServices] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/signin')
      return
    }

    if (user) {
      loadStreamingServices()
      loadUserPreferences(user.id)
    }
  }, [user, isLoading, router])

  const loadStreamingServices = async () => {
    try {
      const response = await fetch('/api/streaming-services')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStreamingServices(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading streaming services:', error)
    }
  }

  const loadUserPreferences = async (userId: string) => {
    try {
      const response = await fetch(`/api/user-profile?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.streaming_services) {
          // Parse the streaming_services field if it's a string
          try {
            const services = typeof data.data.streaming_services === 'string' 
              ? JSON.parse(data.data.streaming_services)
              : data.data.streaming_services
            if (Array.isArray(services)) {
              setSelectedServices(services)
            }
          } catch (error) {
            console.error('Error parsing existing streaming services:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error loading user preferences:', error)
    }
  }

  const handleServiceToggle = (serviceId: number) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId)
      } else {
        return [...prev, serviceId]
      }
    })
  }

  const handleImageError = (serviceId: number) => {
    setFailedImages(prev => new Set([...prev, serviceId]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    try {
      const response = await fetch('/api/user-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          streaming_services: selectedServices
        })
      })

      if (!response.ok) {
        console.error('Error saving streaming preferences:', response.statusText)
        alert('Error saving preferences. Please try again.')
        return
      }

      const data = await response.json()
      
      if (data.success) {
        alert('Streaming preferences saved successfully!')
        router.push('/genre-preferences')
      } else {
        console.error('Error saving streaming preferences:', data.error)
        alert('Error saving preferences. Please try again.')
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      alert('Unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push('/genre-preferences')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const totalCost = selectedServices.reduce((total, serviceId) => {
    const service = streamingServices.find(s => s.id === serviceId)
    return total + (service?.monthly_price || 0)
  }, 0)

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Choose Your Streaming Services</h1>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Sign Out
            </button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800">
              Select the streaming services you currently subscribe to. This helps us personalize your experience.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {streamingServices.map((service) => (
                <div
                  key={service.id}
                  className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedServices.includes(service.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleServiceToggle(service.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 relative flex items-center justify-center bg-white rounded-lg shadow-sm">
                        {service.logo_url && !failedImages.has(service.id) ? (
                          <Image
                            src={service.logo_url}
                            alt={`${service.name} logo`}
                            width={40}
                            height={40}
                            className="object-contain"
                            onError={() => handleImageError(service.id)}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-gray-600">{service.name}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <p className="text-sm text-gray-600">
                          {service.monthly_price === 0 ? 'Free' : `$${service.monthly_price.toFixed(2)}/month`}
                        </p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedServices.includes(service.id)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedServices.includes(service.id) && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{service.description}</p>
                </div>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">Selected Services Summary</h3>
                <p className="text-green-700">
                  You've selected {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} 
                  {totalCost > 0 && ` with a total monthly cost of $${totalCost.toFixed(2)}`}
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  `Save Selection${selectedServices.length > 0 ? ` (${selectedServices.length} services)` : ''}`
                )}
              </button>
              
              <button
                type="button"
                onClick={handleSkip}
                className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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