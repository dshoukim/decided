'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import WatchList from '@/components/WatchList'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, ListVideo } from 'lucide-react'

interface UserData {
  name: string
  username: string
  streaming_services: string[] | null
  selected_genres: string[] | null
  selected_characteristics: string[] | null
}

interface StreamingService {
  id: number
  name: string
  logo_url: string
  monthly_price: number
}

interface Genre {
  id: number
  name: string
  description: string
  icon: string
  color: string
}

interface GenreCharacteristic {
  id: number
  genre_id: number
  name: string
  description: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [streamingServices, setStreamingServices] = useState<StreamingService[]>([])
  const [userGenres, setUserGenres] = useState<Genre[]>([])
  const [userCharacteristics, setUserCharacteristics] = useState<GenreCharacteristic[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      
      setUser(session.user)
      loadUserData(session.user.id)
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

  const loadUserData = async (userId: string) => {
    try {
      console.log('Loading user data for userId:', userId)
      
      // Fetch user profile data using our API
      const response = await fetch(`/api/user-profile?userId=${encodeURIComponent(userId)}`)
      const data = await response.json()

      console.log('User profile API response:', data)

      if (!data.success) {
        console.error('Error loading user profile:', data.error)
        setLoading(false)
        return
      }

      if (!data.userData) {
        console.log('No user profile found yet')
        setUserData(null)
        setLoading(false)
        return
      }

      setUserData(data.userData)
      console.log('Set user data:', data.userData)

      // Set the fetched data
      setStreamingServices(data.streamingServices || [])
      setUserGenres(data.userGenres || [])
      setUserCharacteristics(data.userCharacteristics || [])

      setLoading(false)
    } catch (error) {
      console.error('Error loading user data:', error)
      setLoading(false)
    }
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
    <div className="container mx-auto max-w-4xl py-12">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Welcome, {userData?.name || 'Loading...'}!</h1>
        <p className="text-lg text-gray-600">What are we watching tonight?</p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Browse Movies</CardTitle>
            <CardDescription>Find new movies to add to your list</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <Search className="mr-2 h-4 w-4" />
              Search Movies
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>View Your Watch List</CardTitle>
            <CardDescription>See all the movies you want to watch</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">
              <ListVideo className="mr-2 h-4 w-4" />
              Go to Watch List
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Decided CTA */}
      <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-purple-900 mb-2">Can't decide what to watch?</h3>
            <p className="text-purple-700">
              Start a tournament with a friend to find the perfect movie from your combined watch lists!
            </p>
          </div>
          <button
            onClick={() => router.push('/decide-together')}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
          >
            🎬 Decided
          </button>
        </div>
      </div>

      {/* Main content - WatchList */}
      {user && <WatchList user={user} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {userData?.name || 'Loading...'}</p>
            <p><span className="font-medium">Username:</span> {userData?.username || 'Loading...'}</p>
            <p><span className="font-medium">Email:</span> {user?.email}</p>
            <p><span className="font-medium">Account Created:</span> {new Date(user?.created_at || '').toLocaleDateString()}</p>
            <p><span className="font-medium">Provider:</span> Google</p>
          </div>
          {!userData && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-700">
                Profile data not found. You may need to complete your profile setup.
              </p>
              <button
                onClick={() => router.push('/profile-setup')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Complete Profile Setup
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Streaming Services</h3>
          {streamingServices.length > 0 ? (
            <div className="space-y-3">
              {streamingServices.map((service) => (
                <div key={service.id} className="flex items-center justify-between">
                  <span className="text-gray-700">{service.name}</span>
                  <span className="text-sm text-gray-500">
                    {service.monthly_price === 0 ? 'Free' : `$${service.monthly_price}/month`}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-3">
                <div className="flex items-center justify-between font-medium">
                  <span>Total Monthly Cost:</span>
                  <span>${streamingServices.reduce((total, service) => total + service.monthly_price, 0).toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => router.push('/streaming-preferences')}
                className="w-full mt-3 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Update Preferences
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-3">No streaming services selected yet</p>
              <button
                onClick={() => router.push('/streaming-preferences')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Select Services
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Steps</h3>
          <ul className="space-y-2 text-gray-600">
            <li>✅ Account created</li>
            <li>✅ Profile setup completed</li>
            <li className={streamingServices.length > 0 ? 'text-green-600' : ''}>
              {streamingServices.length > 0 ? '✅' : '⏳'} Streaming preferences {streamingServices.length > 0 ? 'selected' : 'pending'}
            </li>
            <li>🚀 Ready to use the application!</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Developer Info</h3>
        <p className="text-blue-700 text-sm">
          This is a demo application showcasing Supabase authentication with Google OAuth.
          Your profile data has been successfully stored in the users table.
        </p>
      </div>
    </div>
  )
} 