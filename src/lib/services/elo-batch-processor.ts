import { db } from '@/db'
import { userMovieElo, bracketPicks } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { updateElo, calculateKFactor } from '@/lib/elo'
import { TournamentMetrics } from '@/lib/monitoring/tournament-metrics'

interface EloBatchUpdate {
  userId: string;
  movieId: number;
  newRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

interface EloProcessingJob {
  id: string;
  roomId: string;
  userId: string;
  picks: Array<{
    movieAId: number;
    movieBId: number;
    selectedMovieId: number;
    responseTimeMs?: number;
  }>;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
}

export class EloBatchProcessor {
  private static processingQueue: EloProcessingJob[] = [];
  private static isProcessing = false;
  private static processingIntervalId: NodeJS.Timeout | null = null;

  static startProcessor(intervalMs: number = 5000): void {
    if (this.processingIntervalId) {
      this.stopProcessor();
    }

    this.processingIntervalId = setInterval(async () => {
      await this.processQueue();
    }, intervalMs);

    console.log('ELO batch processor started');
  }

  static stopProcessor(): void {
    if (this.processingIntervalId) {
      clearInterval(this.processingIntervalId);
      this.processingIntervalId = null;
    }
    console.log('ELO batch processor stopped');
  }

  static addJob(job: Omit<EloProcessingJob, 'id' | 'createdAt'>): void {
    const fullJob: EloProcessingJob = {
      ...job,
      id: `elo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    // Insert based on priority (high priority first)
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const insertIndex = this.processingQueue.findIndex(
      queuedJob => priorityOrder[queuedJob.priority] > priorityOrder[fullJob.priority]
    );

    if (insertIndex === -1) {
      this.processingQueue.push(fullJob);
    } else {
      this.processingQueue.splice(insertIndex, 0, fullJob);
    }

    console.log(`Added ELO job ${fullJob.id} with priority ${fullJob.priority}. Queue size: ${this.processingQueue.length}`);
  }

  static async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      const batchSize = Math.min(10, this.processingQueue.length); // Process up to 10 jobs at once
      const jobsToProcess = this.processingQueue.splice(0, batchSize);

      console.log(`Processing ${jobsToProcess.length} ELO jobs`);

      for (const job of jobsToProcess) {
        try {
          await this.processJob(job);
        } catch (error) {
          console.error(`Failed to process ELO job ${job.id}:`, error);
          await TournamentMetrics.trackError('elo_batch_processing', error as Error, {
            job_id: job.id,
            user_id: job.userId,
            room_id: job.roomId,
          });
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`Processed ${jobsToProcess.length} ELO jobs in ${processingTime}ms`);

    } catch (error) {
      console.error('Error in ELO batch processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private static async processJob(job: EloProcessingJob): Promise<void> {
    const updates: EloBatchUpdate[] = [];

    // Get current ELO ratings for all movies involved
    const movieIds = new Set<number>();
    job.picks.forEach(pick => {
      movieIds.add(pick.movieAId);
      movieIds.add(pick.movieBId);
    });

    const currentRatings = await db
      .select()
      .from(userMovieElo)
      .where(
        and(
          eq(userMovieElo.userId, job.userId),
          sql`${userMovieElo.movieId} = ANY(${Array.from(movieIds)})`
        )
      );

    const ratingMap = new Map(
      currentRatings.map(rating => [rating.movieId, rating])
    );

    // Process each pick
    for (const pick of job.picks) {
      const movieARating = ratingMap.get(pick.movieAId);
      const movieBRating = ratingMap.get(pick.movieBId);

      const ratingA = movieARating?.eloRating || 1200;
      const ratingB = movieBRating?.eloRating || 1200;

      const result = pick.selectedMovieId === pick.movieAId ? 1 : 0;
      const eloUpdates = updateElo(job.userId, pick.movieAId, pick.movieBId, ratingA, ratingB);

      // Convert to batch updates
      eloUpdates.forEach(update => {
        const currentStats = ratingMap.get(update.movieId);
        updates.push({
          userId: update.userId,
          movieId: update.movieId,
          newRating: update.newRating,
          matchesPlayed: (currentStats?.matchesPlayed || 0) + 1,
          wins: (currentStats?.wins || 0) + (update.won ? 1 : 0),
          losses: (currentStats?.losses || 0) + (update.won ? 0 : 1),
        });

        // Update our local map for subsequent calculations
        ratingMap.set(update.movieId, {
          userId: update.userId,
          movieId: update.movieId,
          eloRating: update.newRating,
          matchesPlayed: (currentStats?.matchesPlayed || 0) + 1,
          wins: (currentStats?.wins || 0) + (update.won ? 1 : 0),
          losses: (currentStats?.losses || 0) + (update.won ? 0 : 1),
          lastUpdated: new Date(),
          createdAt: currentStats?.createdAt || new Date(),
          id: currentStats?.id || crypto.randomUUID(),
        });
      });
    }

    // Batch update to database
    if (updates.length > 0) {
      await this.batchUpdateEloRatings(updates);
    }
  }

  private static async batchUpdateEloRatings(updates: EloBatchUpdate[]): Promise<void> {
    // Group updates by movie to avoid conflicts
    const updateMap = new Map<string, EloBatchUpdate>();
    
    updates.forEach(update => {
      const key = `${update.userId}-${update.movieId}`;
      // Take the latest update for each user-movie combination
      updateMap.set(key, update);
    });

    const finalUpdates = Array.from(updateMap.values());

    for (const update of finalUpdates) {
      await db.insert(userMovieElo)
        .values({
          userId: update.userId,
          movieId: update.movieId,
          eloRating: update.newRating,
          matchesPlayed: update.matchesPlayed,
          wins: update.wins,
          losses: update.losses,
          lastUpdated: new Date(),
        })
        .onConflictDoUpdate({
          target: [userMovieElo.userId, userMovieElo.movieId],
          set: {
            eloRating: update.newRating,
            matchesPlayed: update.matchesPlayed,
            wins: update.wins,
            losses: update.losses,
            lastUpdated: new Date(),
          },
        });
    }
  }

  static getQueueSize(): number {
    return this.processingQueue.length;
  }

  static isRunning(): boolean {
    return this.processingIntervalId !== null;
  }

  static getQueueStatus(): {
    size: number;
    isProcessing: boolean;
    isRunning: boolean;
    highPriorityJobs: number;
    normalPriorityJobs: number;
    lowPriorityJobs: number;
  } {
    const stats = {
      size: this.processingQueue.length,
      isProcessing: this.isProcessing,
      isRunning: this.isRunning(),
      highPriorityJobs: 0,
      normalPriorityJobs: 0,
      lowPriorityJobs: 0,
    };

    this.processingQueue.forEach(job => {
      stats[`${job.priority}PriorityJobs`]++;
    });

    return stats;
  }

  // Helper method for immediate ELO processing (bypasses queue)
  static async processImmediateEloUpdate(
    userId: string,
    movieAId: number,
    movieBId: number,
    selectedMovieId: number
  ): Promise<void> {
    const job: EloProcessingJob = {
      id: `immediate-${Date.now()}`,
      roomId: 'immediate',
      userId,
      picks: [{
        movieAId,
        movieBId,
        selectedMovieId,
      }],
      priority: 'high',
      createdAt: new Date(),
    };

    await this.processJob(job);
  }
}

// Auto-start the processor if in production
if (process.env.NODE_ENV === 'production') {
  EloBatchProcessor.startProcessor();
} 