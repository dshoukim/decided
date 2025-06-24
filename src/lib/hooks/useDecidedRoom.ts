'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RoomState } from '@/lib/services/room-state-manager';

interface UseDecidedRoomOptions {
  roomCode: string;
  pollInterval?: number;
}

export function useDecidedRoom({ roomCode, pollInterval = 2000 }: UseDecidedRoomOptions) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling fallback
  const pollState = useCallback(async () => {
    try {
      const response = await fetch(`/api/decided/rooms/${roomCode}/state`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch state');
      }

      const newState = await response.json();
      setState(newState);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [roomCode]);

  // Set up SSE connection with polling fallback
  useEffect(() => {
    let mounted = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(`/api/decided/rooms/${roomCode}/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          if (!mounted) return;
          setIsConnected(true);
          setError(null);
          setLoading(false);
          
          // Clear polling interval if SSE is connected
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        };

        eventSource.onmessage = (event) => {
          if (!mounted) return;
          
          try {
            const newState = JSON.parse(event.data);
            setState(newState);
            setError(null);
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        };

        eventSource.onerror = () => {
          if (!mounted) return;
          
          setIsConnected(false);
          eventSource.close();
          eventSourceRef.current = null;

          // Fall back to polling
          if (!pollIntervalRef.current) {
            pollState(); // Poll immediately
            pollIntervalRef.current = setInterval(pollState, pollInterval);
          }

          // Try to reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            if (mounted) {
              connectSSE();
            }
          }, 5000);
        };
      } catch (err) {
        // SSE not supported or other error, fall back to polling
        setIsConnected(false);
        setLoading(false);
        
        if (!pollIntervalRef.current) {
          pollState(); // Poll immediately
          pollIntervalRef.current = setInterval(pollState, pollInterval);
        }
      }
    };

    // Initial connection
    connectSSE();

    // Cleanup
    return () => {
      mounted = false;
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [roomCode, pollInterval, pollState]);

  // Send action to server
  const sendAction = useCallback(async (
    action: string, 
    payload?: any,
    idempotencyKey?: string
  ) => {
    try {
      const response = await fetch(`/api/decided/rooms/${roomCode}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          payload,
          idempotencyKey: idempotencyKey || `${action}-${Date.now()}-${Math.random()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Action failed');
      }

      const result = await response.json();
      
      // Update state immediately with the response
      if (result.state) {
        setState(result.state);
      }
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [roomCode]);

  return {
    state,
    error,
    loading,
    isConnected,
    sendAction,
  };
} 