#!/usr/bin/env npx tsx

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

// Types for our scraped data
interface CriticReview {
  reviewer: string;
  publication: string;
  top_critic: boolean;
  original_score: string;
  review_date: string;
  review_text: string;
  full_review_link: string;
}

interface AudienceReview {
  user: string;
  rating: string;
  date: string;
  verified_audience: boolean;
  review_text: string;
}

interface RottenTomatoesData {
  tomato_meter_score: number | null;
  audience_score: number | null;
  critic_reviews: CriticReview[];
  audience_reviews: AudienceReview[];
}

class RottenTomatoesScraper {
  private browser: any = null;
  private page: any = null;

  async init(headless: boolean = true) {
    this.browser = await chromium.launch({ 
      headless, 
      slowMo: headless ? 500 : 1000
    });
    
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    
    this.page = await context.newPage();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Convert movie title to Rotten Tomatoes URL format
  private titleToSlug(title: string, year?: string): string {
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    if (year) {
      slug += `_${year}`;
    }
    
    return slug;
  }

  // Get Rotten Tomatoes scores from main movie page
  private async getScores(movieUrl: string): Promise<{ tomatoMeter: number | null, audienceScore: number | null }> {
    try {
      console.log(`🔍 Navigating to: ${movieUrl}`);
      await this.page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      console.log(`🔍 Page title: ${$('title').text()}`);

      // Extract scores using text pattern matching from the visible content
      let tomatoMeter: number | null = null;
      let audienceScore: number | null = null;

      // Try to extract tomato meter score (critics score)
      const tomatoMeterMatches = content.match(/(\d+)%\s*(?:\n\s*)?Tomatometer/i);
      if (tomatoMeterMatches) {
        tomatoMeter = parseInt(tomatoMeterMatches[1]);
        console.log(`🔍 Extracted tomato meter from text pattern: ${tomatoMeter}%`);
      }

      // Try to extract audience score (popcorn meter)
      const audienceScoreMatches = content.match(/(\d+)%\s*(?:\n\s*)?Popcornmeter/i);
      if (audienceScoreMatches) {
        audienceScore = parseInt(audienceScoreMatches[1]);
        console.log(`🔍 Extracted audience score from text pattern: ${audienceScore}%`);
      }

      // Also try JSON-based extraction as fallback
      if (tomatoMeter === null || audienceScore === null) {
        const scorePattern = /"score":"(\d+)"/g;
        let match;
        const scores = [];
        while ((match = scorePattern.exec(content)) !== null) {
          scores.push(parseInt(match[1]));
        }
        
        if (scores.length >= 2) {
          if (tomatoMeter === null) tomatoMeter = scores[0];
          if (audienceScore === null) audienceScore = scores[1];
          console.log(`🔍 Extracted scores from JSON pattern: tomato=${tomatoMeter}%, audience=${audienceScore}%`);
        }
      }

      console.log(`📊 Final scores - Tomato Meter: ${tomatoMeter}%, Audience: ${audienceScore}%`);
      return { tomatoMeter, audienceScore };

    } catch (error) {
      console.error('❌ Error getting scores:', error);
      return { tomatoMeter: null, audienceScore: null };
    }
  }

  // Scrape by movie title and year
  async scrapeMovie(title: string, year?: string): Promise<RottenTomatoesData> {
    const slug = this.titleToSlug(title, year);
    const movieUrl = `https://www.rottentomatoes.com/m/${slug}`;
    return this.scrapeMovieByUrl(movieUrl);
  }

  // Scrape by direct URL
  async scrapeMovieByUrl(movieUrl: string): Promise<RottenTomatoesData> {
    console.log(`\n🍅 Scraping Rotten Tomatoes data from: ${movieUrl}`);
    
    // Get scores from main page
    const { tomatoMeter, audienceScore } = await this.getScores(movieUrl);

    const result: RottenTomatoesData = {
      tomato_meter_score: tomatoMeter,
      audience_score: audienceScore,
      critic_reviews: [], // Reviews require more complex extraction
      audience_reviews: []
    };

    console.log(`\n✅ Scraping completed`);
    console.log(`📊 Tomato Meter: ${tomatoMeter}% | Audience: ${audienceScore}%`);

    return result;
  }
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🍅 Rotten Tomatoes Scraper CLI

Usage:
  npx tsx scripts/scrape-rt-cli.ts "Movie Title" [year]
  npx tsx scripts/scrape-rt-cli.ts --url "https://www.rottentomatoes.com/m/movie_slug"

Examples:
  npx tsx scripts/scrape-rt-cli.ts "The Dark Knight" 2008
  npx tsx scripts/scrape-rt-cli.ts "Oppenheimer" 2023
  npx tsx scripts/scrape-rt-cli.ts --url "https://www.rottentomatoes.com/m/the_dark_knight"

Features:
  ✅ Extracts Tomato Meter score (critics)
  ✅ Extracts Audience score
  ✅ Works with both title search and direct URLs
  ⚠️  Review extraction is currently disabled (site structure changes)
    `);
    process.exit(0);
  }

  try {
    const scraper = new RottenTomatoesScraper();
    await scraper.init(true); // Headless mode

    let data: RottenTomatoesData;

    if (args[0] === '--url') {
      if (!args[1]) {
        console.error('❌ URL is required when using --url flag');
        process.exit(1);
      }
      data = await scraper.scrapeMovieByUrl(args[1]);
    } else {
      const title = args[0];
      const year = args[1];
      console.log(`🎬 Searching for: ${title}${year ? ` (${year})` : ''}`);
      data = await scraper.scrapeMovie(title, year);
    }

    await scraper.close();

    // Display results
    console.log('\n📈 FINAL RESULTS:');
    console.log('====================');
    console.log(`🍅 Tomato Meter: ${data.tomato_meter_score ?? 'N/A'}%`);
    console.log(`🍿 Audience Score: ${data.audience_score ?? 'N/A'}%`);
    console.log(`📝 Critic Reviews: ${data.critic_reviews.length}`);
    console.log(`💬 Audience Reviews: ${data.audience_reviews.length}`);
    
    // Output JSON for programmatic use
    console.log('\n📊 JSON Output:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RottenTomatoesScraper, type RottenTomatoesData, type CriticReview, type AudienceReview }; 