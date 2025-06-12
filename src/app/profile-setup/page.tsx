'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { checkUserProfile } from '@/lib/auth-utils'

export default function ProfileSetup() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    username: '',
    gender: ''
  })
  const router = useRouter()

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      
      // Check if user already has a profile
      const { exists, profileData } = await checkUserProfile(session.user.id)
      
      if (exists) {
        // User already has a profile, redirect them appropriately
        if (!profileData.streaming_services || profileData.streaming_services.length === 0) {
          router.push('/streaming-preferences')
        } else {
          router.push('/dashboard')
        }
        return
      }
      
      setUser(session.user)
      
      // Pre-fill form with user data from auth metadata
      const userMetadata = session.user.user_metadata
      
      // For Google OAuth users, we have name data in user_metadata
      // For email/password users, we might have name data in user_metadata.name from signup
      let firstName = ''
      let lastName = ''
      
      if (userMetadata?.given_name && userMetadata?.family_name) {
        // Google OAuth user
        firstName = userMetadata.given_name
        lastName = userMetadata.family_name
      } else if (userMetadata?.name) {
        // Email/password user with name from signup form
        const nameParts = userMetadata.name.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      }
      
      setFormData({
        firstName,
        lastName,
        email: session.user.email || '',
        dateOfBirth: '',
        username: '',
        gender: ''
      })
      
      setLoading(false)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    try {
      const profileData = {
        id: user.id,
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        username: formData.username
      }
      
      console.log('Saving profile data:', profileData)
      
      const response = await fetch('/api/create-user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData)
      })
      
      const data = await response.json()
      
      if (!data.success) {
        if (response.status === 409) {
          // User already exists or username/email taken
          if (data.error.includes('already exists')) {
            console.log('User already exists, redirecting to appropriate page')
            // Check where they should go
            const { exists, profileData } = await checkUserProfile(user.id)
            if (exists) {
              if (!profileData.streaming_services || profileData.streaming_services.length === 0) {
                router.push('/streaming-preferences')
              } else {
                router.push('/dashboard')
              }
              return
            }
          } else {
            alert(data.error)
            return
          }
        } else {
          console.error('Error saving profile:', data.error)
          alert(`Error saving profile: ${data.error}. Please try again.`)
          return
        }
      }
      
      console.log('Profile saved successfully:', data.data)
      alert('Profile saved successfully!')
      
      // Redirect to streaming preferences page
      router.push('/streaming-preferences')
    } catch (error) {
      console.error('Unexpected error:', error)
      alert('Unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Setup Your Profile</h1>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Sign Out
            </button>
          </div>

          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-green-800">
              Welcome! Please complete your profile information below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">Email is pre-filled from your Google account</p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                type="text"
                id="username"
                name="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Choose a unique username"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth *
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                required
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleSelectChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select gender (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  'Save Profile'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
} 