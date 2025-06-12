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
  
  // In a real implementation, these would come from the tournament data
  // For now, using placeholder data
  const finalMovieA = tournament?.matches[0]?.movieA || {
    id: 1,
    title: "Your Top Pick",
    poster_path: "",
    fromUsers: ["user1"],
    release_date: undefined,
    vote_average: undefined
  }
  
  const finalMovieB = tournament?.matches[0]?.movieB || {
    id: 2,
    title: "Partner's Top Pick",
    poster_path: "",
    fromUsers: ["user2"],
    release_date: undefined,
    vote_average: undefined
  }
  
  const handleSelectWinner = async (movieId: number) => {
    setSelectedWinner(movieId)
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/rooms/${roomCode}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalPickUserA: finalMovieA.id,
          finalPickUserB: finalMovieB.id,
          selectedWinner: movieId,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to submit winner')
      }
      
      toast({
        title: "Winner selected!",
        description: "The movie has been added to both watch lists.",
      })
    } catch (error) {
      toast({
        title: "Failed to select winner",
        description: "Please try again",
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
          <h3 className="text-xl font-semibold">Your Top Pick</h3>
          <TournamentMovieCard
            movie={finalMovieA}
            onSelect={() => handleSelectWinner(finalMovieA.id)}
            isSelected={selectedWinner === finalMovieA.id}
            disabled={isSubmitting}
          />
        </div>
        
        <div className="flex items-center justify-center py-4 md:py-0">
          <Swords className="h-12 w-12 text-gray-400 rotate-45" />
        </div>
        
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Partner's Top Pick</h3>
          <TournamentMovieCard
            movie={finalMovieB}
            onSelect={() => handleSelectWinner(finalMovieB.id)}
            isSelected={selectedWinner === finalMovieB.id}
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