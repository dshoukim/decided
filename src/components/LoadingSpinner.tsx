interface LoadingSpinnerProps {
  message?: string
  size?: 'small' | 'medium' | 'large'
}

export default function LoadingSpinner({ 
  message = "Loading...", 
  size = 'medium' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-16 h-16',
    large: 'w-24 h-24'
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* Movie reel animation */}
      <div className="relative">
        <div className={`${sizeClasses[size]} border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl animate-pulse">🎬</span>
        </div>
      </div>
      
      {message && (
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 animate-pulse">
            {message}
          </p>
          <div className="flex justify-center space-x-1 mt-2">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      )}
    </div>
  )
} 