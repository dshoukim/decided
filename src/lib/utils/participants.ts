export interface ApiParticipant {
  userId: string;
  joinedAt: string;
  leftAt?: string | null;
  isActive?: boolean;
  user?: {
    name?: string;
    username?: string;
    avatarUrl?: string | null;
  };
}

export interface StoreParticipant {
  userId: string;
  userName?: string;
  avatarUrl?: string;
  joinedAt: string;
  isActive: boolean;
}

export function mapApiParticipantsToStore(participants: ApiParticipant[] = []): StoreParticipant[] {
  return participants.map((p) => ({
    userId: p.userId,
    userName: p.user?.name || p.user?.username || 'Anonymous',
    avatarUrl: p.user?.avatarUrl || undefined,
    joinedAt: p.joinedAt,
    isActive: p.leftAt === null || p.isActive !== false,
  }));
} 