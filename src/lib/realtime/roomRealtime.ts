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
    tournamentId: z.string(),
    totalMovies: z.number(),
    totalRounds: z.number(),
    matchups: z.array(z.object({
      matchId: z.string(),
      roundNumber: z.number(),
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
      console.log(`[${this.userId}] Already connected or connecting, skipping...`);
      return;
    }

    this.isSubscribing = true;
    console.log(`[${this.userId}] Starting connection to room: ${this.roomCode}`);

    try {
      // Clean up existing channel completely
      if (this.channel) {
        console.log(`[${this.userId}] Cleaning up existing channel...`);
        try {
          await this.channel.unsubscribe();
          supabase.removeChannel(this.channel);
        } catch (e) {
          console.log(`[${this.userId}] Error cleaning up existing channel:`, e);
        }
        this.channel = null;
        this.hasSubscribed = false;
      }

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Use the shared room channel for both presence and messages
      const channelName = `room-${this.roomCode}`;
      console.log(`[${this.userId}] Creating channel: ${channelName}`);

      this.channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: this.userId,
          },
        },
      });

      // Set up presence tracking
      this.channel.on('presence', { event: 'sync' }, () => {
        if (!this.channel) return;
        console.log(`[${this.userId}] Presence sync event`);
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
        console.log(`[${this.userId}] Presence join:`, key);
        const presence = Array.isArray(newPresences) ? newPresences[0] : newPresences;
        this.emit('presence:join', { userId: key, ...presence });
      });

      this.channel.on('presence', { event: 'leave' }, ({ key }) => {
        console.log(`[${this.userId}] Presence leave:`, key);
        this.emit('presence:leave', { userId: key });
      });

      // Set up message handling
      this.channel.on('broadcast', { event: '*' }, (payload) => {
        try {
          console.log(`[${this.userId}] Received broadcast:`, payload.event, payload.payload);
          const parsed = RoomMessageSchema.parse(payload.payload);
          this.emit('message', parsed);
          this.emit(`message:${parsed.type}`, parsed);
        } catch (error) {
          console.error(`[${this.userId}] Invalid room message received:`, error);
        }
      });

      // Subscribe with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription timeout'));
        }, 15000);

        if (!this.channel) {
          clearTimeout(timeout);
          reject(new Error('Channel not initialized'));
          return;
        }

        let subscriptionHandled = false;

        this.channel.subscribe((status) => {
          console.log(`[${this.userId}] Subscription status:`, status);
          
          if (subscriptionHandled) return;
          
          if (status === 'SUBSCRIBED') {
            subscriptionHandled = true;
            clearTimeout(timeout);
            this.isConnected = true;
            this.isSubscribing = false;
            this.hasSubscribed = true;
            this.reconnectAttempts = 0;
            console.log(`[${this.userId}] Successfully subscribed to channel`);
            this.emit('connected');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            subscriptionHandled = true;
            clearTimeout(timeout);
            this.isSubscribing = false;
            console.error(`[${this.userId}] Channel error during subscription`);
            reject(new Error('Channel subscription failed'));
          } else if (status === 'TIMED_OUT') {
            subscriptionHandled = true;
            clearTimeout(timeout);
            this.isSubscribing = false;
            reject(new Error('Subscription timed out'));
          } else if (status === 'CLOSED') {
            console.log(`[${this.userId}] Channel closed during subscription`);
          }
        });
      });

      // Track presence only after successful subscription
      if (this.channel && this.isConnected) {
        try {
          console.log(`[${this.userId}] Tracking presence...`);
          await this.channel.track({
            userId: this.userId,
            userName: this.userName,
            joinedAt: new Date().toISOString(),
            online: true,
          });

          // Small delay before announcing to let presence sync
          await new Promise(resolve => setTimeout(resolve, 500));

          // Announce arrival
          await this.sendMessage({
            type: 'user_joined',
            userId: this.userId,
            userName: this.userName,
          });
          
          console.log(`[${this.userId}] Presence tracked and arrival announced`);
        } catch (error) {
          console.error(`[${this.userId}] Error tracking presence or announcing arrival:`, error);
        }
      }

    } catch (error) {
      console.error(`[${this.userId}] Connection error:`, error);
      this.isSubscribing = false;
      this.handleConnectionError();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log(`[${this.userId}] Starting disconnect from room: ${this.roomCode}`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel) {
      // Announce departure if connected
      if (this.isConnected) {
        try {
          console.log(`[${this.userId}] Sending departure message...`);
          await this.sendMessage({
            type: 'user_left',
            userId: this.userId,
          });
        } catch (error) {
          console.error(`[${this.userId}] Error sending departure message:`, error);
        }
      }

      try {
        console.log(`[${this.userId}] Unsubscribing from channel...`);
        await this.channel.unsubscribe();
        supabase.removeChannel(this.channel);
      } catch (error) {
        console.error(`[${this.userId}] Error during channel cleanup:`, error);
      }
    }

    this.channel = null;
    this.isConnected = false;
    this.isSubscribing = false;
    this.hasSubscribed = false;
    
    console.log(`[${this.userId}] Disconnected from room: ${this.roomCode}`);
    this.emit('disconnected');
  }

  async sendMessage(message: RoomMessage): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Not connected to room');
    }

    const validated = RoomMessageSchema.parse(message);
    console.log(`[${this.userId}] Sending message:`, validated.type);
    
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