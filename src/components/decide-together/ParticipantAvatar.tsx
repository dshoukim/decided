'use client';

import { cn } from '@/lib/utils';
import { User, UserX } from 'lucide-react';

interface ParticipantAvatarProps {
  participant: {
    userId: string;
    userName?: string;
    avatarUrl?: string;
    isActive: boolean;
    isOwner?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export const ParticipantAvatar = ({ 
  participant, 
  size = 'md',
  showName = true,
  className 
}: ParticipantAvatarProps) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-lg',
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative">
        {/* Custom Avatar implementation */}
        <div className={cn(
          'rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden',
          sizeClasses[size],
          !participant.isActive && 'opacity-50'
        )}>
          {participant.avatarUrl ? (
            <img 
              src={participant.avatarUrl} 
              alt={participant.userName || 'Participant'}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-semibold text-gray-600 dark:text-gray-300">
              {participant.isActive ? (
                getInitials(participant.userName)
              ) : (
                <UserX className="h-4 w-4" />
              )}
            </span>
          )}
        </div>
        
        {/* Online/Offline indicator */}
        <span
          className={cn(
            'absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white',
            participant.isActive ? 'bg-green-500' : 'bg-gray-400'
          )}
        />
        
        {/* Owner badge */}
        {participant.isOwner && (
          <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs px-1 rounded">
            Host
          </span>
        )}
      </div>
      
      {showName && (
        <div className="flex flex-col">
          <span className={cn(
            'font-medium',
            !participant.isActive && 'text-gray-500 line-through'
          )}>
            {participant.userName || 'Anonymous'}
          </span>
          {!participant.isActive && (
            <span className="text-xs text-gray-500">Left room</span>
          )}
        </div>
      )}
    </div>
  );
}; 