'use client'

import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { useUser } from '@/lib/hooks/useUser'
import { TournamentState } from '@/lib/services/tournament-service'

interface TournamentHookResult {
  // State
  tournamentState: TournamentState | null
  room: any
  isLoading: boolean
  error: string | null
  
  // Actions
  startTournament: () => Promise<void>
  submitPick: (pick: {
    matchId: string
    selectedMovieId: number
    responseTimeMs?: number
  }) => Promise<void>
  refetch: () => void
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
};

export const useNewTournament = (roomCode: string): TournamentHookResult => {
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch tournament state from server
  const { 
    data, 
    error: swrError, 
    isLoading, 
    mutate 
  } = useSWR(
    roomCode && user ? `/api/rooms/${roomCode}/tournament` : null,
    fetcher,
    {
      refreshInterval: 0, // No polling - rely on real-time updates
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      errorRetryCount: 3,
      errorRetryInterval: 1000
    }
  )

  // Listen for real-time tournament updates
  useEffect(() => {
    if (!roomCode || !user) return

    // Import and set up real-time subscription
    import('@/lib/supabase').then(({ supabase }) => {
      const channel = supabase.channel(`room-${roomCode}`)
        .on('broadcast', { event: 'tournament_updated' }, (payload) => {
          console.log('Tournament updated via real-time:', payload.payload?.type)
          
          // Refetch tournament state when any tournament event occurs
          mutate()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [roomCode, user, mutate])

  // Start tournament action
  const startTournament = useCallback(async () => {
    if (!roomCode || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch(`/api/rooms/${roomCode}/tournament`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start tournament')
      }

      // Refetch to get updated state
      await mutate()
    } catch (error: any) {
      console.error('Failed to start tournament:', error)
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }, [roomCode, isSubmitting, mutate])

  // Submit pick action
  const submitPick = useCallback(async (pick: {
    matchId: string
    selectedMovieId: number
    responseTimeMs?: number
  }) => {
    if (!roomCode || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch(`/api/rooms/${roomCode}/tournament`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pick',
          ...pick
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit pick')
      }

      // Refetch to get updated state
      await mutate()
    } catch (error: any) {
      console.error('Failed to submit pick:', error)
      setSubmitError(error.message)
      throw error // Re-throw so UI can handle it
    } finally {
      setIsSubmitting(false)
    }
  }, [roomCode, isSubmitting, mutate])

  const refetch = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    tournamentState: data?.tournamentState || null,
    room: data?.room || null,
    isLoading: isLoading || isSubmitting,
    error: submitError || swrError?.message || null,
    startTournament,
    submitPick,
    refetch
  }
} 