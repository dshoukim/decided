'use client'

import { useEffect, useState } from 'react'
import { useTournament } from '@/lib/hooks/useTournament'
import { BracketScreen } from './BracketScreen'
import { WinnerAnnouncement } from './WinnerAnnouncement'
import { WaitingForPartner } from './WaitingForPartner'
import { FinalFaceoff } from './FinalFaceoff'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface TournamentInterfaceProps {
  roomCode: string
}

export function TournamentInterface({ roomCode }: TournamentInterfaceProps) {
  const { tournament, status, error, isLoading, totalRounds, currentRound } = useTournament(roomCode)
  const [tournamentState, setTournamentState] = useState<'bracket' | 'final' | 'winner' | 'waiting'>('bracket')

  useEffect(() => {
    // Determine state based on tournament status and final round flag
    const newState = status === 'completed' ? 'winner' :
                     tournament?.isFinalRound ? 'final' :
                     tournament && currentRound === totalRounds ? 'final' :
                     !tournament ? 'waiting' : 'bracket';
    
    if (newState !== tournamentState) {
      console.log('TournamentInterface state change:', { 
        from: tournamentState,
        to: newState,
        status, 
        currentRound, 
        totalRounds,
        isFinalRound: tournament?.isFinalRound,
        finalMoviesCount: tournament?.finalMovies?.length,
        hasError: !!error 
      });
      setTournamentState(newState);
    }
  }, [status, tournament, currentRound, totalRounds, error, tournamentState])

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

  switch (tournamentState) {
    case 'waiting':
      return <WaitingForPartner />
      
    case 'bracket':
      return <BracketScreen roomCode={roomCode} />
      
    case 'final':
      return <FinalFaceoff roomCode={roomCode} />
      
    case 'winner':
      return <WinnerAnnouncement roomCode={roomCode} />
      
    default:
      return <BracketScreen roomCode={roomCode} />
  }
} 