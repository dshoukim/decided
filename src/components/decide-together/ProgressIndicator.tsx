'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
  showSteps?: boolean;
  className?: string;
}

export const ProgressIndicator = ({ 
  current, 
  total, 
  label = 'completed',
  showSteps = false,
  className 
}: ProgressIndicatorProps) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {current} of {total} {label}
        </span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {Math.round(percentage)}%
        </span>
      </div>
      
      <div className="relative">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {showSteps && (
          <div className="absolute top-0 left-0 w-full h-2.5 flex items-center justify-between px-1">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all duration-300',
                  i < current
                    ? 'bg-white scale-100'
                    : 'bg-gray-400 dark:bg-gray-600 scale-75'
                )}
              />
            ))}
          </div>
        )}
      </div>
      
      {percentage === 100 && (
        <div className="flex items-center gap-1 mt-2 text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Complete!</span>
        </div>
      )}
    </div>
  );
}; 