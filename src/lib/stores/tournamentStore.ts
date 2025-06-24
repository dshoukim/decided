import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Types
export interface TournamentMovie {
  id: number;
  title: string;
  posterPath?: string;
  release_date?: string;
  vote_average?: number;
  fromUsers: string[]; // which users had this movie
  movieData?: any;     // Added: to match tournament engine interface
}

export interface TournamentMatch {
  matchId: string;
  roundNumber: number;
  movieA: TournamentMovie;
  movieB: TournamentMovie;
}

export interface Tournament {
  id: string;
  totalRounds: number;
  matches: TournamentMatch[];
  currentRound: number;
  currentMatch?: TournamentMatch;
  isFinalRound?: boolean;
  finalMovies?: TournamentMovie[];
}

export interface Participant {
  userId: string;
  userName?: string;
  avatarUrl?: string;
  joinedAt: string;
  isActive: boolean;
  isOwner?: boolean;
}

export interface Room {
  id: string;
  code: string;
  ownerId: string;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  winnerMovieId?: number;
  winnerTitle?: string;
  winnerPosterPath?: string;
}

export interface UserProgress {
  completedPicks: number;
  totalPicks: number;
  currentRound: number;
  canAdvance: boolean;
}

export interface RealtimeMessage {
  type: string;
  payload: any;
  timestamp: string;
  userId: string;
}

interface TournamentStore {
  // State
  room: Room | null;
  tournament: Tournament | null;
  participants: Participant[];
  currentRound: number;
  userProgress: UserProgress;
  partnerProgress: UserProgress;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  isLoading: boolean;
  
  // Derived state
  isOwner: (userId: string) => boolean;
  canStartTournament: () => boolean;
  getCurrentMatch: () => TournamentMatch | null;
  
  // Actions
  setRoom: (room: Room) => void;
  setTournament: (tournament: Tournament) => void;
  setParticipants: (participants: Participant[]) => void;
  updateProgress: (userId: string, progress: UserProgress) => void;
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  
  // Tournament actions
  advanceToNextMatch: () => void;
  updateCurrentRound: (round: number) => void;
  
  // Reset
  reset: () => void;
  
  // Real-time updates
  updateFromRealtime: (message: RealtimeMessage) => void;
}

const initialProgress: UserProgress = {
  completedPicks: 0,
  totalPicks: 0,
  currentRound: 1,
  canAdvance: false,
};

