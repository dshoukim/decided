'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { getRedirectPath } from '@/lib/auth-utils'
import AuthForm from '@/components/AuthForm'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const router = useRouter()

  useEffect(() => {
    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const error = urlParams.get('error')
    if (error === 'auth_failed') {
      setErrorMessage('Authentication failed. Please try again.')
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      // If user is already logged in, determine where to redirect them
      if (session?.user) {
        const redirectPath = await getRedirectPath(session.user)
        router.push(redirectPath)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const redirectPath = await getRedirectPath(session.user)
        router.push(redirectPath)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login')
    setErrorMessage(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to SupabaseAuth
          </h1>
          <p className="text-gray-600 text-lg">
            {authMode === 'login' 
              ? 'Sign in to access your movie collection'
              : 'Create an account to get started'
            }
          </p>
        </div>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{errorMessage}</p>
          </div>
        )}
        
        <AuthForm mode={authMode} onToggleMode={toggleAuthMode} />

        <div className="text-center text-sm text-gray-500">
          <p>By signing in, you agree to our terms of service and privacy policy.</p>
        </div>
      </div>
    </main>
  )
}
