import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { EventEmitter } from 'events';

// Message schemas
export const RoomMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user_joined'),
    userId: z.string().uuid(),
    userName: z.string(),
    avatarUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal('user_left'),
    userId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('tournament_started'),
    tournamentId: z.string().uuid(),
    totalMovies: z.number(),
    totalRounds: z.number(),
    matchups: z.array(z.object({
      matchId: z.string(),
      movieA: z.object({ 
        id: z.number(), 
        title: z.string(),
        poster_path: z.string().optional(),
      }),
      movieB: z.object({ 
        id: z.number(), 
        title: z.string(),
        poster_path: z.string().optional(),
      }),
    })),
  }),
  z.object({
    type: z.literal('pick_made'),
    userId: z.string().uuid(),
    matchId: z.string(),
    roundNumber: z.number(),
    progress: z.object({
      userPicks: z.number(),
      totalPicks: z.number(),
    }),
  }),
  z.object({
    type: z.literal('round_completed'),
    roundNumber: z.number(),
    nextRoundMatchups: z.array(z.any()).optional(),
  }),
  z.object({
    type: z.literal('final_picks_ready'),
    userAPick: z.object({ movieId: z.number(), title: z.string() }),
    userBPick: z.object({ movieId: z.number(), title: z.string() }),
  }),
  z.object({
    type: z.literal('winner_selected'),
    winnerMovieId: z.number(),
    winnerTitle: z.string(),
    winnerPosterPath: z.string().optional(),
  }),
]);

export type RoomMessage = z.infer<typeof RoomMessageSchema>;

export class RoomRealtimeManager extends EventEmitter {
  private channel: RealtimeChannel | null = null;
  private roomCode: string;
  private userId: string;
  private userName: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;
  private isSubscribing = false;
  private hasSubscribed = false;

  constructor(roomCode: string, userId: string, userName: string) {
    super();
    this.roomCode = roomCode;
    this.userId = userId;
    this.userName = userName;
  }

  async connect(): Promise<void> {
    // Prevent multiple connections
    if (this.isConnected || this.isSubscribing) {
      console.log('Already connected or connecting, skipping...');
      return;
    }

    this.isSubscribing = true;

    try {
      // Clean up existing channel completely
      if (this.channel) {
        try {
          await this.channel.unsubscribe();
          // Remove the channel from Supabase client to ensure clean state
          supabase.removeChannel(this.channel);
        } catch (e) {
          console.log('Error cleaning up existing channel:', e);
        }
        this.channel = null;
        this.hasSubscribed = false;
      }

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a fresh channel with presence - using public channel
      this.channel = supabase.channel(`room-${this.roomCode}`, {
        config: {
          presence: {
            key: this.userId,
          },
        },
      });

      // Set up presence tracking
      this.channel.on('presence', { event: 'sync' }, () => {
        if (!this.channel) return;
        const state = this.channel.presenceState();
        const participants = Object.entries(state).map(([key, presences]) => {
          const presence = Array.isArray(presences) ? presences[0] : presences;
          return {
            userId: key,
            online: true,
            ...presence,
          };
        });
        this.emit('presence:sync', participants);
      });

      this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.emit('presence:join', { userId: key, ...newPresences });
      });

      this.channel.on('presence', { event: 'leave' }, ({ key }) => {
        this.emit('presence:leave', { userId: key });
      });

      // Set up message handling
      this.channel.on('broadcast', { event: '*' }, (payload) => {
        try {
          const parsed = RoomMessageSchema.parse(payload.payload);
          this.emit('message', parsed);
          this.emit(`message:${parsed.type}`, parsed);
        } catch (error) {
          console.error('Invalid room message received:', error);
        }
      });

