interface PerformanceMetric {
  operation: string;
  duration: number;
  context: Record<string, any>;
  timestamp: string;
}

interface ErrorMetric {
  operation: string;
  error: string;
  stack?: string;
  context: Record<string, any>;
  timestamp: string;
}

export class TournamentMetrics {
  
  static async trackTournamentGeneration(
    roomId: string,
    participantCount: number,
    movieCount: number,
    generationTimeMs: number
  ): Promise<void> {
    // Track performance metric
    const metric: PerformanceMetric = {
      operation: 'tournament_generation',
      duration: generationTimeMs,
      context: {
        room_id: roomId,
        participant_count: participantCount,
        movie_count: movieCount,
      },
      timestamp: new Date().toISOString(),
    };
    
    // Log to structured logging
    console.log({
      event: 'tournament_generated',
      ...metric,
    });
    
    // TODO: Integrate with PostHog when available
    // await analytics.trackPerformance('tournament_generation', generationTimeMs, metric.context);
    
    // Track to local metrics storage (for now)
    this.storeMetric('performance', metric);
  }
  
  static async trackRoundCompletion(
    roomId: string,
    roundNumber: number,
    completionTimeMs: number,
    userResponseTimes: Record<string, number>
  ): Promise<void> {
    const avgResponseTime = Object.values(userResponseTimes).reduce((a, b) => a + b, 0) / Object.keys(userResponseTimes).length;
    
    const metric: PerformanceMetric = {
      operation: 'round_completion',
      duration: completionTimeMs,
      context: {
        room_id: roomId,
        round_number: roundNumber,
        avg_response_time_ms: avgResponseTime,
        user_response_times: userResponseTimes,
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log({
      event: 'tournament_round_completed',
      ...metric,
    });
    
    // TODO: Integrate with PostHog
    // await analytics.track(AnalyticsEvent.TOURNAMENT_ROUND_COMPLETED, metric.context);
    
    this.storeMetric('performance', metric);
  }
  
  static async trackError(
    operation: string,
    error: Error,
    context: Record<string, any>
  ): Promise<void> {
    const errorMetric: ErrorMetric = {
      operation,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };
    
    console.error({
      event: 'tournament_error',
      ...errorMetric,
    });
    
    // TODO: Integrate with PostHog error tracking
    // await analytics.trackError(error, { operation, ...context });
    
    this.storeMetric('error', errorMetric);
  }
  
  static async trackUserEvent(
    event: string,
    userId: string,
    context: Record<string, any>
  ): Promise<void> {
    const eventData = {
      event,
      user_id: userId,
      context,
      timestamp: new Date().toISOString(),
    };
    
    console.log({
      event_type: 'user_event',
      ...eventData,
    });
    
    this.storeMetric('user_event', eventData);
  }
  
  private static metricsStorage = new Map<string, any[]>();
  
  private static storeMetric(type: string, metric: any): void {
    if (!this.metricsStorage.has(type)) {
      this.metricsStorage.set(type, []);
    }
    
    const metrics = this.metricsStorage.get(type)!;
    metrics.push(metric);
    
    // Keep only last 1000 metrics of each type
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }
  
  static getMetrics(type?: string): any[] {
    if (type) {
      return this.metricsStorage.get(type) || [];
    }
    
    // Return all metrics
    const allMetrics: any[] = [];
    for (const [metricType, metrics] of this.metricsStorage.entries()) {
      allMetrics.push(...metrics.map(m => ({ type: metricType, ...m })));
    }
    
    return allMetrics.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  static getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [type, metrics] of this.metricsStorage.entries()) {
      summary[type] = {
        count: metrics.length,
        recent: metrics.slice(-10), // Last 10 events
      };
      
      if (type === 'performance') {
        const durations = metrics.map((m: PerformanceMetric) => m.duration);
        summary[type].avg_duration = durations.reduce((a, b) => a + b, 0) / durations.length;
        summary[type].max_duration = Math.max(...durations);
        summary[type].min_duration = Math.min(...durations);
      }
    }
    
    return summary;
  }
  
  // Performance monitoring helpers
  static async measureAsync<T>(
    operation: string,
    context: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      await this.trackTournamentGeneration(
        context.roomId || 'unknown',
        context.participantCount || 0,
        context.movieCount || 0,
        duration
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.trackError(operation, error as Error, { ...context, duration });
      throw error;
    }
  }
}

// Health check helpers
export class HealthChecker {
  private static checks = new Map<string, boolean>();
  
  static setCheck(name: string, status: boolean): void {
    this.checks.set(name, status);
  }
  
  static getChecks(): Record<string, boolean> {
    return Object.fromEntries(this.checks.entries());
  }
  
  static isHealthy(): boolean {
    return Array.from(this.checks.values()).every(status => status);
  }
} 