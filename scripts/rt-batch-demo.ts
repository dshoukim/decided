import { EnhancedRottenTomatoesScraper, type RottenTomatoesData } from './enhanced-rt-scraper';

interface DemoFilm {
  id: number;
  title: string;
  year: string;
  expectedUrl: string;
}

// Sample films for demonstration
const demoFilms: DemoFilm[] = [
  {
    id: 1,
    title: "The Dark Knight",
    year: "2008",
    expectedUrl: "https://www.rottentomatoes.com/m/the_dark_knight"
  },
  {
    id: 2,
    title: "Oppenheimer",
    year: "2023", 
    expectedUrl: "https://www.rottentomatoes.com/m/oppenheimer_2023"
  },
  {
    id: 3,
    title: "Inception",
    year: "2010",
    expectedUrl: "https://www.rottentomatoes.com/m/inception_2010"
  }
];

interface BatchDemoStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  cached: number;
  startTime: Date;
  endTime?: Date;
  results: Array<{ film: DemoFilm; data: RottenTomatoesData | null; success: boolean }>;
}

class RTBatchDemo {
  private scraper: EnhancedRottenTomatoesScraper;
  private stats: BatchDemoStats;

  constructor() {
    this.scraper = new EnhancedRottenTomatoesScraper({
      headless: true,
      rateLimitMs: 2000, // 2 second delay between requests
      retryAttempts: 2,
      enableCache: true,
      cacheDir: './rt-demo-cache'
    });

    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      cached: 0,
      startTime: new Date(),
      results: []
    };
  }

  async processBatch(films: DemoFilm[]): Promise<void> {
    this.stats.total = films.length;
    this.stats.startTime = new Date();

    console.log('🚀 Starting Rotten Tomatoes Batch Processing Demo');
    console.log('='.repeat(60));
    console.log(`📋 Processing ${films.length} films with enhanced features:`);
    console.log('   ✅ Rate limiting (2s between requests)');
    console.log('   ✅ Caching (24h cache duration)');
    console.log('   ✅ Retry logic (2 attempts per film)');
    console.log('   ✅ Review extraction (critic reviews)');
    console.log('='.repeat(60));

    await this.scraper.init();

    try {
      for (let i = 0; i < films.length; i++) {
        const film = films[i];
        console.log(`\n🎬 [${i + 1}/${films.length}] Processing: ${film.title} (${film.year})`);
        
        try {
          const data = await this.scraper.scrapeMovieByUrl(film.expectedUrl, film.id, film.title);
          
          if (data) {
            this.stats.successful++;
            console.log(`✅ Success: ${film.title}`);
            console.log(`   🍅 Tomato Meter: ${data.tomato_meter_score ?? 'N/A'}%`);
            console.log(`   🍿 Audience Score: ${data.audience_score ?? 'N/A'}%`);
            console.log(`   📝 Reviews: ${data.critic_reviews.length} critic reviews`);
            
            // Show sample review if available
            if (data.critic_reviews.length > 0) {
              const sample = data.critic_reviews[0];
              console.log(`   📋 Sample Review: "${sample.reviewer}" from ${sample.publication}`);
            }
            
            this.stats.results.push({ film, data, success: true });
          } else {
            this.stats.failed++;
            console.log(`❌ Failed: ${film.title}`);
            this.stats.results.push({ film, data: null, success: false });
          }
          
        } catch (error) {
          this.stats.failed++;
          console.error(`❌ Error processing ${film.title}:`, error);
          this.stats.results.push({ film, data: null, success: false });
        }
        
        this.stats.processed++;
        
        // Progress indicator
        const progressPercent = ((this.stats.processed / this.stats.total) * 100).toFixed(1);
        console.log(`⏰ Progress: ${this.stats.processed}/${this.stats.total} (${progressPercent}%)`);
      }

    } finally {
      await this.scraper.close();
      this.stats.endTime = new Date();
    }
  }

  printSummary(): void {
    const duration = this.stats.endTime 
      ? (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000
      : 0;

    console.log('\n' + '='.repeat(60));
    console.log('🏁 BATCH PROCESSING DEMO COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Total films: ${this.stats.total}`);
    console.log(`✅ Successful: ${this.stats.successful}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⏰ Duration: ${duration.toFixed(1)} seconds`);
    console.log(`🔄 Rate: ${(this.stats.processed / duration * 60).toFixed(1)} films/minute`);
    
    const scraperStats = this.scraper.getStats();
    console.log(`🌐 HTTP requests: ${scraperStats.requestCount}`);
    console.log(`💾 Cache directory: ${scraperStats.cacheDir}`);
    
    // Show detailed results
    console.log('\n📋 Detailed Results:');
    this.stats.results.forEach((result, index) => {
      const { film, data, success } = result;
      console.log(`  ${index + 1}. ${film.title} (${film.year}): ${success ? '✅' : '❌'}`);
      if (data) {
        console.log(`     RT Scores: ${data.tomato_meter_score ?? 'N/A'}% / ${data.audience_score ?? 'N/A'}%`);
        console.log(`     Reviews: ${data.critic_reviews.length} critic`);
      }
    });
    
    console.log('\n🎯 Features Demonstrated:');
    console.log('   ✅ Score extraction (Tomato Meter + Audience Score)');
    console.log('   ✅ Review extraction (critic reviews with author, publication, text)');
    console.log('   ✅ Rate limiting (respectful scraping)');
    console.log('   ✅ Caching system (avoid re-scraping)');
    console.log('   ✅ Error handling and retries');
    console.log('   ✅ Progress tracking and statistics');
    console.log('   ✅ Batch processing architecture');
    console.log('='.repeat(60));
  }

  async exportResults(filename: string = 'rt-demo-results.json'): Promise<void> {
    const exportData = {
      stats: this.stats,
      scraper_config: this.scraper.getStats().config,
      timestamp: new Date().toISOString(),
      results: this.stats.results.map(r => ({
        film: r.film,
        success: r.success,
        data: r.data ? {
          tomato_meter_score: r.data.tomato_meter_score,
          audience_score: r.data.audience_score,
          critic_reviews_count: r.data.critic_reviews.length,
          url: r.data.url,
          scraped_at: r.data.scraped_at
        } : null
      }))
    };

    const { writeFileSync } = await import('fs');
    writeFileSync(filename, JSON.stringify(exportData, null, 2));
    console.log(`💾 Results exported to: ${filename}`);
  }
}

async function main() {
  const demo = new RTBatchDemo();
  
  try {
    await demo.processBatch(demoFilms);
    demo.printSummary();
    await demo.exportResults();
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

main();

export { RTBatchDemo }; 