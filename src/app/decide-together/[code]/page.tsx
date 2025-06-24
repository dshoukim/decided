'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useUser } from '@/lib/hooks/useUser'
import { useRoom } from '@/lib/hooks/useRoom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectionStatus } from '@/components/decide-together/ConnectionStatus'
import { ParticipantAvatar } from '@/components/decide-together/ParticipantAvatar'
import { Loader2, ArrowLeft, Users, Play } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const { toast } = useToast()
  const roomCode = params.code as string
  
  const {
    room,
    participants,
    connectionStatus,
    error,
    isLoading,
    isOwner,
    canStart,
    activeParticipants,
    joinRoom,
    leaveRoom,
    startTournament,
    clearError,
  } = useRoom(roomCode)

  const [hasJoined, setHasJoined] = useState(false)

  // Auto-join room when user is authenticated
  useEffect(() => {
    if (user && !hasJoined && !isLoading) {
      setHasJoined(true)
      joinRoom()
    }
  }, [user, hasJoined, isLoading, joinRoom])

  // Handle errors
  useEffect(() => {
    if (error) {
      // Show error toast for non-critical errors
      if (!error.includes('not exist') && !error.includes('Sign in')) {
        toast({
          title: 'Connection Issue',
          description: error,
          variant: 'destructive',
        })
      }
    }
  }, [error, toast])

  const handleLeaveRoom = async () => {
    await leaveRoom()
    router.push('/decide-together')
  }

  const handleStartTournament = async () => {
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

      // The room status will update via real-time events
      toast({
        title: "Tournament starting!",
        description: "Preparing your personalized tournament...",
      })
    } catch (error: any) {
      toast({
        title: "Failed to start tournament",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  // Loading state
  if (userLoading || (isLoading && !room)) {
    return (
      <div className="container mx-auto max-w-4xl py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You need to be signed in to join a room.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push(`/auth/signin?redirect=/decide-together/${roomCode}`)}
              className="w-full"
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Room not found or error
  if (error && (error.includes('not exist') || error.includes('ended'))) {
    return (
      <div className="container mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Room Not Found</CardTitle>
            <CardDescription>
              This room doesn't exist or has already ended.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/decide-together')}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Decided
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Tournament is active - use new simplified interface
  if (room?.status === 'active') {
    const NewTournamentInterface = dynamic(
      () => import('@/components/decide-together/NewTournamentInterface').then(mod => ({ default: mod.NewTournamentInterface })),
      { 
        loading: () => (
          <div className="container mx-auto max-w-4xl py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )
      }
    )
    
    return (
      <div className="container mx-auto py-8">
        <NewTournamentInterface roomCode={roomCode} />
      </div>
    )
  }

  // Tournament completed
  if (room?.status === 'completed') {
    const WinnerAnnouncement = dynamic(
      () => import('@/components/decide-together/WinnerAnnouncement').then(mod => ({ default: mod.WinnerAnnouncement })),
      { 
        loading: () => (
          <div className="container mx-auto max-w-4xl py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )
      }
    )
    
    return (
      <div className="container mx-auto py-8">
        <WinnerAnnouncement roomCode={roomCode} />
      </div>
    )
  }

  // Room Lobby (waiting state)
  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleLeaveRoom}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Leave Room
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Room {roomCode}</CardTitle>
                <CardDescription>
                  Waiting for players to join...
                </CardDescription>
              </div>
              <ConnectionStatus status={connectionStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Participants */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({activeParticipants?.length || 0}/2)
              </h3>
              
              <div className="grid gap-4">
                {participants?.map((participant) => (
                  <Card key={participant.userId} className="p-4">
                    <ParticipantAvatar
                      participant={{
                        ...participant,
                        isOwner: participant.userId === room?.ownerId,
                      }}
                      showName={true}
                    />
                  </Card>
                )) || []}
                
                {/* Empty slot */}
                {(activeParticipants?.length || 0) < 2 && (
                  <Card className="p-4 border-dashed bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Waiting for player...</p>
                        <p className="text-sm text-gray-400">Share the room code</p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Room Info */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Share this room code with your friend:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-2xl font-mono font-bold text-blue-900 dark:text-blue-100">
                  {roomCode}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(roomCode)
                    toast({ title: 'Code copied!' })
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Start Button */}
            {isOwner && (
              <div className="pt-4">
                {canStart ? (
                  <Button
                    onClick={handleStartTournament}
                    disabled={isLoading}
                    size="lg"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Tournament 🎬
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    disabled
                    size="lg"
                    className="w-full"
                  >
                    Waiting for 2 players...
                  </Button>
                )}
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Only the room owner can start the tournament
                </p>
              </div>
            )}

            {!isOwner && (activeParticipants?.length || 0) === 2 && (
              <div className="text-center py-4">
                <p className="text-gray-600">
                  Waiting for the host to start the tournament...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 