import { realtimeService } from './realtime-service'
import { z } from 'zod'

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
      movieA: z.object({ id: z.number(), title: z.string() }),
      movieB: z.object({ id: z.number(), title: z.string() }),
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

export class RoomRealtimeManager {
  private roomCode: string;
  private userId: string;
  private userName: string;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnected = false;

  constructor(roomCode: string, userId: string, userName: string) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.userName = userName;
    this.setupListeners();
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    await realtimeService.joinChannel(`room:${this.roomCode}`, this.userId, { presence: true });
    this.isConnected = true;
    
    // Announce arrival
    await this.sendMessage({
      type: 'user_joined',
      userId: this.userId,
      userName: this.userName,
    });
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      // Announce departure
      await this.sendMessage({
        type: 'user_left',
        userId: this.userId,
      });
    } catch (error) {
      // Ignore errors when leaving
      console.warn('Error sending leave message:', error);
    }
    
    await realtimeService.leaveChannel(`room:${this.roomCode}`);
    this.isConnected = false;
    this.removeAllListeners();
  }

  async sendMessage(message: RoomMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to room channel');
    }

    const validated = RoomMessageSchema.parse(message);
    await realtimeService.sendMessage(
      `room:${this.roomCode}`,
      validated.type,
      validated,
      { retry: true }
    );
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  getParticipants(): Array<{ userId: string; online: boolean; metadata?: any }> {
    const presence = realtimeService.getPresenceState(`room:${this.roomCode}`);
    if (!presence) return [];
    
    return Array.from(presence.entries()).map(([userId, state]) => ({
      userId,
      online: true,
      metadata: state.metadata,
    }));
  }

  isChannelConnected(): boolean {
    return this.isConnected && realtimeService.isConnected(`room:${this.roomCode}`);
  }

  private setupListeners(): void {
    // Listen for all room messages
    realtimeService.on('message:received', ({ channel, message }) => {
      if (channel !== `room:${this.roomCode}`) return;
      
      try {
        const parsed = RoomMessageSchema.parse(message.payload);
        this.emit(parsed.type, parsed);
      } catch (error) {
        console.error('Invalid room message received:', error);
      }
    });

    // Handle connection events
    realtimeService.on('channel:connected', ({ channel }) => {
      if (channel === `room:${this.roomCode}`) {
        this.emit('connected', {});
      }
    });

    realtimeService.on('channel:disconnected', ({ channel }) => {
      if (channel === `room:${this.roomCode}`) {
        this.isConnected = false;
        this.emit('disconnected', {});
      }
    });

    realtimeService.on('channel:error', ({ channel, error }) => {
      if (channel === `room:${this.roomCode}`) {
        this.emit('error', { error });
      }
    });

    // Presence events
    realtimeService.on('presence:join', ({ channel, userId }) => {
      if (channel === `room:${this.roomCode}`) {
        this.emit('participant:joined', { userId });
      }
    });

    realtimeService.on('presence:leave', ({ channel, userId }) => {
      if (channel === `room:${this.roomCode}`) {
        this.emit('participant:left', { userId });
      }
    });
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private removeAllListeners(): void {
    this.listeners.clear();
  }

  // Convenience methods for specific message types
  async startTournament(tournamentData: {
    tournamentId: string;
    totalMovies: number;
    totalRounds: number;
    matchups: Array<{
      matchId: string;
      movieA: { id: number; title: string };
      movieB: { id: number; title: string };
    }>;
  }): Promise<void> {
    await this.sendMessage({
      type: 'tournament_started',
      ...tournamentData,
    });
  }

  async makePick(data: {
    matchId: string;
    roundNumber: number;
    progress: {
      userPicks: number;
      totalPicks: number;
    };
  }): Promise<void> {
    await this.sendMessage({
      type: 'pick_made',
      userId: this.userId,
      ...data,
    });
  }

  async announceWinner(data: {
    winnerMovieId: number;
    winnerTitle: string;
    winnerPosterPath?: string;
  }): Promise<void> {
    await this.sendMessage({
      type: 'winner_selected',
      ...data,
    });
  }
}

// Factory function for creating room managers
export function createRoomManager(roomCode: string, userId: string, userName: string): RoomRealtimeManager {
  return new RoomRealtimeManager(roomCode, userId, userName);
} 