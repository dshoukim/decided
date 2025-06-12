import { db } from '@/db';
import { rooms, roomHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export enum RoomStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned'
}

interface StateTransition {
  from: RoomStatus[];
  to: RoomStatus;
  description: string;
}

const ALLOWED_TRANSITIONS: Record<RoomStatus, StateTransition[]> = {
  [RoomStatus.WAITING]: [
    {
      from: [RoomStatus.WAITING],
      to: RoomStatus.ACTIVE,
      description: 'Start tournament with 2 participants'
    },
    {
      from: [RoomStatus.WAITING],
      to: RoomStatus.ABANDONED,
      description: 'Abandon empty room or timeout'
    }
  ],
  [RoomStatus.ACTIVE]: [
    {
      from: [RoomStatus.ACTIVE],
      to: RoomStatus.COMPLETED,
      description: 'Tournament finished successfully'
    },
    {
      from: [RoomStatus.ACTIVE],
      to: RoomStatus.ABANDONED,
      description: 'Tournament abandoned by participants'
    }
  ],
  [RoomStatus.COMPLETED]: [
    // Final state - no transitions allowed
  ],
  [RoomStatus.ABANDONED]: [
    // Final state - no transitions allowed
  ]
};

export class RoomStateManager {
  
  static async transitionTo(
    roomId: string, 
    newStatus: RoomStatus, 
    metadata?: any,
    broadcastRoomCode?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Get current room state
      const currentRoom = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      if (currentRoom.length === 0) {
        return { success: false, error: 'Room not found' };
      }

      const room = currentRoom[0];
      const currentStatus = room.status as RoomStatus;

      // 2. Validate transition is allowed
      const isValidTransition = this.isTransitionAllowed(currentStatus, newStatus);
      if (!isValidTransition) {
        return { 
          success: false, 
          error: `Invalid transition from ${currentStatus} to ${newStatus}` 
        };
      }

      // 3. Update room in database
      await db
        .update(rooms)
        .set({ 
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(metadata && { metadata: JSON.stringify(metadata) })
        })
        .where(eq(rooms.id, roomId));

      // 4. Log to room_history
      await db
        .insert(roomHistory)
        .values({
          roomId,
          eventType: 'status_transition',
          eventData: JSON.stringify({
            from: currentStatus,
            to: newStatus,
            timestamp: new Date().toISOString(),
            metadata
          }),
          createdAt: new Date().toISOString()
        });

      // 5. Broadcast via Realtime
      if (broadcastRoomCode) {
        const supabase = await createClient();
        await supabase.channel(`room:${broadcastRoomCode}`)
          .send({
            type: 'broadcast',
            event: 'room_status_changed',
            payload: {
              roomId,
              oldStatus: currentStatus,
              newStatus,
              timestamp: new Date().toISOString(),
              metadata
            }
          });
      }

      // 6. Trigger cleanup if needed
      if (newStatus === RoomStatus.ABANDONED) {
        await this.scheduleRoomCleanup(roomId);
      }

      return { success: true };

    } catch (error) {
      console.error('Error transitioning room state:', error);
      return { 
        success: false, 
        error: 'Failed to transition room state' 
      };
    }
  }

  static isTransitionAllowed(fromStatus: RoomStatus, toStatus: RoomStatus): boolean {
    const allowedTransitions = ALLOWED_TRANSITIONS[toStatus];
    return allowedTransitions.some(transition => 
      transition.from.includes(fromStatus)
    );
  }

  static async validateStateForOperation(
    roomId: string, 
    requiredStatus: RoomStatus | RoomStatus[]
  ): Promise<{ valid: boolean; currentStatus?: RoomStatus; error?: string }> {
    try {
      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      if (room.length === 0) {
        return { valid: false, error: 'Room not found' };
      }

      const currentStatus = room[0].status as RoomStatus;
      const requiredStatuses = Array.isArray(requiredStatus) ? requiredStatus : [requiredStatus];

      const isValid = requiredStatuses.includes(currentStatus);

      return {
        valid: isValid,
        currentStatus,
        error: isValid ? undefined : `Operation requires room status to be ${requiredStatuses.join(' or ')}, but current status is ${currentStatus}`
      };

    } catch (error) {
      console.error('Error validating room state:', error);
      return { 
        valid: false, 
        error: 'Failed to validate room state' 
      };
    }
  }

  private static async scheduleRoomCleanup(roomId: string): Promise<void> {
    try {
      // Mark room for cleanup (in production, this could trigger a background job)
      await db
        .update(rooms)
        .set({ 
          metadata: JSON.stringify({ 
            scheduledForCleanup: true,
            cleanupScheduledAt: new Date().toISOString()
          })
        })
        .where(eq(rooms.id, roomId));

      // In a production environment, you would:
      // 1. Add to a cleanup queue/job system
      // 2. Set a timer to delete room data after retention period
      // 3. Notify participants about room closure
      
      console.log(`Room ${roomId} scheduled for cleanup`);

    } catch (error) {
      console.error('Error scheduling room cleanup:', error);
    }
  }

  static async getRoomStatus(roomId: string): Promise<RoomStatus | null> {
    try {
      const room = await db
        .select({ status: rooms.status })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      return room.length > 0 ? room[0].status as RoomStatus : null;
    } catch (error) {
      console.error('Error getting room status:', error);
      return null;
    }
  }
} 