export const useTournamentStore = create<TournamentStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    room: null,
    tournament: null,
    participants: [],
    currentRound: 1,
    userProgress: initialProgress,
    partnerProgress: initialProgress,
    connectionStatus: 'connecting',
    error: null,
    isLoading: false,
    
    // Derived state helpers
    isOwner: (userId: string) => {
      const state = get();
      return state.room?.ownerId === userId;
    },
    
    canStartTournament: () => {
      const state = get();
      return (
        state.room?.status === 'waiting' &&
        state.participants.filter(p => p.isActive).length === 2
      );
    },
    
    getCurrentMatch: () => {
      const state = get();
      if (!state.tournament) return null;
      
      // FIXED: This function is now deprecated in favor of server-side tracking
      // The useTournament hook now fetches the current match from the server
      // which properly tracks which specific matches each user has completed
      
      console.log('⚠️ getCurrentMatch called - this should be replaced with server-side fetching');
      
      // Find the next uncompleted match for the current round
      const currentRoundMatches = state.tournament.matches.filter(
        m => m.roundNumber === state.currentRound
      );
      
      // Return first match as fallback (will be overridden by server fetch)
      return currentRoundMatches[0] || null;
    },
    
    // Basic setters
    setRoom: (room) => set({ room }),
    setTournament: (tournament) => set({ tournament, currentRound: tournament.currentRound }),
    setParticipants: (participants) => set({ participants }),
    
    updateProgress: (userId, progress) => {
      const state = get();
      const currentUserId = state.participants.find(p => p.isActive && p.userId !== userId)?.userId;
      
      if (userId === currentUserId) {
        set({ userProgress: progress });
      } else {
        set({ partnerProgress: progress });
      }
    },
    
    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
    setError: (error) => set({ error }),
    setLoading: (isLoading) => set({ isLoading }),
    clearError: () => set({ error: null }),
    
    // Tournament navigation
    advanceToNextMatch: () => {
      const state = get();
      if (!state.tournament) return;
      
      // Find next match logic here
      // This would update the current match in the tournament
    },
    
    updateCurrentRound: (round) => {
      set({ currentRound: round });
    },
    
    // Reset store
    reset: () => set({
      room: null,
      tournament: null,
      participants: [],
      currentRound: 1,
      userProgress: initialProgress,
      partnerProgress: initialProgress,
      connectionStatus: 'connecting',
      error: null,
      isLoading: false,
    }),
    
    // Handle real-time updates
    updateFromRealtime: (message) => {
      const state = get();
      
      // Get current user ID from message context
      const currentUserId = message.userId;
      
      switch (message.type) {
        case 'user_joined':
          // Add or update participant
          const existingIndex = state.participants.findIndex(
            p => p.userId === message.payload.userId
          );
          
          if (existingIndex >= 0) {
            const updated = [...state.participants];
            updated[existingIndex] = {
              ...updated[existingIndex],
              ...message.payload,
              isActive: true,
            };
            set({ participants: updated });
          } else {
            set({ 
              participants: [...state.participants, {
                userId: message.payload.userId,
                userName: message.payload.userName,
                avatarUrl: message.payload.avatarUrl,
                joinedAt: message.timestamp,
                isActive: true,
              }]
            });
          }
          break;
          
        case 'user_left':
          // Mark participant as inactive
          const leftIndex = state.participants.findIndex(
            p => p.userId === message.payload.userId
          );
          
          if (leftIndex >= 0) {
            const updated = [...state.participants];
            updated[leftIndex] = {
              ...updated[leftIndex],
              isActive: false,
            };
            set({ participants: updated });
          }
          break;
          
        case 'tournament_started':
          // Always update tournament data to ensure consistency between host and guest
          console.log('Processing tournament_started message:', message.payload);
          console.log('Current tournament state:', state.tournament?.id);
          
          // Transform matchups to proper TournamentMatch structure
          const matches = message.payload.matchups.map((matchup: any) => ({
            matchId: matchup.matchId,
            roundNumber: matchup.roundNumber,
            movieA: {
              id: matchup.movieA.id,
              title: matchup.movieA.title,
              posterPath: matchup.movieA.poster_path || matchup.movieA.posterPath,
              fromUsers: [], // Will be populated if needed
            },
            movieB: {
              id: matchup.movieB.id,
              title: matchup.movieB.title,
              posterPath: matchup.movieB.poster_path || matchup.movieB.posterPath,
              fromUsers: [], // Will be populated if needed
            },
          }));
          
          console.log('Transformed matches with poster paths:', 
            matches[0] && {
              movieA: { id: matches[0].movieA.id, title: matches[0].movieA.title, posterPath: matches[0].movieA.posterPath },
              movieB: { id: matches[0].movieB.id, title: matches[0].movieB.title, posterPath: matches[0].movieB.posterPath }
            }
          );
          
          set({
            tournament: {
              id: message.payload.tournamentId,
              totalRounds: message.payload.totalRounds,
              matches,
              currentRound: 1,
              currentMatch: matches?.[0],
            },
            room: state.room?.status !== 'active' && state.room ? 
              { ...state.room, status: 'active' as const } : state.room,
          });
          break;
          
        case 'pick_made':
          // Update progress based on who made the pick
          const pickUserId = message.payload.userId;
          console.log('✅ Pick made by user:', pickUserId, 'for match:', message.payload.matchId);
          console.log('Current user ID:', currentUserId, 'Pick user ID:', pickUserId);
          
          if (pickUserId === currentUserId) {
            // This user made the pick - update their progress
            console.log('Updating current user progress');
            set({ userProgress: {
              completedPicks: message.payload.progress.userPicks,
              totalPicks: message.payload.progress.totalPicks,
              currentRound: message.payload.roundNumber,
              canAdvance: message.payload.progress.userPicks >= message.payload.progress.totalPicks
            }});
          } else {
            // Partner made the pick - update partner progress
            console.log('Updating partner progress');
            set({ partnerProgress: {
              completedPicks: message.payload.progress.userPicks,
              totalPicks: message.payload.progress.totalPicks,
              currentRound: message.payload.roundNumber,
              canAdvance: message.payload.progress.userPicks >= message.payload.progress.totalPicks
            }});
          }
          break;
          
        case 'round_completed':
          // Advance to next round and update tournament matches
          console.log('Processing round_completed event:', message.payload);
          const nextRound = message.payload.roundNumber + 1;
          
          set((state) => ({
            ...state,
            currentRound: nextRound,
            tournament: state.tournament ? {
              ...state.tournament,
              currentRound: nextRound,
              matches: message.payload.nextRoundMatchups ? 
                [...state.tournament.matches, ...message.payload.nextRoundMatchups] :
                state.tournament.matches
            } : null,
            userProgress: { 
              completedPicks: 0,
              totalPicks: message.payload.nextRoundMatchups?.length || 0,
              currentRound: nextRound,
              canAdvance: false
            },
            partnerProgress: { 
              completedPicks: 0,
              totalPicks: message.payload.nextRoundMatchups?.length || 0,
              currentRound: nextRound,
              canAdvance: false
            },
          }));
          break;
          
        case 'final_round_started':
          // Transition to final round
          console.log('Processing final_round_started event:', message.payload);
          const finalRound = message.payload.roundNumber;
          
          set((state) => ({
            ...state,
            currentRound: finalRound,
            tournament: state.tournament ? {
              ...state.tournament,
              currentRound: finalRound,
              matches: message.payload.nextRoundMatchups ? 
                [...state.tournament.matches, ...message.payload.nextRoundMatchups] :
                state.tournament.matches,
              isFinalRound: true,
              finalMovies: message.payload.finalMovies || []
            } : null,
            userProgress: { 
              completedPicks: 0,
              totalPicks: message.payload.nextRoundMatchups?.length || 1,
              currentRound: finalRound,
              canAdvance: false
            },
            partnerProgress: { 
              completedPicks: 0,
              totalPicks: message.payload.nextRoundMatchups?.length || 1,
              currentRound: finalRound,
              canAdvance: false
            },
          }));
          break;

        case 'tournament_completed':
          // Tournament is complete with winner
          console.log('Processing tournament_completed event:', message.payload);
          set((state) => ({
            ...state,
            room: state.room ? {
              ...state.room,
              status: 'completed',
              winnerMovieId: message.payload.winner?.id,
              winnerTitle: message.payload.winner?.title,
              winnerPosterPath: message.payload.winner?.posterPath,
            } : null,
          }));
          break;

        case 'winner_selected':
          // Update room with winner (legacy support)
          set({
            room: state.room ? {
              ...state.room,
              status: 'completed',
              winnerMovieId: message.payload.winnerMovieId,
              winnerTitle: message.payload.winnerTitle,
              winnerPosterPath: message.payload.winnerPosterPath,
            } : null,
          });
          break;
          
        default:
          console.warn('Unknown realtime message type:', message.type);
      }
    },
  }))
);

// Selectors for common queries
export const selectIsRoomOwner = (userId: string) => (state: TournamentStore) => 
  state.room?.ownerId === userId;

export const selectActiveParticipants = (state: TournamentStore) => 
  state.participants.filter(p => p.isActive);

export const selectCanStartTournament = (state: TournamentStore) =>
  state.room?.status === 'waiting' && 
  state.participants.filter(p => p.isActive).length === 2;

export const selectCurrentMatch = (state: TournamentStore) => {
  if (!state.tournament) return null;
  return state.tournament.matches.find(
    m => m.roundNumber === state.currentRound
  );
};

export const selectTournamentProgress = (state: TournamentStore) => ({
  currentRound: state.currentRound,
  totalRounds: state.tournament?.totalRounds || 0,
  userProgress: state.userProgress,
  partnerProgress: state.partnerProgress,
}); 