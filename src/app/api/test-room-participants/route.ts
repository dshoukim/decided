import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rooms, roomParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    
    if (!roomCode) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 });
    }

    // Get room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get all participants
    const participants = await db.query.roomParticipants.findMany({
      where: eq(roomParticipants.roomId, room.id),
    });

    console.log(`🔍 [ROOM-PARTICIPANTS] Room ${roomCode} analysis:`, {
      roomId: room.id,
      ownerId: room.ownerId.substring(0, 8) + '...',
      status: room.status,
      totalParticipants: participants.length,
      activeParticipants: participants.filter(p => p.isActive).length,
      participants: participants.map(p => ({
        userId: p.userId.substring(0, 8) + '...',
        isActive: p.isActive,
        isOwner: p.userId === room.ownerId,
        joinedAt: p.joinedAt
      }))
    });

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        ownerId: room.ownerId.substring(0, 8) + '...',
        status: room.status,
        createdAt: room.createdAt
      },
      participants: participants.map(p => ({
        userId: p.userId.substring(0, 8) + '...',
        isActive: p.isActive,
        isOwner: p.userId === room.ownerId,
        joinedAt: p.joinedAt
      })),
      summary: {
        totalParticipants: participants.length,
        activeParticipants: participants.filter(p => p.isActive).length,
        ownerIsParticipant: participants.some(p => p.userId === room.ownerId),
        ownerIsActive: participants.some(p => p.userId === room.ownerId && p.isActive)
      }
    });

  } catch (error) {
    console.error('Error getting room participants:', error);
    return NextResponse.json(
      { error: 'Failed to get room participants' }, 
      { status: 500 }
    );
  }
} 