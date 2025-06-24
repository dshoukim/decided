'use client'

import { useState, useEffect } from 'react'
import { useNewTournament } from '@/lib/hooks/useNewTournament'
import { TournamentMovieCard } from './TournamentMovieCard'
import { MobileTournamentMovieCard } from './MobileTournamentMovieCard'
import { ProgressIndicator } from './ProgressIndicator'
import { WinnerAnnouncement } from './WinnerAnnouncement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Trophy, Swords } from 'lucide-react'

interface NewTournamentInterfaceProps {
  roomCode: string
}

export function NewTournamentInterface({ roomCode }: NewTournamentInterfaceProps) {
  const { tournamentState, isLoading, error, submitPick } = useNewTournament(roomCode)
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

  // Reset selected movie and start time when new match loads
  useEffect(() => {
    if (tournamentState?.userProgress?.currentMatch) {
      setSelectedMovie(null)
      setMatchStartTime(Date.now())
    }
  }, [tournamentState?.userProgress?.currentMatch?.matchId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Tournament Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!tournamentState) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Tournament Loading</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Preparing tournament...</p>
        </CardContent>
      </Card>
    )
  }

  // Tournament completed - show winner
  if (tournamentState.status === 'completed') {
    return <WinnerAnnouncement roomCode={roomCode} />
  }

  // No current match - waiting for partner
  const currentMatch = tournamentState.userProgress?.currentMatch
  if (!currentMatch) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">
              {tournamentState.userProgress?.canAdvance 
                ? "Waiting for next round..."
                : "Waiting for your partner..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

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

  // Determine if this is the final round
  const isFinalRound = tournamentState.status === 'final'

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4">
          <div className="text-center mb-6">
            {isFinalRound ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-3xl font-bold">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Final Face-off!
                  </span>
                  <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <p className="text-sm text-gray-600">Choose the ultimate winner!</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold">Round {tournamentState.currentRound}</h2>
                <ProgressIndicator 
                  current={tournamentState.userProgress?.completedPicks || 0} 
                  total={tournamentState.userProgress?.totalPicks || 0}
                  label="picks completed"
                />
              </>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col justify-center px-4 pb-8">
          <div className="text-center text-xl font-semibold text-gray-600 mb-6">
            {isFinalRound ? "Choose Your Pick" : "Choose Your Pick"}
          </div>
          
          <div className="space-y-4">
            <MobileTournamentMovieCard
              movie={currentMatch.movieA}
              onSelect={() => handleMovieSelect(currentMatch.movieA.id)}
              isSelected={selectedMovie === currentMatch.movieA.id}
              disabled={isSubmitting}
            />
            
            <div className="flex items-center justify-center py-2">
              {isFinalRound ? (
                <Swords className="h-6 w-6 text-gray-400 rotate-45" />
              ) : (
                <div className="text-lg font-bold text-gray-400">OR</div>
              )}
            </div>
            
            <MobileTournamentMovieCard
              movie={currentMatch.movieB}
              onSelect={() => handleMovieSelect(currentMatch.movieB.id)}
              isSelected={selectedMovie === currentMatch.movieB.id}
              disabled={isSubmitting}
            />
          </div>
          
          <p className="text-center text-sm text-gray-600 mt-6">
            {isFinalRound 
              ? "This is it! Choose the movie you both want to watch tonight."
              : "Choose the movie you'd rather watch"}
          </p>
        </div>
      </div>
    )
  }

  // Desktop layout
  if (isFinalRound) {
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
              onSelect={() => handleMovieSelect(currentMatch.movieA.id)}
              isSelected={selectedMovie === currentMatch.movieA.id}
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
              onSelect={() => handleMovieSelect(currentMatch.movieB.id)}
              isSelected={selectedMovie === currentMatch.movieB.id}
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

  // Regular round desktop layout
  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-4">Round {tournamentState.currentRound}</h2>
        <ProgressIndicator 
          current={tournamentState.userProgress?.completedPicks || 0} 
          total={tournamentState.userProgress?.totalPicks || 0}
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