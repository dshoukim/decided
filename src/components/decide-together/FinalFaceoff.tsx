'use client'

import { useState } from 'react'
import { useTournamentStore } from '@/lib/stores/tournamentStore'
import { TournamentMovieCard } from './TournamentMovieCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Swords } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface FinalFaceoffProps {
  roomCode: string
}

export function FinalFaceoff({ roomCode }: FinalFaceoffProps) {
  const tournament = useTournamentStore(state => state.tournament)
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  
  // Get the current match from tournament data
  const currentMatch = tournament?.currentMatch
  
  if (!currentMatch || !currentMatch.movieA || !currentMatch.movieB) {
    console.error('FinalFaceoff: No current match found');
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-red-600">Error: Invalid final round data</p>
      </div>
    );
  }
  
  const handleSelectWinner = async (movieId: number) => {
    setSelectedWinner(movieId)
    setIsSubmitting(true)
    
    try {
      // Submit pick through action API
      const response = await fetch(`/api/decided/rooms/${roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pick',
          payload: {
            matchId: currentMatch.matchId,
            selectedMovieId: movieId,
            responseTimeMs: Date.now() - performance.now(), // More accurate response time
          },
          idempotencyKey: `pick-${currentMatch.matchId}-${Date.now()}`
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit final pick')
      }
      
      toast({
        title: "Final pick submitted!",
        description: "Waiting for your partner to make their final choice...",
      })
    } catch (error: any) {
      toast({
        title: "Failed to submit final pick",
        description: error.message || "Please try again",
        variant: "destructive"
      })
      setSelectedWinner(null)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-4xl md:text-5xl font-bold">
          <Trophy className="h-8 w-8 md:h-10 md:w-10 text-yellow-500" />
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Final Face-off!
          </span>
          <Trophy className="h-8 w-8 md:h-10 md:w-10 text-yellow-500" />
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          These are your top picks. Choose the ultimate winner!
        </p>
      </div>
      
      <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 md:gap-8 items-center">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Finalist #1</h3>
          <TournamentMovieCard
            movie={currentMatch.movieA}
            onSelect={() => handleSelectWinner(currentMatch.movieA.id)}
            isSelected={selectedWinner === currentMatch.movieA.id}
            disabled={isSubmitting}
          />
        </div>
        
        <div className="flex items-center justify-center py-4 md:py-0">
          <Swords className="h-12 w-12 text-gray-400 rotate-45" />
        </div>
        
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Finalist #2</h3>
          <TournamentMovieCard
            movie={currentMatch.movieB}
            onSelect={() => handleSelectWinner(currentMatch.movieB.id)}
            isSelected={selectedWinner === currentMatch.movieB.id}
            disabled={isSubmitting}
          />
        </div>
      </div>
      
      <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
        <CardContent className="p-6 text-center">
          <p className="text-purple-800 dark:text-purple-200">
            This is it! Choose the movie you both want to watch tonight. 
            The winner will be added to both of your watch lists.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 