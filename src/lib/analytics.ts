import posthog from 'posthog-js';

export enum AnalyticsEvent {
  // Room events
  ROOM_CREATED = 'room_created',
  ROOM_JOINED = 'room_joined',
  ROOM_STARTED = 'room_started',
  ROOM_COMPLETED = 'room_completed',
  ROOM_ABANDONED = 'room_abandoned',
  ROOM_AUTO_CLOSED = 'room_auto_closed',
  
  // Tournament events
  BRACKET_PICK_MADE = 'bracket_pick_made',
  TOURNAMENT_COMPLETED = 'tournament_completed',
  FINAL_FACEOFF_STARTED = 'final_faceoff_started',
  
  // Movie events
  MOVIE_ADDED_TO_WATCHLIST = 'movie_added_to_watchlist',
  MOVIE_RATED = 'movie_rated',
  DECIDED_TOGETHER_WATCHED = 'decided_together_watched',
  RATING_SKIPPED = 'rating_skipped',
  
  // Error events
  ERROR_OCCURRED = 'error_occurred',
  API_ERROR = 'api_error',
  REALTIME_ERROR = 'realtime_error',
}

interface BaseEventProperties {
  timestamp: string;
  session_id?: string;
}

interface RoomEventProperties extends BaseEventProperties {
  room_id: string;
  room_code: string;
  participant_count?: number;
  duration_seconds?: number;
  is_owner?: boolean;
}

interface BracketEventProperties extends BaseEventProperties {
  room_id: string;
  round_number: number;
  response_time_ms: number;
  movie_a_id: number;
  movie_b_id: number;
  selected_movie_id: number;
  movies_remaining?: number;
}

interface ErrorEventProperties extends BaseEventProperties {
  error_message: string;
  error_stack?: string;
  error_type: string;
  context?: Record<string, any>;
}

class Analytics {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY !== undefined;
  }

  track<T extends Record<string, any>>(event: AnalyticsEvent, properties?: T): void {
    if (!this.isEnabled) return;

    const enrichedProperties = {
      ...properties,
      timestamp: new Date().toISOString(),
      session_id: this.getSessionId(),
    };

    posthog.capture(event, enrichedProperties);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, enrichedProperties);
    }
  }

  trackRoomEvent(event: AnalyticsEvent, properties: Omit<RoomEventProperties, keyof BaseEventProperties>): void {
    this.track(event, properties);
  }

  trackBracketPick(properties: Omit<BracketEventProperties, keyof BaseEventProperties>): void {
    this.track(AnalyticsEvent.BRACKET_PICK_MADE, properties);
  }

  trackError(error: Error, context?: Record<string, any>): void {
    const properties: ErrorEventProperties = {
      error_message: error.message,
      error_stack: error.stack,
      error_type: error.name,
      context,
      timestamp: new Date().toISOString(),
    };

    this.track(AnalyticsEvent.ERROR_OCCURRED, properties);
  }

  trackPerformance(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    posthog.capture('performance_metric', {
      metric_name: metric,
      value,
      unit: 'milliseconds',
      ...tags,
      timestamp: new Date().toISOString(),
    });
  }

  startTimer(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.trackPerformance(label, duration);
    };
  }

  getFeatureFlag(flag: string): boolean | string | undefined {
    if (!this.isEnabled) return undefined;
    return posthog.getFeatureFlag(flag);
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return 'server-session';
    
    // Get or create session ID
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }
}

export const analytics = new Analytics(); 