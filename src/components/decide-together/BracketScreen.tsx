'use client'

import { useState, useEffect } from 'react'
import { useTournament } from '@/lib/hooks/useTournament'
import { TournamentMovieCard } from './TournamentMovieCard'
import { MobileTournamentMovieCard } from './MobileTournamentMovieCard'
import { ProgressIndicator } from './ProgressIndicator'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

interface BracketScreenProps {
  roomCode: string
}

export function BracketScreen({ roomCode }: BracketScreenProps) {
  const { currentMatch, userProgress, submitPick, currentRound } = useTournament(roomCode)
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [matchStartTime, setMatchStartTime] = useState<number>(Date.now())
  const { toast } = useToast()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset match start time when new match loads
  useEffect(() => {
    if (currentMatch) {
      setMatchStartTime(Date.now())
    }
  }, [currentMatch?.matchId])

  const handleMovieSelect = async (movieId: number) => {
    if (!currentMatch || isSubmitting || selectedMovie !== null) return
    
    // Immediately set selected state to prevent race conditions
    setSelectedMovie(movieId)
    setIsSubmitting(true)
    
    // Haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(50)
    }
    
    try {
      const responseTimeMs = Date.now() - matchStartTime;
      await submitPick({
        matchId: currentMatch.matchId,
        selectedMovieId: movieId,
        responseTimeMs
      })
      
      // Success feedback
      toast({
        title: "Pick submitted!",
        description: "Waiting for your partner...",
      })
    } catch (error) {
      console.error('Error submitting pick:', error);
      toast({
        title: "Failed to submit pick",
        description: "Please try again",
        variant: "destructive"
      })
      setSelectedMovie(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!currentMatch) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Waiting for next round...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Round {currentRound}</h2>
            <ProgressIndicator 
              current={userProgress?.completedPicks || 0} 
              total={userProgress?.totalPicks || 0}
              label="picks completed"
            />
          </div>
        </div>
        
        <div className="flex-1 flex flex-col justify-center px-4 pb-8">
          <div className="text-center text-xl font-semibold text-gray-600 mb-6">
            Choose Your Pick
          </div>
          
          <div className="space-y-4">
            <MobileTournamentMovieCard
              movie={currentMatch.movieA}
              onSelect={() => handleMovieSelect(currentMatch.movieA.id)}
              isSelected={selectedMovie === currentMatch.movieA.id}
              disabled={isSubmitting}
            />
            
            <div className="flex items-center justify-center py-2">
              <div className="text-lg font-bold text-gray-400">OR</div>
            </div>
            
            <MobileTournamentMovieCard
              movie={currentMatch.movieB}
              onSelect={() => handleMovieSelect(currentMatch.movieB.id)}
              isSelected={selectedMovie === currentMatch.movieB.id}
              disabled={isSubmitting}
            />
          </div>
          
          <p className="text-center text-sm text-gray-600 mt-6">
            Choose the movie you'd rather watch
          </p>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-4">Round {currentRound}</h2>
        <ProgressIndicator 
          current={userProgress?.completedPicks || 0} 
          total={userProgress?.totalPicks || 0}
          label="picks completed"
        />
      </div>
      
      <div className="grid md:grid-cols-[1fr,auto,1fr] gap-8 items-center">
        <TournamentMovieCard
          movie={currentMatch.movieA}
          onSelect={() => handleMovieSelect(currentMatch.movieA.id)}
          isSelected={selectedMovie === currentMatch.movieA.id}
          disabled={isSubmitting}
        />
        
        <div className="flex items-center justify-center">
          <div className="text-4xl font-bold text-gray-300">VS</div>
        </div>
        
        <TournamentMovieCard
          movie={currentMatch.movieB}
          onSelect={() => handleMovieSelect(currentMatch.movieB.id)}
          isSelected={selectedMovie === currentMatch.movieB.id}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="text-center mt-8">
        <p className="text-gray-600">Choose the movie you'd rather watch</p>
      </div>
    </div>
  )
} 