import 'dotenv/config';
import { db } from '../src/db';
import { films } from '../src/db/schema';
import { eq, sql, and, isNull, isNotNull } from 'drizzle-orm';
import { EnhancedRottenTomatoesScraper, type RottenTomatoesData } from './enhanced-rt-scraper';

interface BatchProcessingConfig {
  batchSize: number;
  delayBetweenBatches: number;
  maxRetries: number;
  skipCached: boolean;
  testMode: boolean;
  limitToCount?: number;
}

interface ProcessingStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  cached: number;
  startTime: Date;
  endTime?: Date;
}

class RTDatabaseIntegration {
  private scraper: EnhancedRottenTomatoesScraper;
  private config: BatchProcessingConfig;
  private stats: ProcessingStats;

  constructor(config: Partial<BatchProcessingConfig> = {}) {
    this.config = {
      batchSize: 5,
      delayBetweenBatches: 30000, // 30 seconds between batches
      maxRetries: 3,
      skipCached: true,
      testMode: false,
      ...config
    };

    this.scraper = new EnhancedRottenTomatoesScraper({
      headless: true,
      rateLimitMs: 3000, // Be more respectful for batch processing
      retryAttempts: this.config.maxRetries,
      enableCache: true,
      cacheDir: './rt-cache-batch'
    });

    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      cached: 0,
      startTime: new Date()
    };
  }

  // Get films that need RT data
  async getFilmsToProcess(): Promise<Array<{ id: number; tmdbId: number; title: string; releaseDate: string | null }>> {
    try {
      console.log('🔍 Querying database for films to process...');
      
      const query = db
        .select({
          id: films.id,
          tmdbId: films.tmdbId,
          title: films.title,
          releaseDate: films.releaseDate
        })
        .from(films)
        .where(
          and(
            isNotNull(films.tmdbId),
            isNotNull(films.title),
            isNotNull(films.releaseDate)
          )
        )
        .orderBy(sql`RANDOM()`) // Random order to avoid patterns
        .limit(this.config.limitToCount || 100);

      const result = await query;
      
      console.log(`📊 Found ${result.length} films in database`);
      return result;

    } catch (error) {
      console.error('❌ Error querying database:', error);
      throw error;
    }
  }

  // Generate Rotten Tomatoes URL from film data
  private generateRTUrl(title: string, releaseDate: string | null): string {
    let year = '';
    if (releaseDate) {
      year = new Date(releaseDate).getFullYear().toString();
    }

    // Clean and format title for RT URL
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    return `https://www.rottentomatoes.com/m/${slug}${year ? `_${year}` : ''}`;
  }

  // Store RT data in the database (you can extend the schema to include RT data)
  private async storeRTData(filmId: number, rtData: RottenTomatoesData): Promise<void> {
    try {
      // For now, we'll just log the data. In a real implementation, you'd want to:
      // 1. Create a new table for RT data
      // 2. Or add RT fields to the films table
      // 3. Store the review data in a separate reviews table

      console.log(`💾 Storing RT data for film ${filmId}:`);
      console.log(`   Tomato Meter: ${rtData.tomato_meter_score}%`);
      console.log(`   Audience Score: ${rtData.audience_score}%`);
      console.log(`   Reviews: ${rtData.critic_reviews.length} critic, ${rtData.audience_reviews.length} audience`);
      
      // Example: Update films table with RT scores (you'd need to add these columns)
      // await db
      //   .update(films)
      //   .set({
      //     rottenTomatoesScore: rtData.tomato_meter_score,
      //     audienceScore: rtData.audience_score,
      //     lastRTUpdate: new Date()
      //   })
      //   .where(eq(films.id, filmId));

      if (this.config.testMode) {
        console.log('🧪 Test mode: Not actually storing in database');
      }

    } catch (error) {
      console.error(`❌ Error storing RT data for film ${filmId}:`, error);
      throw error;
    }
  }

  // Process a single film
  private async processFilm(film: { id: number; tmdbId: number; title: string; releaseDate: string | null }): Promise<boolean> {
    try {
      console.log(`\n🎬 Processing: ${film.title} (${film.releaseDate?.substring(0, 4) || 'Unknown year'})`);
      
      const rtUrl = this.generateRTUrl(film.title, film.releaseDate);
      console.log(`🔗 RT URL: ${rtUrl}`);

      const rtData = await this.scraper.scrapeMovieByUrl(rtUrl, film.tmdbId, film.title);
      
      if (rtData) {
        await this.storeRTData(film.id, rtData);
        this.stats.successful++;
        console.log(`✅ Successfully processed ${film.title}`);
        return true;
      } else {
        console.log(`❌ Failed to scrape data for ${film.title}`);
        this.stats.failed++;
        return false;
      }

    } catch (error) {
      console.error(`❌ Error processing film ${film.title}:`, error);
      this.stats.failed++;
      return false;
    }
  }

  // Process films in batches
  async processBatch(films: Array<{ id: number; tmdbId: number; title: string; releaseDate: string | null }>): Promise<void> {
    this.stats.total = films.length;
    this.stats.startTime = new Date();

    console.log(`🚀 Starting batch processing of ${films.length} films`);
    console.log(`📋 Config: ${this.config.batchSize} films per batch, ${this.config.delayBetweenBatches/1000}s delay`);
    
    await this.scraper.init();

    try {
      for (let i = 0; i < films.length; i += this.config.batchSize) {
        const batch = films.slice(i, i + this.config.batchSize);
        const batchNumber = Math.floor(i / this.config.batchSize) + 1;
        const totalBatches = Math.ceil(films.length / this.config.batchSize);

        console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} films)`);
        console.log(`⏰ Progress: ${this.stats.processed}/${this.stats.total} films processed`);

        // Process films in the current batch sequentially
        for (const film of batch) {
          await this.processFilm(film);
          this.stats.processed++;
          
          // Small delay between individual films
          if (batch.indexOf(film) < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Delay between batches (except for the last batch)
        if (i + this.config.batchSize < films.length) {
          console.log(`⏳ Waiting ${this.config.delayBetweenBatches/1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
        }
      }

    } finally {
      await this.scraper.close();
      this.stats.endTime = new Date();
    }
  }

  // Get processing statistics
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  // Print final report
  printReport(): void {
    const duration = this.stats.endTime 
      ? (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000 / 60
      : 0;

    console.log('\n' + '='.repeat(50));
    console.log('🏁 BATCH PROCESSING COMPLETE');
    console.log('='.repeat(50));
    console.log(`📊 Total films: ${this.stats.total}`);
    console.log(`✅ Successful: ${this.stats.successful}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`📦 Cached: ${this.stats.cached}`);
    console.log(`⏰ Duration: ${duration.toFixed(1)} minutes`);
    console.log(`🔄 Rate: ${(this.stats.processed / duration).toFixed(1)} films/minute`);
    
    const scraperStats = this.scraper.getStats();
    console.log(`🌐 HTTP requests: ${scraperStats.requestCount}`);
    console.log(`💾 Cache directory: ${scraperStats.cacheDir}`);
    console.log('='.repeat(50));
  }
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  
  const config: Partial<BatchProcessingConfig> = {
    testMode: args.includes('--test'),
    limitToCount: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 10 : undefined,
    batchSize: args.includes('--batch-size') ? parseInt(args[args.indexOf('--batch-size') + 1]) || 5 : 5
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🍅 Rotten Tomatoes Database Integration

Usage:
  npx tsx scripts/rt-database-integration.ts [options]

Options:
  --test                Run in test mode (don't store to database)
  --limit N             Process only N films (default: 100)
  --batch-size N        Films per batch (default: 5)
  --help, -h            Show this help

Examples:
  npx tsx scripts/rt-database-integration.ts --test --limit 3
  npx tsx scripts/rt-database-integration.ts --batch-size 10 --limit 50
    `);
    process.exit(0);
  }

  try {
    console.log('🍅 Rotten Tomatoes Database Integration');
    console.log('='.repeat(50));
    
    if (config.testMode) {
      console.log('🧪 Running in TEST MODE - no database changes will be made');
    }

    const integration = new RTDatabaseIntegration(config);
    
    // Get films to process
    const films = await integration.getFilmsToProcess();
    
    if (films.length === 0) {
      console.log('📝 No films found to process');
      process.exit(0);
    }

    // Process the films
    await integration.processBatch(films);
    
    // Print final report
    integration.printReport();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RTDatabaseIntegration }; 