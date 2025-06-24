'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import { useUser } from '@/lib/hooks/useUser';
import { RoomRealtimeManager } from '@/lib/realtime/roomRealtime';
import { useTournamentStore } from '@/lib/stores/tournamentStore';
import { classifyError, retryWithBackoff } from '@/lib/errors/errorClassification';
import { useToast } from '@/components/ui/use-toast';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

export const useRoom = (roomCode: string | null) => {
  const { user } = useUser();
  const userId = user?.id;
  const { toast } = useToast();
  const store = useTournamentStore();
  
  // Use refs to prevent useEffect from re-running unnecessarily
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  
  // Stable user info - only update when actually changed
  const [stableUserInfo, setStableUserInfo] = useState({
    id: userId,
    displayName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous'
  });
  
  // Update stable user info only when values actually change
  useEffect(() => {
    const newDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous';
    
    if (userId !== stableUserInfo.id || newDisplayName !== stableUserInfo.displayName) {
      setStableUserInfo({
        id: userId,
        displayName: newDisplayName
      });
    }
  }, [userId, user?.user_metadata?.full_name, user?.email, stableUserInfo.id, stableUserInfo.displayName]);

  const [realtimeManager, setRealtimeManager] = useState<RoomRealtimeManager | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // SWR for room data - no polling since we use real-time updates
  const { data: roomData, error: roomError, isLoading, mutate } = useSWR(
    roomCode ? `/api/rooms/${roomCode}` : null,
    fetcher,
    {
      refreshInterval: 0, // Disable polling - use real-time updates instead
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (data: any) => {
        if (data?.room) {
          store.setRoom(data.room);
        }
        if (data?.participants) {
          store.setParticipants(data.participants);
        }
        if (data?.tournament) {
          store.setTournament(data.tournament);
        }
        store.setError(null);
      },
      onError: (error: any) => {
        const classified = classifyError(error);
        store.setError(classified.userMessage);
      }
    }
  );

  // Realtime connection effect - stabilized dependencies
  useEffect(() => {
    if (!roomCode || !stableUserInfo.id) {
      return;
    }

    // Prevent multiple concurrent initializations
    if (initializingRef.current) {
      console.log('Realtime initialization already in progress, skipping...');
      return;
    }

    const initRealtime = async () => {
      // Double-check initialization state
      if (initializingRef.current) {
        console.log('Another initialization started during async operation, aborting...');
        return;
      }

      initializingRef.current = true;

      try {
        console.log(`Initializing realtime connection for room: ${roomCode}, user: ${stableUserInfo.id}`);
        store.setConnectionStatus('connecting');
        
        // Clean up any existing manager first
        if (realtimeManager) {
          console.log('Cleaning up existing realtime manager...');
          await realtimeManager.disconnect();
          setRealtimeManager(null);
        }

        // Check if still mounted after async operation
        if (!mountedRef.current) {
          console.log('Component unmounted during cleanup, aborting initialization...');
          return;
        }

        const manager = new RoomRealtimeManager(
          roomCode,
          stableUserInfo.id!,
          stableUserInfo.displayName
        );

        // Set up event listeners before connecting
        manager.on('connected', () => {
          if (mountedRef.current) {
            console.log(`Realtime connected for room: ${roomCode}`);
            store.setConnectionStatus('connected');
            store.clearError();
          }
        });

        manager.on('disconnected', () => {
          if (mountedRef.current) {
            console.log(`Realtime disconnected for room: ${roomCode}`);
            store.setConnectionStatus('disconnected');
          }
        });

        manager.on('error', (error: Error) => {
          if (mountedRef.current) {
            console.error(`Realtime error for room: ${roomCode}`, error);
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
            console.log('Received realtime message:', message.type, message);
            store.updateFromRealtime({
              type: message.type,
              payload: message,
              timestamp: new Date().toISOString(),
              userId: stableUserInfo.id!, // Always pass the current receiving user's ID
            });
          }
        });

        // Handle presence updates
        manager.on('presence:sync', (participants) => {
          if (mountedRef.current) {
            console.log('Presence sync:', participants);
            const currentParticipants = store.participants;
            const updatedParticipants = currentParticipants.map(p => ({
              ...p,
              isActive: participants.some((pp: any) => pp.userId === p.userId),
            }));
            
            // Add any new participants from presence that aren't in store yet
            participants.forEach((presenceParticipant: any) => {
              if (!updatedParticipants.find(p => p.userId === presenceParticipant.userId)) {
                updatedParticipants.push({
                  userId: presenceParticipant.userId,
                  userName: presenceParticipant.userName || 'Unknown',
                  isActive: true,
                  joinedAt: presenceParticipant.joinedAt || new Date().toISOString(),
                });
              }
            });
            
            store.setParticipants(updatedParticipants);
          }
        });

        manager.on('presence:join', ({ userId: joinedUserId, userName }) => {
          if (mountedRef.current) {
            console.log('User joined presence:', joinedUserId, userName);
            const currentParticipants = store.participants;
            const existingIndex = currentParticipants.findIndex(p => p.userId === joinedUserId);
            
            if (existingIndex >= 0) {
              const updated = [...currentParticipants];
              updated[existingIndex] = {
                ...updated[existingIndex],
                isActive: true,
                userName: userName || updated[existingIndex].userName,
              };
              store.setParticipants(updated);
            } else {
              store.setParticipants([
                ...currentParticipants,
                {
                  userId: joinedUserId,
                  userName: userName || 'Unknown',
                  isActive: true,
                  joinedAt: new Date().toISOString(),
                }
              ]);
            }

            if (joinedUserId !== stableUserInfo.id) {
              toast({ 
                title: 'Someone joined',
                description: `${userName || 'A user'} joined the room`,
              });
            }
          }
        });

        manager.on('presence:leave', ({ userId: leftUserId }) => {
          if (mountedRef.current) {
            console.log('User left presence:', leftUserId);
            const updatedParticipants = store.participants.map(p => ({
              ...p,
              isActive: p.userId === leftUserId ? false : p.isActive,
            }));
            store.setParticipants(updatedParticipants);
            
            if (leftUserId !== stableUserInfo.id) {
              const leftUser = store.participants.find(p => p.userId === leftUserId);
              toast({ 
                title: 'Someone left',
                description: `${leftUser?.userName || 'A user'} left the room`,
              });
            }
          }
        });

        // Connect
        console.log(`Attempting to connect realtime manager for room: ${roomCode}`);
        await manager.connect();
        
        if (mountedRef.current) {
          setRealtimeManager(manager);
          console.log(`Realtime manager connected and stored for room: ${roomCode}`);
        } else {
          // Component unmounted during connection, clean up
          console.log('Component unmounted during connection, cleaning up...');
          await manager.disconnect();
        }

      } catch (error) {
        console.error('Failed to initialize realtime connection:', error);
        if (mountedRef.current) {
          const classified = classifyError(error);
          store.setError(classified.userMessage);
          store.setConnectionStatus('error');
          
          // Only retry on retryable errors, not subscription errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('subscribe multiple times') && 
              !errorMessage.includes('Subscription timeout') &&
              classified.retryable && retryCount < 3) {
            console.log(`Retrying realtime connection in 3 seconds... (attempt ${retryCount + 1})`);
            setTimeout(() => {
              if (mountedRef.current) {
                initializingRef.current = false;
                setRetryCount(prev => prev + 1);
                initRealtime();
              }
            }, 3000);
          }
        }
      } finally {
        initializingRef.current = false;
      }
    };

    initRealtime();

    // Set up cleanup function
    cleanupRef.current = async () => {
      console.log(`useRoom cleanup for room: ${roomCode}`);
      mountedRef.current = false;
      initializingRef.current = false;
      
      if (realtimeManager) {
        console.log(`Disconnecting realtime manager for room: ${roomCode}`);
        await realtimeManager.disconnect();
        setRealtimeManager(null);
      }
    };

    // Cleanup
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [roomCode, stableUserInfo.id, stableUserInfo.displayName]); // Use stable user info

  // Reset mounted ref on mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Memoize store methods to prevent unnecessary re-renders
  const storeActions = useCallback(() => ({
    setError: store.setError,
    setLoading: store.setLoading,
    clearError: store.clearError,
    canStartTournament: store.canStartTournament,
  }), [store.setError, store.setLoading, store.clearError, store.canStartTournament]);

  // Join room function
  const joinRoom = useCallback(async () => {
    if (!roomCode || !stableUserInfo.id) {
      storeActions().setError('You must be signed in to join a room');
      return;
    }

    try {
      storeActions().setLoading(true);
      storeActions().clearError();
      
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: stableUserInfo.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw { 
          status: response.status, 
          message: error.message,
          code: error.code 
        };
      }

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
            body: JSON.stringify({ userId: stableUserInfo.id }),
          });
          
          if (!retryResponse.ok) {
            const error = await retryResponse.json();
            throw { status: retryResponse.status, message: error.message };
          }
          
          return retryResponse.json();
        }, classified);
        
        toast({ 
          title: 'Success!',
          description: 'Successfully joined room!',
        });
        mutate();
      } else {
        storeActions().setError(classified.userMessage);
        toast({ 
          title: 'Error',
          description: classified.userMessage,
          variant: 'destructive'
        });
      }
    } finally {
      storeActions().setLoading(false);
    }
  }, [roomCode, stableUserInfo.id, storeActions, toast, mutate]);

  // Leave room function
  const leaveRoom = useCallback(async () => {
    if (!roomCode || !user) return;

    try {
      storeActions().setLoading(true);
      
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
        setRealtimeManager(null);
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
      storeActions().setLoading(false);
    }
  }, [roomCode, user, realtimeManager, toast, storeActions]);

  // Start tournament function
  const startTournament = useCallback(async () => {
    if (!roomCode || !storeActions().canStartTournament()) {
      toast({ 
        title: 'Cannot start',
        description: 'Cannot start tournament. Need exactly 2 participants.',
        variant: 'destructive'
      });
      return;
    }

    try {
      storeActions().setLoading(true);
      storeActions().clearError();
      
      console.log('Starting tournament for room:', roomCode);
      const response = await fetch(`/api/rooms/${roomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Tournament start failed:', error);
        if (response.status === 400 && error.error?.includes('already active')) {
          console.log('Room already active, refreshing state...');
          mutate();
          return;
        }
        throw new Error(error.message || 'Failed to start tournament');
      }
      
      const data = await response.json();
      console.log('Tournament started successfully:', data);
      toast({ 
        title: 'Tournament started!',
        description: 'Let the games begin! 🎬',
      });
      
      // Tournament data will be updated via realtime events - no need to force refresh
      
    } catch (error: any) {
      console.error('Error starting tournament:', error);
      const classified = classifyError(error);
      storeActions().setError(classified.userMessage);
      toast({ 
        title: 'Error',
        description: classified.userMessage,
        variant: 'destructive'
      });
    } finally {
      storeActions().setLoading(false);
    }
  }, [roomCode, storeActions, toast, mutate]);

  // Computed values for backward compatibility
  const computedValues = useMemo(() => {
    const activeParticipants = store.participants.filter(p => p.isActive);
    const isOwner = stableUserInfo.id ? store.room?.ownerId === stableUserInfo.id : false;
    const canStart = store.canStartTournament();
    
    return {
      activeParticipants,
      isOwner,
      canStart,
    };
  }, [store.participants, store.room?.ownerId, stableUserInfo.id]);

  return {
    // Data
    room: store.room,
    participants: store.participants,
    connectionStatus: store.connectionStatus,
    error: store.error,
    isLoading: store.isLoading || isLoading,
    
    // Computed
    activeParticipants: computedValues.activeParticipants,
    isOwner: computedValues.isOwner,
    canStart: computedValues.canStart,
    
    // Actions
    joinRoom,
    leaveRoom,
    startTournament,
    clearError: store.clearError,
    
    // Utilities
    refresh: mutate,
    realtimeManager,
  };
}; 