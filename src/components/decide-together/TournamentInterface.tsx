'use client'

import { useEffect, useState } from 'react'
import { useTournament } from '@/lib/hooks/useTournament'
import { useTournamentStore } from '@/lib/stores/tournamentStore'
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
  const { tournament, status, error, isLoading } = useTournament(roomCode)
  const room = useTournamentStore(state => state.room)
  const [tournamentState, setTournamentState] = useState<'bracket' | 'final' | 'winner' | 'waiting'>('bracket')

  useEffect(() => {
    if (room?.status === 'completed') {
      setTournamentState('winner')
    } else if (tournament?.currentRound === tournament?.totalRounds) {
      setTournamentState('final')
    } else if (!tournament) {
      setTournamentState('waiting')
    } else {
      setTournamentState('bracket')
    }
  }, [room?.status, tournament])

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