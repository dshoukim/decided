'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useTournamentStore } from '@/lib/stores/tournamentStore';
import { classifyError, retryWithBackoff } from '@/lib/errors/errorClassification';
import { TournamentMatch, TournamentMovie } from '@/lib/stores/tournamentStore';

interface BracketPick {
  matchId: string;
  roundNumber: number;
  movieAId: number;
  movieBId: number;
  selectedMovieId: number;
  responseTimeMs: number;
}

export const useTournament = (roomCode: string | null) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverCurrentMatch, setServerCurrentMatch] = useState<TournamentMatch | null>(null);
  const submittingMatchIdRef = useRef<string | null>(null);
  const lastRoundRef = useRef<number>(1);

  // Use individual stable selectors instead of object creation
  const tournament = useTournamentStore(state => state.tournament);
  const currentRound = useTournamentStore(state => state.currentRound);
  const room = useTournamentStore(state => state.room);
  const error = useTournamentStore(state => state.error);
  const isLoading = useTournamentStore(state => state.isLoading);
  const connectionStatus = useTournamentStore(state => state.connectionStatus);
  const userProgress = useTournamentStore(state => state.userProgress);
  const partnerProgress = useTournamentStore(state => state.partnerProgress);

  // Get actions directly to keep them stable
  const setError = useTournamentStore((state: any) => state.setError);
  const clearError = useTournamentStore((state: any) => state.clearError);

  // Fetch current match from server when tournament or round changes
  useEffect(() => {
    const fetchCurrentMatch = async () => {
      if (!roomCode || !tournament || room?.status !== 'active') {
        console.log('🚫 [CLIENT] Skipping current-match fetch:', {
          roomCode: !!roomCode,
          tournament: !!tournament,
          roomStatus: room?.status
        });
        setServerCurrentMatch(null);
        return;
      }

      console.log('🔄 [CLIENT] Fetching current match:', {
        roomCode,
        tournamentId: tournament.id,
        currentRound,
        userProgress: userProgress.completedPicks,
        apiUrl: `/api/rooms/${roomCode}/current-match`
      });

      try {
        const response = await fetch(`/api/rooms/${roomCode}/current-match`);
        
        console.log('📡 [CLIENT] Current-match API response:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (response.ok) {
          const data = await response.json();
          setServerCurrentMatch(data.currentMatch);
          console.log('✅ [CLIENT] Fetched current match from server:', {
            matchId: data.currentMatch?.matchId,
            completedCount: data.completedCount,
            totalCount: data.totalCount,
            message: data.message,
            debug: data.debug
          });
        } else {
          const errorData = await response.json().catch(() => null);
          console.error('❌ [CLIENT] Failed to fetch current match:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          setServerCurrentMatch(null);
        }
      } catch (error) {
        console.error('❌ [CLIENT] Error fetching current match:', {
          error: error.message,
          stack: error.stack,
          roomCode,
          apiUrl: `/api/rooms/${roomCode}/current-match`
        });
        setServerCurrentMatch(null);
      }
    };

    fetchCurrentMatch();
  }, [roomCode, tournament?.id, currentRound, userProgress.completedPicks]);

  // Use server-fetched current match (this fixes the bug!)
  const currentMatch = useMemo((): TournamentMatch | null => {
    console.log('Using server-fetched current match:', {
      serverMatch: serverCurrentMatch?.matchId || null,
      userProgress: userProgress.completedPicks,
      currentRound
    });
    return serverCurrentMatch;
  }, [serverCurrentMatch, userProgress, currentRound]);

  // Stable computed values - use individual memos to prevent object creation
  const isWaitingForPartner = useMemo(() => {
    if (!tournament || !userProgress || !partnerProgress) return false;
    
    const userCompletedRound = userProgress.completedPicks >= 
      Math.ceil(tournament.matches.filter((m: TournamentMatch) => m.roundNumber === currentRound).length / 2);
    
    const partnerCompletedRound = partnerProgress.completedPicks >= 
      Math.ceil(tournament.matches.filter((m: TournamentMatch) => m.roundNumber === currentRound).length / 2);
    
    return userCompletedRound && !partnerCompletedRound;
  }, [tournament, currentRound, userProgress, partnerProgress]);

  const isTournamentComplete = useMemo(() => room?.status === 'completed', [room?.status]);

  const totalRounds = useMemo(() => tournament?.totalRounds || 0, [tournament?.totalRounds]);

  const finalPicks = useMemo(() => {
    if (!tournament || currentRound !== tournament.totalRounds) return null;
    
    return {
      userPick: null,
      partnerPick: null,
    };
  }, [tournament, currentRound]);

  // Reset state when round changes
  useEffect(() => {
    if (currentRound !== lastRoundRef.current) {
      console.log(`Round changed from ${lastRoundRef.current} to ${currentRound}`);
      lastRoundRef.current = currentRound;
    }
  }, [currentRound]);

  // Submit bracket pick - memoized to prevent re-renders
  const submitPick = useCallback(async (pick: {
    matchId: string;
    selectedMovieId: number;
    responseTimeMs: number;
  }) => {
    if (!roomCode || !currentMatch || isSubmitting) return;
    
    // Prevent duplicate submissions for the same match
    if (submittingMatchIdRef.current === pick.matchId) {
      console.log('Preventing duplicate submission for match:', pick.matchId);
      return;
    }
    
    submittingMatchIdRef.current = pick.matchId;
    setIsSubmitting(true);
    clearError();
    
    const fullPick: BracketPick = {
      matchId: pick.matchId,
      roundNumber: currentMatch.roundNumber,
      movieAId: currentMatch.movieA.id,
      movieBId: currentMatch.movieB.id,
      selectedMovieId: pick.selectedMovieId,
      responseTimeMs: pick.responseTimeMs,
    };
    
    try {
      const response = await fetch(`/api/rooms/${roomCode}/bracket`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPick),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw {
          status: response.status,
          message: error.message || 'Failed to submit pick',
          code: error.code,
        };
      }
      
      const data = await response.json();
      console.log('Pick submitted successfully:', data);
      
      // Real-time events will handle round advancement and match progression
      // The API will broadcast pick_made and round_completed events
      
      return data;
      
    } catch (error: any) {
      const classified = classifyError(error);
      
      if (classified.retryable) {
        // Retry with backoff
        return await retryWithBackoff(async () => {
          const retryResponse = await fetch(`/api/rooms/${roomCode}/bracket`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullPick),
          });
          
          if (!retryResponse.ok) {
            const error = await retryResponse.json();
            throw { status: retryResponse.status, message: error.message };
          }
          
          return retryResponse.json();
        }, classified);
      } else {
        setError(classified.userMessage);
        throw error;
      }
    } finally {
      submittingMatchIdRef.current = null;
      setIsSubmitting(false);
    }
  }, [roomCode, currentMatch, isSubmitting, clearError, setError]);

  // Return stable object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Tournament data
    tournament,
    currentMatch,
    currentRound,
    totalRounds,
    
    // Status
    status: room?.status || 'waiting',
    isLoading,
    error,
    connectionStatus,
    
    // Progress
    userProgress,
    partnerProgress,
    isWaitingForPartner,
    isTournamentComplete,
    
    // Actions
    submitPick,
    isSubmitting,
    
    // Final face-off
    finalPicks,
  }), [
    tournament,
    currentMatch,
    currentRound,
    totalRounds,
    room?.status,
    isLoading,
    error,
    connectionStatus,
    userProgress,
    partnerProgress,
    isWaitingForPartner,
    isTournamentComplete,
    submitPick,
    isSubmitting,
    finalPicks
  ]);
}; 