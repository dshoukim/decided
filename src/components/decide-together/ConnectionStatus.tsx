'use client';

import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  className?: string;
}

export const ConnectionStatus = ({ status, className }: ConnectionStatusProps) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          pulseColor: 'bg-green-400',
          text: 'Connected',
          shouldPulse: false,
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          pulseColor: 'bg-yellow-400',
          text: 'Connecting...',
          shouldPulse: true,
        };
      case 'disconnected':
        return {
          color: 'bg-gray-500',
          pulseColor: 'bg-gray-400',
          text: 'Disconnected',
          shouldPulse: false,
        };
      case 'error':
        return {
          color: 'bg-red-500',
          pulseColor: 'bg-red-400',
          text: 'Connection Error',
          shouldPulse: false,
        };
    }
  };

  const { color, pulseColor, text, shouldPulse } = getStatusInfo();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex h-3 w-3">
        {shouldPulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              pulseColor
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-3 w-3',
            color
          )}
        />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {text}
      </span>
    </div>
  );
}; 