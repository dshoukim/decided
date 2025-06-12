import { User } from '@supabase/supabase-js'

/**
 * Check if a user profile exists in the database using the API
 */
export async function checkUserProfile(userId: string): Promise<{
  exists: boolean
  profileData?: any
  error?: any
}> {
  try {
    const response = await fetch(`/api/user-profile?userId=${encodeURIComponent(userId)}`)
    const data = await response.json()

    if (!data.success) {
      console.error('Error checking user profile:', data.error)
      return { exists: false, error: data.error }
    }

    if (!data.userData) {
      // User doesn't exist - this is fine for new users
      return { exists: false }
    }

    return { exists: true, profileData: data.userData }
  } catch (error) {
    console.error('Unexpected error checking user profile:', error)
    return { exists: false, error }
  }
}

/**
 * Determine where to redirect a user based on their profile status and auth metadata
 */
export async function getRedirectPath(user: User): Promise<string> {
  const { exists, profileData } = await checkUserProfile(user.id)
  
  if (!exists) {
    // New user - send to profile setup
    return '/profile-setup'
  }
  
  // Check if user has completed basic profile information
  // For email/password users, they might not have name/username set
  if (!profileData.name || !profileData.username) {
    return '/profile-setup'
  }
  
  // Existing user - check if they've completed streaming preferences
  if (!profileData.streaming_services || profileData.streaming_services.length === 0) {
    return '/streaming-preferences'
  }
  
  // Fully set up user - send to dashboard
  return '/dashboard'
} 