      // Subscribe with timeout - simplified approach
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription timeout'));
        }, 20000); // Increased timeout to 20 seconds

        if (!this.channel) {
          clearTimeout(timeout);
          reject(new Error('Channel not initialized'));
          return;
        }

        let subscriptionHandled = false;

        this.channel.subscribe((status) => {
          console.log('Subscription status:', status);
          
          if (subscriptionHandled) return; // Prevent handling multiple status updates
          
          if (status === 'SUBSCRIBED') {
            subscriptionHandled = true;
            clearTimeout(timeout);
            this.isConnected = true;
            this.isSubscribing = false;
            this.hasSubscribed = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            subscriptionHandled = true;
            clearTimeout(timeout);
            this.isSubscribing = false;
            // Don't reject on channel error, just log it
            console.error('Channel error during subscription');
            // Try to resolve anyway to prevent hanging
            resolve();
          } else if (status === 'TIMED_OUT') {
            subscriptionHandled = true;
            clearTimeout(timeout);
            this.isSubscribing = false;
            reject(new Error('Subscription timed out'));
          } else if (status === 'CLOSED') {
            // Don't reject on CLOSED, just note it
            console.log('Channel closed during subscription');
          }
        });
      });

      // Track presence only after successful subscription
      if (this.channel && this.isConnected) {
        try {
          await this.channel.track({
            userId: this.userId,
            userName: this.userName,
            joinedAt: new Date().toISOString(),
            online: true,
          });

          // Announce arrival
          await this.sendMessage({
            type: 'user_joined',
            userId: this.userId,
            userName: this.userName,
          });
        } catch (error) {
          console.error('Error tracking presence or announcing arrival:', error);
        }
      }

    } catch (error) {
      console.error('Connection error:', error);
      this.isSubscribing = false;
      this.handleConnectionError();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel) {
      // Announce departure if connected
      if (this.isConnected) {
        try {
          await this.sendMessage({
            type: 'user_left',
            userId: this.userId,
          });
        } catch (error) {
          console.error('Error sending departure message:', error);
        }
      }

      try {
        await this.channel.unsubscribe();
        // Remove the channel from Supabase client to ensure clean state
        supabase.removeChannel(this.channel);
      } catch (error) {
        console.error('Error during channel cleanup:', error);
      }
    }

    this.channel = null;
    this.isConnected = false;
    this.isSubscribing = false;
    this.hasSubscribed = false;
    this.emit('disconnected');
  }

  async sendMessage(message: RoomMessage): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Not connected to room');
    }

    const validated = RoomMessageSchema.parse(message);
    
    await this.channel.send({
      type: 'broadcast',
      event: validated.type,
      payload: validated,
    });
  }

  getParticipants(): Array<{ userId: string; online: boolean; [key: string]: any }> {
    if (!this.channel) return [];
    
    const state = this.channel.presenceState();
    return Object.entries(state).map(([userId, presences]) => {
      const presence = Array.isArray(presences) ? presences[0] : presences;
      return {
        userId,
        online: true,
        ...presence,
      };
    });
  }

  isUserOnline(userId: string): boolean {
    const participants = this.getParticipants();
    return participants.some(p => p.userId === userId && p.online);
  }

  private handleConnectionError(): void {
    this.isConnected = false;
    this.emit('error', new Error('Connection failed'));
    
    // Don't automatically reconnect on initial connection failure
    if (this.reconnectAttempts === 0) {
      console.log('Initial connection failed, not attempting automatic reconnect');
      return;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.emit('max_reconnect_attempts');
    }
  }

  private handleDisconnection(): void {
    this.isConnected = false;
    this.emit('disconnected');
    
    // Only reconnect if we've successfully connected before
    if (this.hasSubscribed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 60000); // Start with 2s, max 60s
    this.reconnectAttempts++;

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }

  // Helper method to wait for specific message types
  async waitForMessage(type: RoomMessage['type'], timeoutMs = 30000): Promise<RoomMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off(`message:${type}`, handler);
        reject(new Error(`Timeout waiting for message: ${type}`));
      }, timeoutMs);

      const handler = (message: RoomMessage) => {
        clearTimeout(timeout);
        this.off(`message:${type}`, handler);
        resolve(message);
      };

      this.once(`message:${type}`, handler);
    });
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    if (this.isConnected) return 'connected';
    if (this.reconnectTimer) return 'connecting';
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return 'error';
    return 'disconnected';
  }
} 