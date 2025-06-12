import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { EventEmitter } from 'events'

export interface RealtimeConfig {
  maxReconnectAttempts?: number
  reconnectDelayMs?: number
  heartbeatIntervalMs?: number
  messageQueueSize?: number
}

export interface RealtimeMessage {
  id: string
  type: string
  payload: any
  timestamp: string
  userId: string
}

export interface PresenceState {
  userId: string
  joinedAt: string
  lastSeen: string
  metadata?: Record<string, any>
}

export class RealtimeService extends EventEmitter {
  private channels: Map<string, RealtimeChannel> = new Map()
  private messageQueue: Map<string, RealtimeMessage[]> = new Map()
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map()
  private presenceStates: Map<string, Map<string, PresenceState>> = new Map()
  private config: Required<RealtimeConfig>
  private reconnectAttempts: Map<string, number> = new Map()

  constructor(config: RealtimeConfig = {}) {
    super()
    this.config = {
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelayMs: config.reconnectDelayMs ?? 1000,
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 30000,
      messageQueueSize: config.messageQueueSize ?? 100,
    }
  }

  async joinChannel(
    channelName: string,
    userId: string,
    options: { presence?: boolean } = {}
  ): Promise<RealtimeChannel> {
    // Check if already connected
    const existingChannel = this.channels.get(channelName)
    if (existingChannel) {
      return existingChannel
    }

    // Create channel with presence if requested
    const channel = options.presence
      ? supabase.channel(channelName, {
          config: {
            presence: {
              key: userId,
            },
          },
        })
      : supabase.channel(channelName)

    // Set up presence tracking
    if (options.presence) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const presenceMap = new Map<string, PresenceState>()
        
        Object.entries(state).forEach(([key, presences]) => {
          const presence = Array.isArray(presences) ? presences[0] : presences
          presenceMap.set(key, {
            userId: key,
            joinedAt: (presence as any).joinedAt || new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            metadata: presence,
          })
        })

        this.presenceStates.set(channelName, presenceMap)
        this.emit('presence:sync', { channel: channelName, state: presenceMap })
      })

      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presenceMap = this.presenceStates.get(channelName) || new Map()
        presenceMap.set(key, {
          userId: key,
          joinedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          metadata: newPresences,
        })
        this.presenceStates.set(channelName, presenceMap)
        this.emit('presence:join', { channel: channelName, userId: key })
      })

      channel.on('presence', { event: 'leave' }, ({ key }) => {
        const presenceMap = this.presenceStates.get(channelName)
        if (presenceMap) {
          presenceMap.delete(key)
          this.emit('presence:leave', { channel: channelName, userId: key })
        }
      })
    }

    // Set up message handling
    channel.on('broadcast', { event: '*' }, (payload) => {
      const message: RealtimeMessage = {
        id: payload.id || `${Date.now()}-${Math.random()}`,
        type: payload.event,
        payload: payload.payload,
        timestamp: payload.timestamp || new Date().toISOString(),
        userId: payload.userId || 'unknown',
      }

      this.handleIncomingMessage(channelName, message)
    })

    // Subscribe with error handling
    return new Promise((resolve, reject) => {
      let subscribeTimeout: NodeJS.Timeout

      const cleanup = () => {
        if (subscribeTimeout) clearTimeout(subscribeTimeout)
      }

      subscribeTimeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Failed to subscribe to channel ${channelName}: timeout`))
      }, 10000)

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          cleanup()
          this.channels.set(channelName, channel)
          this.messageQueue.set(channelName, [])
          this.reconnectAttempts.set(channelName, 0)
          
          // Track presence if enabled
          if (options.presence) {
            await channel.track({
              userId,
              joinedAt: new Date().toISOString(),
              online: true,
            })
          }

          // Start heartbeat
          this.startHeartbeat(channelName)
          
          this.emit('channel:connected', { channel: channelName })
          resolve(channel)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          cleanup()
          this.handleChannelError(channelName, userId, options)
          reject(new Error(`Failed to subscribe to channel ${channelName}: ${status}`))
        } else if (status === 'CLOSED') {
          this.handleChannelClosed(channelName, userId, options)
        }
      })
    })
  }

  async leaveChannel(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName)
    if (!channel) return

    // Clear any reconnect timers
    const timer = this.reconnectTimers.get(channelName)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(channelName)
    }

    // Unsubscribe
    await channel.unsubscribe()
    
    // Clean up
    this.channels.delete(channelName)
    this.messageQueue.delete(channelName)
    this.presenceStates.delete(channelName)
    this.reconnectAttempts.delete(channelName)
    
    this.emit('channel:disconnected', { channel: channelName })
  }

  async sendMessage(
    channelName: string,
    type: string,
    payload: any,
    options: { retry?: boolean } = {}
  ): Promise<void> {
    const channel = this.channels.get(channelName)
    if (!channel) {
      throw new Error(`Not connected to channel ${channelName}`)
    }

    const message: RealtimeMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      userId: 'current-user', // This should come from auth context
    }

    // Add to queue if retry is enabled
    if (options.retry) {
      this.addToMessageQueue(channelName, message)
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: type,
        payload: message,
      })

      // Remove from queue if successful
      if (options.retry) {
        this.removeFromMessageQueue(channelName, message.id)
      }

      this.emit('message:sent', { channel: channelName, message })
    } catch (error) {
      this.emit('message:error', { channel: channelName, message, error })
      
      if (!options.retry) {
        throw error
      }
      // If retry is enabled, message stays in queue for retry
    }
  }

  getPresenceState(channelName: string): Map<string, PresenceState> | undefined {
    return this.presenceStates.get(channelName)
  }

  isConnected(channelName: string): boolean {
    return this.channels.has(channelName)
  }

  private handleIncomingMessage(channelName: string, message: RealtimeMessage): void {
    this.emit('message:received', { channel: channelName, message })
    this.emit(`message:${message.type}`, { channel: channelName, message })
  }

  private handleChannelError(
    channelName: string,
    userId: string,
    options: { presence?: boolean }
  ): void {
    const attempts = this.getReconnectAttempts(channelName)
    
    if (attempts < this.config.maxReconnectAttempts) {
      const delay = this.config.reconnectDelayMs * Math.pow(2, attempts)
      
      const timer = setTimeout(() => {
        this.incrementReconnectAttempts(channelName)
        this.joinChannel(channelName, userId, options).catch((error) => {
          console.error(`Reconnection attempt ${attempts + 1} failed:`, error)
        })
      }, delay)

      this.reconnectTimers.set(channelName, timer)
      this.emit('channel:reconnecting', { channel: channelName, attempt: attempts + 1 })
    } else {
      this.emit('channel:error', { 
        channel: channelName, 
        error: new Error('Max reconnection attempts reached') 
      })
    }
  }

  private handleChannelClosed(
    channelName: string,
    userId: string,
    options: { presence?: boolean }
  ): void {
    this.channels.delete(channelName)
    this.handleChannelError(channelName, userId, options)
  }

  private startHeartbeat(channelName: string): void {
    // Heartbeat implementation would go here
    // This helps detect stale connections
    setInterval(() => {
      const channel = this.channels.get(channelName)
      if (channel) {
        // Send a ping message to keep connection alive
        this.sendMessage(channelName, 'heartbeat', { timestamp: Date.now() }).catch(() => {
          // Heartbeat failed, connection might be stale
          this.emit('channel:heartbeat_failed', { channel: channelName })
        })
      }
    }, this.config.heartbeatIntervalMs)
  }

  private addToMessageQueue(channelName: string, message: RealtimeMessage): void {
    const queue = this.messageQueue.get(channelName) || []
    queue.push(message)
    
    // Trim queue if too large
    if (queue.length > this.config.messageQueueSize) {
      queue.shift()
    }
    
    this.messageQueue.set(channelName, queue)
  }

  private removeFromMessageQueue(channelName: string, messageId: string): void {
    const queue = this.messageQueue.get(channelName)
    if (!queue) return
    
    const filtered = queue.filter(msg => msg.id !== messageId)
    this.messageQueue.set(channelName, filtered)
  }

  private getReconnectAttempts(channelName: string): number {
    return this.reconnectAttempts.get(channelName) || 0
  }

  private incrementReconnectAttempts(channelName: string): void {
    const current = this.getReconnectAttempts(channelName)
    this.reconnectAttempts.set(channelName, current + 1)
  }

  // Retry queued messages
  async retryQueuedMessages(channelName: string): Promise<void> {
    const queue = this.messageQueue.get(channelName)
    if (!queue || queue.length === 0) return

    const messages = [...queue]
    this.messageQueue.set(channelName, [])

    for (const message of messages) {
      try {
        await this.sendMessage(channelName, message.type, message.payload, { retry: true })
      } catch (error) {
        console.error('Failed to retry message:', error)
      }
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService() 