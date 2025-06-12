import { createClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { rooms, roomParticipants, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { User } from '@supabase/supabase-js'
import { getMissingProfileFields } from '@/lib/utils/profile'

export class AuthMiddleware {
  
  static async validateUser(request: Request): Promise<{ user: User | null; error?: string }> {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { user: null, error: 'Authentication required' }
    }
    
    return { user, error: undefined }
  }
  
  static async validateRoomAccess(
    userId: string, 
    roomId: string, 
    requiredRole?: 'owner' | 'participant'
  ): Promise<{ authorized: boolean; error?: string }> {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: { 
        participants: {
          where: eq(roomParticipants.isActive, true)
        }
      },
    })
    
    if (!room) {
      return { authorized: false, error: 'Room not found' }
    }
    
    const isOwner = room.ownerId === userId
    const isParticipant = room.participants?.some((p: any) => p.userId === userId && p.isActive)
    
    if (requiredRole === 'owner' && !isOwner) {
      return { authorized: false, error: 'Owner access required' }
    }
    
    if (!isOwner && !isParticipant) {
      return { authorized: false, error: 'Room access denied' }
    }
    
    return { authorized: true }
  }
  
  static async validateProfileComplete(userId: string): Promise<{ complete: boolean; missing: string[] }> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    
    if (!user) {
      return { complete: false, missing: ['user profile'] }
    }
    
    const missing = getMissingProfileFields(user)
    return { complete: missing.length === 0, missing }
  }
  
  static async validateRoomCapacity(roomId: string): Promise<{ canJoin: boolean; currentCount: number }> {
    const participants = await db.query.roomParticipants.findMany({
      where: and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.isActive, true)
      ),
    })
    
    return {
      canJoin: participants.length < 2,
      currentCount: participants.length
    }
  }
  
  static async validateRoomStatus(roomId: string, allowedStatuses: string[]): Promise<{ valid: boolean; currentStatus: string }> {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    })
    
    if (!room) {
      return { valid: false, currentStatus: 'not_found' }
    }
    
    return {
      valid: allowedStatuses.includes(room.status),
      currentStatus: room.status
    }
  }
}

// Helper function to combine auth and rate limiting
export async function withAuth(
  request: Request,
  options: {
    requireAuth?: boolean;
    requireCompleteProfile?: boolean;
    setUserHeaders?: boolean;
  } = {}
) {
  const { requireAuth = true, requireCompleteProfile = false, setUserHeaders = true } = options
  
  if (!requireAuth) {
    return { success: true, user: null }
  }
  
  const { user, error } = await AuthMiddleware.validateUser(request)
  
  if (error || !user) {
    return { 
      success: false, 
      response: new Response(
        JSON.stringify({ error: error || 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
  
  if (requireCompleteProfile) {
    const { complete, missing } = await AuthMiddleware.validateProfileComplete(user.id)
    if (!complete) {
      return {
        success: false,
        response: new Response(
          JSON.stringify({ 
            error: 'Profile incomplete', 
            missing,
            redirectTo: '/profile-setup'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }
  
  // Add user ID to headers for rate limiting
  if (setUserHeaders) {
    request.headers.set('x-user-id', user.id)
  }
  
  return { success: true, user }
} 