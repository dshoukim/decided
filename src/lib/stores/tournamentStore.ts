import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Types
export interface TournamentMovie {
  id: number;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
  fromUsers: string[]; // which users had this movie
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
      
      // Find the next uncompleted match for the current round
      const currentRoundMatches = state.tournament.matches.filter(
        m => m.roundNumber === state.currentRound
      );
      
      // This would be determined by checking against completed picks
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
          // Update tournament data
          set({
            tournament: {
              id: message.payload.tournamentId,
              totalRounds: message.payload.totalRounds,
              matches: message.payload.matchups,
              currentRound: 1,
              currentMatch: message.payload.matchups[0],
            },
            room: state.room ? { ...state.room, status: 'active' } : null,
          });
          break;
          
        case 'pick_made':
          // Update progress
          if (message.payload.userId === message.userId) {
            set({ userProgress: message.payload.progress });
          } else {
            set({ partnerProgress: message.payload.progress });
          }
          break;
          
        case 'round_completed':
          // Advance to next round
          set({
            currentRound: message.payload.roundNumber + 1,
            userProgress: { ...initialProgress, currentRound: message.payload.roundNumber + 1 },
            partnerProgress: { ...initialProgress, currentRound: message.payload.roundNumber + 1 },
          });
          break;
          
        case 'winner_selected':
          // Update room with winner
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