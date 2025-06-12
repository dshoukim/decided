export interface ErrorClassification {
  type: 'network' | 'validation' | 'permission' | 'server' | 'realtime';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export const classifyError = (error: any): ErrorClassification => {
  // Network errors
  if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR' || !navigator.onLine) {
    return {
      type: 'network',
      severity: 'medium',
      userMessage: 'Connection issue. Retrying automatically...',
      technicalMessage: error.message,
      recoverable: true,
      retryable: true,
      maxRetries: 3,
    };
  }
  
  // Realtime connection errors
  if (error.code === 'REALTIME_ERROR' || error.message?.includes('WebSocket') || error.message?.includes('channel')) {
    return {
      type: 'realtime',
      severity: 'high',
      userMessage: 'Lost connection to the room. Reconnecting...',
      technicalMessage: error.message,
      recoverable: true,
      retryable: true,
      maxRetries: 5,
    };
  }
  
  // Room not found
  if (error.status === 404 || error.code === 'ROOM_NOT_FOUND') {
    return {
      type: 'permission',
      severity: 'high',
      userMessage: 'This room does not exist or has ended',
      technicalMessage: error.message,
      recoverable: false,
      retryable: false,
    };
  }
  
  // Permission/Auth errors
  if (error.status === 403 || error.status === 401 || error.code === 'UNAUTHORIZED') {
    return {
      type: 'permission',
      severity: 'high',
      userMessage: 'You need to be signed in to join this room',
      technicalMessage: error.message,
      recoverable: false,
      retryable: false,
    };
  }
  
  // Room full error
  if (error.code === 'ROOM_FULL' || error.message?.includes('maximum participants')) {
    return {
      type: 'validation',
      severity: 'medium',
      userMessage: 'This room is already full (max 2 participants)',
      technicalMessage: error.message,
      recoverable: false,
      retryable: false,
    };
  }
  
  // Rate limiting
  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    return {
      type: 'server',
      severity: 'low',
      userMessage: 'Too many requests. Please wait a moment.',
      technicalMessage: error.message,
      recoverable: true,
      retryable: true,
      maxRetries: 2,
    };
  }
  
  // Default server error
  return {
    type: 'server',
    severity: 'medium',
    userMessage: 'Something went wrong. Please try again.',
    technicalMessage: error.message || 'Unknown error',
    recoverable: true,
    retryable: true,
    maxRetries: 2,
  };
};

// Exponential backoff retry logic
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  classification: ErrorClassification,
  attempt: number = 1
): Promise<T> => {
  const maxRetries = classification.maxRetries || 3;
  const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
  
  try {
    return await fn();
  } catch (error) {
    if (!classification.retryable || attempt >= maxRetries) {
      throw error; // Max retries exceeded or not retryable
    }
    
    // Wait with exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry
    return retryWithBackoff(fn, classification, attempt + 1);
  }
};

// User-friendly error messages for specific scenarios
export const getErrorTitle = (classification: ErrorClassification): string => {
  switch (classification.type) {
    case 'network':
      return 'Connection Issue';
    case 'realtime':
      return 'Lost Connection';
    case 'permission':
      return 'Access Denied';
    case 'validation':
      return 'Invalid Request';
    case 'server':
      return 'Server Error';
    default:
      return 'Error';
  }
};

// Get action button text based on error type
export const getErrorAction = (classification: ErrorClassification): { text: string; action: 'retry' | 'goBack' | 'signIn' | 'close' } | null => {
  if (classification.type === 'permission' && classification.userMessage.includes('signed in')) {
    return { text: 'Sign In', action: 'signIn' };
  }
  
  if (classification.recoverable && classification.retryable) {
    return { text: 'Try Again', action: 'retry' };
  }
  
  if (!classification.recoverable) {
    return { text: 'Go Back', action: 'goBack' };
  }
  
  return null;
}; 