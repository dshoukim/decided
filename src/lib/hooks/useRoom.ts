'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useTournamentStore } from '@/lib/stores/tournamentStore';
import { RoomRealtimeManager } from '@/lib/realtime/roomRealtime';
import { classifyError, retryWithBackoff } from '@/lib/errors/errorClassification';
import { useUser } from '@/lib/hooks/useUser';
import { useToast } from '@/components/ui/use-toast';

// Global map to track active connections per room
const activeConnections = new Map<string, RoomRealtimeManager>();

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
};

export const useRoom = (roomCode: string | null) => {
  const { user } = useUser();
  const { toast } = useToast();
  const store = useTournamentStore();
  const [retryCount, setRetryCount] = useState(0);
  const [realtimeManager, setRealtimeManager] = useState<RoomRealtimeManager | null>(null);
  const realtimeRef = useRef<RoomRealtimeManager | null>(null);
  const mountedRef = useRef(true);

  // Get userId from user or localStorage
  const userId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);

  // Fetch room data with SWR
  const { data, error, mutate, isLoading } = useSWR(
    roomCode && userId ? `/api/rooms/${roomCode}?userId=${userId}` : null,
    fetcher,
    { 
      refreshInterval: store.connectionStatus === 'error' ? 5000 : 0, // Fallback polling on error
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (data.room) {
          store.setRoom(data.room);
          store.setParticipants(data.participants || []);
          setRetryCount(0); // Reset retry count on success
        }
      },
      onError: (err) => {
        const classified = classifyError(err);
        store.setError(classified.userMessage);
        
        if (classified.retryable && retryCount < (classified.maxRetries || 3)) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            mutate();
          }, 1000 * Math.pow(2, retryCount));
        }
      }
    }
  );

  // Initialize realtime connection
  useEffect(() => {
    mountedRef.current = true;
    
    // Clean up connections on page unload
    const handleUnload = () => {
      activeConnections.forEach((manager) => {
        manager.disconnect();
      });
      activeConnections.clear();
    };
    
    if (!roomCode || !userId) return;

    // Check if there's already an active connection for this room
    const existingManager = activeConnections.get(roomCode);
    if (existingManager) {
      console.log('Using existing realtime connection for room:', roomCode);
      setRealtimeManager(existingManager);
      realtimeRef.current = existingManager;
      store.setConnectionStatus('connected');
      
      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
      };
    }

    window.addEventListener('beforeunload', handleUnload);

    const initRealtime = async () => {
      try {
        store.setConnectionStatus('connecting');
        
        const manager = new RoomRealtimeManager(
          roomCode,
          userId,
          user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous'
        );

        // Set up event listeners
        manager.on('connected', () => {
          if (mountedRef.current) {
            store.setConnectionStatus('connected');
            store.clearError();
          }
        });

        manager.on('disconnected', () => {
          if (mountedRef.current) {
            store.setConnectionStatus('disconnected');
          }
        });

        manager.on('error', (error: Error) => {
          if (mountedRef.current) {
            const classified = classifyError(error);
            store.setError(classified.userMessage);
            store.setConnectionStatus('error');
          }
        });

        manager.on('reconnecting', ({ attempt, delay }) => {
          if (mountedRef.current) {
            store.setConnectionStatus('connecting');
            if (attempt > 1) {
              toast({ 
                title: 'Reconnecting...', 
                description: `Attempt ${attempt}` 
              });
            }
          }
        });

        manager.on('max_reconnect_attempts', () => {
          if (mountedRef.current) {
            store.setConnectionStatus('error');
            store.setError('Unable to maintain connection. Please refresh the page.');
          }
        });

        // Handle realtime messages
        manager.on('message', (message) => {
          if (mountedRef.current) {
            store.updateFromRealtime({
              type: message.type,
              payload: message,
              timestamp: new Date().toISOString(),
              userId: message.userId || userId,
            });
          }
        });

        // Handle presence updates
        manager.on('presence:sync', (participants) => {
          if (mountedRef.current) {
            // Update participants based on presence
            const updatedParticipants = store.participants.map(p => ({
              ...p,
              isActive: participants.some((pp: any) => pp.userId === p.userId),
            }));
            store.setParticipants(updatedParticipants);
          }
        });

        manager.on('presence:leave', ({ userId: leftUserId }) => {
          if (mountedRef.current) {
            // Mark user as inactive
            const updatedParticipants = store.participants.map(p => ({
              ...p,
              isActive: p.userId === leftUserId ? false : p.isActive,
            }));
            store.setParticipants(updatedParticipants);
            
            if (leftUserId !== userId) {
              toast({ 
                title: 'Partner left',
                description: 'Your partner has left the room',
              });
            }
          }
        });

        // Connect
        await manager.connect();
        
        if (mountedRef.current) {
          // Store in global map
          activeConnections.set(roomCode, manager);
          setRealtimeManager(manager);
          realtimeRef.current = manager;
        } else {
          // Component unmounted during connection, clean up
          await manager.disconnect();
        }

      } catch (error) {
        if (mountedRef.current) {
          const classified = classifyError(error);
          store.setError(classified.userMessage);
          store.setConnectionStatus('error');
          
          // Don't retry on subscription errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('subscribe multiple times') || 
              errorMessage.includes('Subscription timeout')) {
            console.error('Realtime subscription error, not retrying:', error);
            return;
          }
          
          if (classified.retryable) {
            // Retry connection with backoff
            setTimeout(() => {
              if (mountedRef.current) {
                initRealtime();
              }
            }, 2000);
          }
        }
      }
    };

    initRealtime();

    // Cleanup
    return () => {
      mountedRef.current = false;
      window.removeEventListener('beforeunload', handleUnload);
      // Don't disconnect if other components might be using it
      // The connection will be cleaned up when the last component unmounts
    };
  }, [roomCode, userId]);

  // Join room function
  const joinRoom = useCallback(async () => {
    if (!roomCode || !userId) {
      store.setError('You must be signed in to join a room');
      return;
    }

    try {
      store.setLoading(true);
      store.clearError();
      
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw { 
          status: response.status, 
          message: error.message,
          code: error.code 
        };
      }
      
      const data = await response.json();
      toast({ 
        title: 'Success!',
        description: 'Successfully joined room!',
      });
      mutate(); // Refresh room data
      setRetryCount(0);
      
    } catch (error: any) {
      const classified = classifyError(error);
      
      if (classified.retryable) {
        // Retry with backoff
        await retryWithBackoff(async () => {
          const retryResponse = await fetch(`/api/rooms/${roomCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          if (!retryResponse.ok) {
            const error = await retryResponse.json();
            throw { status: retryResponse.status, message: error.message };
          }
          mutate();
        }, classified);
      } else {
        store.setError(classified.userMessage);
        toast({ 
          title: 'Error',
          description: classified.userMessage,
          variant: 'destructive'
        });
      }
    } finally {
      store.setLoading(false);
    }
  }, [roomCode, userId, mutate]);

  // Leave room function
  const leaveRoom = useCallback(async () => {
    if (!roomCode || !user) return;

    try {
      store.setLoading(true);
      
      const response = await fetch(`/api/rooms/${roomCode}/leave`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to leave room: ${response.statusText}`);
      }
      
      // Disconnect realtime
      if (realtimeManager) {
        await realtimeManager.disconnect();
      }
      
      toast({ 
        title: 'Left room',
        description: 'You have left the room',
      });
      
    } catch (error) {
      console.error('Error leaving room:', error);
      toast({ 
        title: 'Error',
        description: 'Failed to leave room',
        variant: 'destructive'
      });
    } finally {
      store.setLoading(false);
    }
  }, [roomCode, user, realtimeManager]);

  // Start tournament function
  const startTournament = useCallback(async () => {
    if (!roomCode || !store.canStartTournament()) {
      toast({ 
        title: 'Cannot start',
        description: 'Cannot start tournament. Need exactly 2 participants.',
        variant: 'destructive'
      });
      return;
    }

    try {
      store.setLoading(true);
      
      const response = await fetch(`/api/rooms/${roomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start tournament');
      }
      
      const data = await response.json();
      toast({ 
        title: 'Tournament started!',
        description: 'Let the games begin! 🎬',
      });
      
      // Tournament data will be updated via realtime
      
    } catch (error: any) {
      const classified = classifyError(error);
      store.setError(classified.userMessage);
      toast({ 
        title: 'Error',
        description: classified.userMessage,
        variant: 'destructive'
      });
    } finally {
      store.setLoading(false);
    }
  }, [roomCode, store.canStartTournament]);

  return {
    // Data
    room: store.room,
    participants: store.participants,
    connectionStatus: store.connectionStatus,
    error: store.error,
    isLoading: store.isLoading || isLoading,
    
    // Computed
    isOwner: userId ? store.isOwner(userId) : false,
    canStart: store.canStartTournament(),
    activeParticipants: store.participants.filter(p => p.isActive),
    
    // Actions
    joinRoom,
    leaveRoom,
    startTournament,
    clearError: store.clearError,
    
    // Realtime
    realtimeManager,
  };
}; 