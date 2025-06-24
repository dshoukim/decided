#!/usr/bin/env npx tsx

import { EnhancedRottenTomatoesScraper, type RottenTomatoesData } from './enhanced-rt-scraper';
import { writeFileSync } from 'fs';

interface CLIOptions {
  command: string;
  movie?: string;
  year?: string;
  url?: string;
  output?: string;
  batch?: string;
  limit?: number;
  headless?: boolean;
  cache?: boolean;
  rateLimit?: number;
  verbose?: boolean;
  help?: boolean;
}

class RTScraperCLI {
  private parseArgs(): CLIOptions {
    const args = process.argv.slice(2);
    const options: CLIOptions = {
      command: args[0] || 'help',
      headless: !args.includes('--no-headless'),
      cache: !args.includes('--no-cache'),
      verbose: args.includes('--verbose') || args.includes('-v')
    };

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--movie':
        case '-m':
          options.movie = nextArg;
          i++;
          break;
        case '--year':
        case '-y':
          options.year = nextArg;
          i++;
          break;
        case '--url':
        case '-u':
          options.url = nextArg;
          i++;
          break;
        case '--output':
        case '-o':
          options.output = nextArg;
          i++;
          break;
        case '--limit':
        case '-l':
          options.limit = parseInt(nextArg) || 10;
          i++;
          break;
        case '--rate-limit':
          options.rateLimit = parseInt(nextArg) || 2000;
          i++;
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
      }
    }

    return options;
  }

  private showHelp(): void {
    console.log(`
🍅 Enhanced Rotten Tomatoes Scraper CLI

DESCRIPTION:
  A powerful tool for scraping Rotten Tomatoes data with advanced features:
  ✅ Score extraction (Tomato Meter + Audience Score)
  ✅ Review extraction (critic reviews with full details)
  ✅ Rate limiting for respectful scraping
  ✅ Intelligent caching system (24h duration)
  ✅ Error handling and retry logic
  ✅ Batch processing capabilities
  ✅ Progress tracking and statistics

COMMANDS:
  movie         Scrape a single movie by title and year
  url           Scrape a movie by direct Rotten Tomatoes URL
  demo          Run a demonstration with popular movies
  analyze       Analyze current RT HTML structure (for debugging)
  help          Show this help message

USAGE:
  npx tsx scripts/rt-scraper-cli.ts <command> [options]

MOVIE COMMAND:
  npx tsx scripts/rt-scraper-cli.ts movie --movie "The Dark Knight" --year 2008
  npx tsx scripts/rt-scraper-cli.ts movie -m "Oppenheimer" -y 2023 -o results.json

URL COMMAND:
  npx tsx scripts/rt-scraper-cli.ts url --url "https://www.rottentomatoes.com/m/the_dark_knight"
  npx tsx scripts/rt-scraper-cli.ts url -u "https://www.rottentomatoes.com/m/oppenheimer_2023" --verbose

DEMO COMMAND:
  npx tsx scripts/rt-scraper-cli.ts demo
  npx tsx scripts/rt-scraper-cli.ts demo --limit 5 --no-headless

OPTIONS:
  -m, --movie <title>     Movie title to search for
  -y, --year <year>       Release year (helps with URL generation)
  -u, --url <url>         Direct Rotten Tomatoes URL
  -o, --output <file>     Output JSON file (default: console only)
  -l, --limit <num>       Limit for demo mode (default: 3)
  --rate-limit <ms>       Delay between requests in ms (default: 2000)
  --no-headless           Run browser in visible mode (for debugging)
  --no-cache              Disable caching system
  -v, --verbose           Enable verbose logging
  -h, --help              Show this help message

EXAMPLES:
  # Scrape The Dark Knight with full output
  npx tsx scripts/rt-scraper-cli.ts movie -m "The Dark Knight" -y 2008 -o dark_knight.json --verbose

  # Quick demo of batch processing
  npx tsx scripts/rt-scraper-cli.ts demo --limit 3

  # Scrape by direct URL with visible browser
  npx tsx scripts/rt-scraper-cli.ts url -u "https://www.rottentomatoes.com/m/oppenheimer_2023" --no-headless

  # Analyze RT page structure (for development)
  npx tsx scripts/rt-scraper-cli.ts analyze

CACHING:
  Results are cached for 24 hours in ./rt-cache/ directory.
  Use --no-cache to disable caching for fresh data.

RATE LIMITING:
  Default 2-second delay between requests to be respectful.
  Adjust with --rate-limit flag (minimum 1000ms recommended).
    `);
  }

  private async scrapeMovie(options: CLIOptions): Promise<void> {
    if (!options.movie) {
      console.error('❌ Movie title is required. Use --movie "Movie Title"');
      process.exit(1);
    }

    console.log('🍅 Enhanced Rotten Tomatoes Movie Scraper');
    console.log('='.repeat(50));
    console.log(`🎬 Movie: ${options.movie}`);
    if (options.year) console.log(`📅 Year: ${options.year}`);
    console.log('='.repeat(50));

    const scraper = new EnhancedRottenTomatoesScraper({
      headless: options.headless!,
      rateLimitMs: options.rateLimit || 2000,
      enableCache: options.cache!,
      cacheDir: './rt-cache'
    });

    try {
      await scraper.init();
      
      const data = await scraper.scrapeMovie(options.movie, options.year);
      
      if (data) {
        console.log('\n✅ SCRAPING SUCCESSFUL');
        this.displayResults(data, options.verbose!);
        
        if (options.output) {
          this.saveResults(data, options.output);
        }
      } else {
        console.error('❌ Failed to scrape movie data');
        process.exit(1);
      }

    } finally {
      await scraper.close();
    }
  }

  private async scrapeUrl(options: CLIOptions): Promise<void> {
    if (!options.url) {
      console.error('❌ URL is required. Use --url "https://www.rottentomatoes.com/m/movie"');
      process.exit(1);
    }

    console.log('🍅 Enhanced Rotten Tomatoes URL Scraper');
    console.log('='.repeat(50));
    console.log(`🔗 URL: ${options.url}`);
    console.log('='.repeat(50));

    const scraper = new EnhancedRottenTomatoesScraper({
      headless: options.headless!,
      rateLimitMs: options.rateLimit || 2000,
      enableCache: options.cache!,
      cacheDir: './rt-cache'
    });

    try {
      await scraper.init();
      
      const data = await scraper.scrapeMovieByUrl(options.url);
      
      if (data) {
        console.log('\n✅ SCRAPING SUCCESSFUL');
        this.displayResults(data, options.verbose!);
        
        if (options.output) {
          this.saveResults(data, options.output);
        }
      } else {
        console.error('❌ Failed to scrape movie data');
        process.exit(1);
      }

    } finally {
      await scraper.close();
    }
  }

  private async runDemo(options: CLIOptions): Promise<void> {
    console.log('🍅 Running Enhanced Scraper Demo');
    console.log('='.repeat(50));
    
    // We'll just import and run the demo
    const { RTBatchDemo } = await import('./rt-batch-demo');
    const demo = new RTBatchDemo();
    
    // Use a subset for demo if limit is specified
    const demoFilms = [
      { id: 1, title: "The Dark Knight", year: "2008", expectedUrl: "https://www.rottentomatoes.com/m/the_dark_knight" },
      { id: 2, title: "Oppenheimer", year: "2023", expectedUrl: "https://www.rottentomatoes.com/m/oppenheimer_2023" },
      { id: 3, title: "Barbie", year: "2023", expectedUrl: "https://www.rottentomatoes.com/m/barbie" }
    ].slice(0, options.limit || 3);

    await demo.processBatch(demoFilms);
    demo.printSummary();
    
    if (options.output) {
      await demo.exportResults(options.output);
    }
  }

  private async analyzeStructure(): Promise<void> {
    console.log('🔍 Analyzing Current Rotten Tomatoes HTML Structure');
    console.log('='.repeat(50));
    console.log('This will open a browser and analyze the page structure...\n');
    
    // Import and run the analysis script
    await import('./quick-rt-analysis');
    console.log('✅ Analysis completed. Check the saved HTML file for detailed inspection.');
  }

  private displayResults(data: RottenTomatoesData, verbose: boolean): void {
    console.log('\n📊 RESULTS SUMMARY');
    console.log('='.repeat(30));
    console.log(`🍅 Tomato Meter: ${data.tomato_meter_score ?? 'N/A'}%`);
    console.log(`🍿 Audience Score: ${data.audience_score ?? 'N/A'}%`);
    console.log(`📝 Critic Reviews: ${data.critic_reviews.length}`);
    console.log(`💬 Audience Reviews: ${data.audience_reviews.length}`);
    console.log(`🔗 URL: ${data.url}`);
    console.log(`⏰ Scraped: ${new Date(data.scraped_at).toLocaleString()}`);

    if (verbose && data.critic_reviews.length > 0) {
      console.log('\n📋 SAMPLE REVIEWS:');
      console.log('-'.repeat(30));
      data.critic_reviews.slice(0, 3).forEach((review, index) => {
        console.log(`\n${index + 1}. ${review.reviewer} - ${review.publication}`);
        if (review.review_date) console.log(`   📅 ${review.review_date}`);
        if (review.review_text) console.log(`   💬 ${review.review_text.substring(0, 150)}...`);
        if (review.full_review_link) console.log(`   🔗 ${review.full_review_link}`);
        console.log(`   ⭐ Top Critic: ${review.top_critic ? 'Yes' : 'No'}`);
      });
    }
  }

  private saveResults(data: RottenTomatoesData, filename: string): void {
    try {
      writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);
      console.log(`📁 File size: ${(Buffer.byteLength(JSON.stringify(data), 'utf8') / 1024).toFixed(1)} KB`);
    } catch (error) {
      console.error(`❌ Error saving results: ${error}`);
    }
  }

  async run(): Promise<void> {
    const options = this.parseArgs();

    if (options.help || options.command === 'help') {
      this.showHelp();
      return;
    }

    try {
      switch (options.command) {
        case 'movie':
          await this.scrapeMovie(options);
          break;
        case 'url':
          await this.scrapeUrl(options);
          break;
        case 'demo':
          await this.runDemo(options);
          break;
        case 'analyze':
          await this.analyzeStructure();
          break;
        default:
          console.error(`❌ Unknown command: ${options.command}`);
          console.log('Use "help" command to see available options.');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ CLI Error:', error);
      process.exit(1);
    }
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new RTScraperCLI();
  cli.run().catch(console.error);
}

export { RTScraperCLI }; 