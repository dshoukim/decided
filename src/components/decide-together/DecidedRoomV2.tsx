'use client';

import { useDecidedRoom } from '@/lib/hooks/useDecidedRoom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Film, Users, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useState } from 'react';

interface DecidedRoomV2Props {
  roomCode: string;
}

export function DecidedRoomV2({ roomCode }: DecidedRoomV2Props) {
  const { state, error, loading, isConnected, sendAction } = useDecidedRoom({ roomCode });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  const handleAction = async (action: string, payload?: any) => {
    setIsSubmitting(true);
    try {
      await sendAction(action, payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className="fixed top-4 right-4 z-50">
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
        isConnected 
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
      )}>
        {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        {isConnected ? 'Connected' : 'Polling'}
      </div>
    </div>
  );

  // Render different screens based on state
  switch (state.screen) {
    case 'lobby':
      return (
        <div className="min-h-screen p-4">
          <ConnectionStatus />
          <div className="max-w-2xl mx-auto mt-16">
            <Card className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Waiting Room</h1>
                <p className="text-muted-foreground">Room Code: <span className="font-mono font-bold">{state.data.room.code}</span></p>
              </div>

              <div className="space-y-4 mb-8">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Participants ({state.data.room.participants.filter(p => p.isActive).length}/2)
                </h2>
                
                {state.data.room.participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      participant.isActive ? "opacity-100" : "opacity-50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {participant.avatarUrl ? (
                        <Image
                          src={participant.avatarUrl}
                          alt={participant.name}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <span className="text-lg font-semibold">
                          {participant.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{participant.name}</p>
                      {participant.isOwner && (
                        <p className="text-sm text-muted-foreground">Host</p>
                      )}
                    </div>
                    {!participant.isActive && (
                      <span className="text-sm text-muted-foreground">Left</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                {state.availableActions.includes('start') && (
                  <Button
                    onClick={() => handleAction('start')}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Start Tournament
                  </Button>
                )}
                
                {state.availableActions.includes('leave') && (
                  <Button
                    variant="outline"
                    onClick={() => handleAction('leave')}
                    disabled={isSubmitting}
                  >
                    Leave Room
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      );

    case 'bracket':
      if (!state.data.tournament?.currentMatch) {
        return null;
      }

      return (
        <div className="min-h-screen p-4">
          <ConnectionStatus />
          
          <div className="max-w-6xl mx-auto">
            {/* Progress indicator */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold mb-2">
                Round {state.data.tournament.progress.currentRound} of {state.data.tournament.progress.totalRounds}
              </h2>
              <p className="text-muted-foreground">
                Pick {state.data.tournament.progress.userPicks + 1} of {state.data.tournament.progress.totalPicks}
              </p>
            </div>

            {/* Match cards */}
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <MovieCard
                movie={state.data.tournament.currentMatch.movieA}
                onClick={() => handleAction('pick', {
                  matchId: state.data.tournament!.currentMatch!.matchId,
                  selectedMovieId: state.data.tournament!.currentMatch!.movieA.id,
                  responseTimeMs: 1000, // You could track actual response time
                })}
                disabled={isSubmitting}
              />
              
              <MovieCard
                movie={state.data.tournament.currentMatch.movieB}
                onClick={() => handleAction('pick', {
                  matchId: state.data.tournament!.currentMatch!.matchId,
                  selectedMovieId: state.data.tournament!.currentMatch!.movieB.id,
                  responseTimeMs: 1000,
                })}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
      );

    case 'waiting':
      return (
        <div className="min-h-screen p-4 flex items-center justify-center">
          <ConnectionStatus />
          
          <Card className="max-w-md w-full p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Waiting for Partner</h2>
            <p className="text-muted-foreground">
              Your partner is still making their picks...
            </p>
            
            {state.data.tournament?.partnerProgress && (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground">
                  Partner progress: {state.data.tournament.partnerProgress.picks} / {state.data.tournament.partnerProgress.total}
                </p>
              </div>
            )}
          </Card>
        </div>
      );

    case 'final':
      if (!state.data.tournament?.currentMatch) {
        return null;
      }

      return (
        <div className="min-h-screen p-4">
          <ConnectionStatus />
          
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold mb-2 text-primary">Final Face-off!</h1>
              <p className="text-lg text-muted-foreground">Choose your winner</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <MovieCard
                movie={state.data.tournament.currentMatch.movieA}
                onClick={() => handleAction('pick', {
                  matchId: state.data.tournament!.currentMatch!.matchId,
                  selectedMovieId: state.data.tournament!.currentMatch!.movieA.id,
                  responseTimeMs: 1000,
                })}
                disabled={isSubmitting}
                isFinal
              />
              
              <MovieCard
                movie={state.data.tournament.currentMatch.movieB}
                onClick={() => handleAction('pick', {
                  matchId: state.data.tournament!.currentMatch!.matchId,
                  selectedMovieId: state.data.tournament!.currentMatch!.movieB.id,
                  responseTimeMs: 1000,
                })}
                disabled={isSubmitting}
                isFinal
              />
            </div>
          </div>
        </div>
      );

    case 'winner':
      if (!state.data.winner) {
        return null;
      }

      return (
        <div className="min-h-screen p-4 flex items-center justify-center">
          <ConnectionStatus />
          
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-8">🎉 Winner! 🎉</h1>
            
            <Card className="max-w-sm mx-auto overflow-hidden">
              {state.data.winner.movie.posterPath ? (
                <div className="aspect-[2/3] relative">
                  <Image
                    src={`https://image.tmdb.org/t/p/w500${state.data.winner.movie.posterPath}`}
                    alt={state.data.winner.movie.title}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[2/3] bg-muted flex items-center justify-center">
                  <Film className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
              
              <div className="p-6">
                <h2 className="text-2xl font-bold">{state.data.winner.movie.title}</h2>
                {state.data.winner.addedToWatchlists && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Added to both watchlists
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// Movie card component
interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    posterPath?: string;
  };
  onClick: () => void;
  disabled?: boolean;
  isFinal?: boolean;
}

function MovieCard({ movie, onClick, disabled, isFinal }: MovieCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative overflow-hidden rounded-lg transition-all",
        "hover:scale-105 focus:outline-none focus:ring-4",
        isFinal && "ring-2 ring-primary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Card className="overflow-hidden">
        <div className="aspect-[2/3] relative">
          {movie.posterPath ? (
            <Image
              src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
              alt={movie.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Film className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-lg font-bold">Select</span>
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-semibold text-lg line-clamp-2">{movie.title}</h3>
        </div>
      </Card>
    </button>
  );
} 