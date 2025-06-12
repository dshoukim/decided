'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTournamentStore, selectCurrentMatch, selectTournamentProgress } from '@/lib/stores/tournamentStore';
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
  const store = useTournamentStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Get current match from store
  const tournament = useTournamentStore(state => state.tournament);
  const currentRound = useTournamentStore(state => state.currentRound);
  const progress = useTournamentStore(selectTournamentProgress);
  
  // Find current match for user
  const getCurrentMatch = useCallback((): TournamentMatch | null => {
    if (!tournament) return null;
    
    const currentRoundMatches = tournament.matches.filter(
      m => m.roundNumber === currentRound
    );
    
    // Find first unplayed match (this would be determined by checking picks)
    // For now, use index-based approach
    if (currentMatchIndex < currentRoundMatches.length) {
      return currentRoundMatches[currentMatchIndex];
    }
    
    return null;
  }, [tournament, currentRound, currentMatchIndex]);

  const currentMatch = getCurrentMatch();

  // Submit bracket pick - updated to accept pick object
  const submitPick = useCallback(async (pick: {
    matchId: string;
    selectedMovieId: number;
    responseTimeMs: number;
  }) => {
    if (!roomCode || !currentMatch || isSubmitting) return;
    
    setIsSubmitting(true);
    store.clearError();
    
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
      
      // Move to next match
      setCurrentMatchIndex(prev => prev + 1);
      
      // Check if round is complete
      if (data.nextRoundMatches) {
        // New round started
        setCurrentMatchIndex(0);
        store.updateCurrentRound(currentRound + 1);
      }
      
      return data;
      
    } catch (error: any) {
      const classified = classifyError(error);
      
      if (classified.retryable) {
        // Retry with backoff
        return await retryWithBackoff(async () => {
          const retryResponse = await fetch(`/api/rooms/${roomCode}/bracket`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pick),
          });
          
          if (!retryResponse.ok) {
            const error = await retryResponse.json();
            throw { status: retryResponse.status, message: error.message };
          }
          
          return retryResponse.json();
        }, classified);
      } else {
        store.setError(classified.userMessage);
        throw error;
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [roomCode, currentMatch, isSubmitting, currentRound]);

  // Check if waiting for partner
  const isWaitingForPartner = useCallback(() => {
    if (!tournament || !progress) return false;
    
    // If user has completed all picks for current round
    const userCompletedRound = progress.userProgress.completedPicks >= 
      Math.ceil(tournament.matches.filter(m => m.roundNumber === currentRound).length / 2);
    
    // But partner hasn't
    const partnerCompletedRound = progress.partnerProgress.completedPicks >= 
      Math.ceil(tournament.matches.filter(m => m.roundNumber === currentRound).length / 2);
    
    return userCompletedRound && !partnerCompletedRound;
  }, [tournament, progress, currentRound]);

  // Check if tournament is complete
  const isTournamentComplete = useCallback(() => {
    return store.room?.status === 'completed';
  }, [store.room?.status]);

  // Get final picks for face-off
  const getFinalPicks = useCallback(() => {
    if (!tournament || currentRound !== tournament.totalRounds) return null;
    
    // This would be determined by the final round picks
    // For now, return placeholder
    return {
      userPick: null,
      partnerPick: null,
    };
  }, [tournament, currentRound]);

  return {
    // Tournament data
    tournament,
    currentMatch,
    currentRound,
    totalRounds: tournament?.totalRounds || 0,
    
    // Progress
    userProgress: progress.userProgress,
    partnerProgress: progress.partnerProgress,
    isWaitingForPartner: isWaitingForPartner(),
    isTournamentComplete: isTournamentComplete(),
    
    // Actions
    submitPick,
    isSubmitting,
    
    // Final face-off
    finalPicks: getFinalPicks(),
    
    // Error state
    error: store.error,
  };
}; 