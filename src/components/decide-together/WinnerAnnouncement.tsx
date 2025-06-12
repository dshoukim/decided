'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTournamentStore } from '@/lib/stores/tournamentStore'
import { TournamentMovieCard } from './TournamentMovieCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Plus, RotateCcw } from 'lucide-react'
import confetti from 'canvas-confetti'

interface WinnerAnnouncementProps {
  roomCode: string
}

export function WinnerAnnouncement({ roomCode }: WinnerAnnouncementProps) {
  const router = useRouter()
  const room = useTournamentStore(state => state.room)
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    // Celebrate! 🎉
    if (showConfetti) {
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          setShowConfetti(false)
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      }, 250)

      return () => clearInterval(interval)
    }
  }, [showConfetti])

  const handleWatchNow = () => {
    router.push(`/dashboard`)
  }

  const handleStartNewSession = () => {
    router.push('/decide-together')
  }

  if (!room?.winnerMovieId) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <Card>
          <CardContent className="p-8">
            <p className="text-gray-600">No winner found</p>
            <Button onClick={handleStartNewSession} className="mt-4">
              Start New Tournament
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const winnerMovie = {
    id: room.winnerMovieId,
    title: room.winnerTitle || 'Unknown Movie',
    poster_path: room.winnerPosterPath,
    fromUsers: [],
    release_date: undefined,
    vote_average: undefined
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 text-center space-y-8">
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-center gap-2 text-5xl md:text-6xl font-bold">
          <Sparkles className="h-10 w-10 md:h-12 md:w-12 text-yellow-500 animate-pulse" />
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            We Have a Winner!
          </span>
          <Sparkles className="h-10 w-10 md:h-12 md:w-12 text-yellow-500 animate-pulse" />
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          You've decided what to watch together!
        </p>
      </div>
      
      <div className="max-w-sm mx-auto animate-in zoom-in-95 duration-700 delay-300">
        <TournamentMovieCard 
          movie={winnerMovie} 
          onSelect={() => {}} 
          disabled 
        />
      </div>
      
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 animate-in fade-in-0 duration-700 delay-500">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center justify-center gap-2">
            <Plus className="h-5 w-5" />
            Added to Both Watch Lists!
          </h3>
          <p className="text-green-700 dark:text-green-300">
            "{room.winnerTitle}" has been automatically added to both of your watch lists. 
            Remember to rate it after you watch!
          </p>
        </CardContent>
      </Card>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in-0 duration-700 delay-700">
        <Button 
          onClick={handleWatchNow} 
          size="lg" 
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          View in Watch List
        </Button>
        <Button 
          onClick={handleStartNewSession} 
          variant="outline" 
          size="lg"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Decide Again
        </Button>
      </div>
    </div>
  )
} 