'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getRedirectPath } from '@/lib/auth-utils'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          router.push('/?error=auth_failed')
          return
        }

        if (!session?.user) {
          console.log('No session found, redirecting to home')
          router.push('/')
          return
        }

        console.log('Auth callback - user found:', session.user.email)
        
        // Store userId in localStorage for API calls
        if (session.user.id) {
          localStorage.setItem('userId', session.user.id)
        }
        
        // Determine where to redirect the user based on their profile status
        const redirectPath = await getRedirectPath(session.user)
        console.log('Redirecting to:', redirectPath)
        
        router.push(redirectPath)
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        router.push('/?error=auth_failed')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Setting up your account...</h2>
        <p className="text-gray-600">Please wait while we redirect you to the right place.</p>
      </div>
    </div>
  )
} 