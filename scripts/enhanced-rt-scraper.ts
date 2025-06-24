import 'dotenv/config';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { db } from '../src/db';
import { films } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  tmdb_id?: number;
  title?: string;
  url: string;
  tomato_meter_score: number | null;
  audience_score: number | null;
  critic_reviews: CriticReview[];
  audience_reviews: AudienceReview[];
  scraped_at: string;
}

interface ScrapingConfig {
  headless: boolean;
  rateLimitMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  enableCache: boolean;
  cacheDir: string;
  maxConcurrent: number;
}

class EnhancedRottenTomatoesScraper {
  private browser: any = null;
  private page: any = null;
  private config: ScrapingConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: Partial<ScrapingConfig> = {}) {
    this.config = {
      headless: true,
      rateLimitMs: 2000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      enableCache: true,
      cacheDir: './rt-cache',
      maxConcurrent: 3,
      ...config
    };

    // Create cache directory
    if (this.config.enableCache && !existsSync(this.config.cacheDir)) {
      mkdirSync(this.config.cacheDir, { recursive: true });
    }
  }

  async init() {
    this.browser = await chromium.launch({ 
      headless: this.config.headless,
      slowMo: this.config.headless ? 300 : 800
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

  // Rate limiting
  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.config.rateLimitMs) {
      const waitTime = this.config.rateLimitMs - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  // Cache management
  private getCacheKey(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  }

  private getCachedData(url: string): RottenTomatoesData | null {
    if (!this.config.enableCache) return null;
    
    const cacheFile = join(this.config.cacheDir, this.getCacheKey(url));
    if (!existsSync(cacheFile)) return null;
    
    try {
      const data = JSON.parse(readFileSync(cacheFile, 'utf8'));
      const ageHours = (Date.now() - new Date(data.scraped_at).getTime()) / (1000 * 60 * 60);
      
      // Cache for 24 hours
      if (ageHours < 24) {
        console.log(`📦 Using cached data for ${url} (${ageHours.toFixed(1)}h old)`);
        return data;
      }
    } catch (error) {
      console.warn(`⚠️ Error reading cache for ${url}:`, error);
    }
    
    return null;
  }

  private setCachedData(url: string, data: RottenTomatoesData) {
    if (!this.config.enableCache) return;
    
    const cacheFile = join(this.config.cacheDir, this.getCacheKey(url));
    try {
      writeFileSync(cacheFile, JSON.stringify(data, null, 2));
      console.log(`💾 Cached data for ${url}`);
    } catch (error) {
      console.warn(`⚠️ Error writing cache for ${url}:`, error);
    }
  }

  // Convert movie title to Rotten Tomatoes URL format
  private titleToSlug(title: string, year?: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    // RT only adds years for disambiguation, not by default
    // We'll try without year first, then with year if it fails
    return slug;
  }

  // Try multiple URL variations for a movie
  private generateUrlVariations(title: string, year?: string): string[] {
    const baseSlug = this.titleToSlug(title);
    const urls = [`https://www.rottentomatoes.com/m/${baseSlug}`];
    
    // Add year variation if year is provided (for disambiguation cases)
    if (year) {
      urls.push(`https://www.rottentomatoes.com/m/${baseSlug}_${year}`);
    }
    
    return urls;
  }

  // Get Rotten Tomatoes scores from main movie page
  private async getScores(movieUrl: string): Promise<{ tomatoMeter: number | null, audienceScore: number | null }> {
    try {
      console.log(`🔍 Getting scores from: ${movieUrl}`);
      
      await this.waitForRateLimit();
      await this.page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      console.log(`🔍 Page title: ${$('title').text().split('|')[0].trim()}`);

      // Extract scores using multiple methods
      let tomatoMeter: number | null = null;
      let audienceScore: number | null = null;

      // Method 1: Text pattern matching
      const tomatoMeterMatches = content.match(/(\d+)%\s*(?:\n\s*)?Tomatometer/i);
      if (tomatoMeterMatches) {
        tomatoMeter = parseInt(tomatoMeterMatches[1]);
        console.log(`✅ Tomato meter from text pattern: ${tomatoMeter}%`);
      }

      const audienceScoreMatches = content.match(/(\d+)%\s*(?:\n\s*)?Popcornmeter/i);
      if (audienceScoreMatches) {
        audienceScore = parseInt(audienceScoreMatches[1]);
        console.log(`✅ Audience score from text pattern: ${audienceScore}%`);
      }

      // Method 2: JSON-based extraction
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
          console.log(`✅ Scores from JSON pattern: tomato=${tomatoMeter}%, audience=${audienceScore}%`);
        }
      }

      console.log(`📊 Final scores - Tomato Meter: ${tomatoMeter}%, Audience: ${audienceScore}%`);
      return { tomatoMeter, audienceScore };

    } catch (error) {
      console.error('❌ Error getting scores:', error);
      return { tomatoMeter: null, audienceScore: null };
    }
  }

  // Enhanced critic reviews extraction based on our analysis
  private async getCriticReviews(reviewsUrl: string, isTopCritics: boolean = false): Promise<CriticReview[]> {
    try {
      const url = isTopCritics ? `${reviewsUrl}?type=top_critics` : reviewsUrl;
      console.log(`🔍 Getting ${isTopCritics ? 'top critic' : 'critic'} reviews from: ${url}`);
      
      await this.waitForRateLimit();
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      const reviews: CriticReview[] = [];

      // Use the working selector from our analysis
      const reviewElements = $('[data-qa="review-item"]');
      console.log(`🔍 Found ${reviewElements.length} review elements`);

      reviewElements.each((index, element) => {
        try {
          const reviewEl = $(element);
          
          // Extract reviewer name - updated based on analysis
          let reviewer = '';
          const reviewerSelectors = [
            'a[href*="/critics/"]',
            '[data-qa*="author"]',
            '.critic-name',
            '.reviewer-name'
          ];
          
          for (const selector of reviewerSelectors) {
            const el = reviewEl.find(selector).first();
            if (el.length > 0) {
              reviewer = el.text().trim();
              if (reviewer) break;
            }
          }
          
          // Extract publication - updated based on analysis
          let publication = '';
          const publicationSelectors = [
            '[data-qa*="publication"]',
            '.publication',
            '.source'
          ];
          
          for (const selector of publicationSelectors) {
            const el = reviewEl.find(selector).first();
            if (el.length > 0) {
              publication = el.text().trim();
              if (publication) break;
            }
          }
          
          // Extract review text - updated based on analysis
          let reviewText = '';
          const textSelectors = [
            '.review-text',
            '[data-qa*="text"]',
            'p'
          ];
          
          for (const selector of textSelectors) {
            const el = reviewEl.find(selector).first();
            if (el.length > 0) {
              reviewText = el.text().trim();
              if (reviewText && reviewText.length > 10 && !reviewText.includes('Full Review')) break;
            }
          }
          
          // Extract review date - updated based on analysis
          let reviewDate = '';
          const dateSelectors = [
            '[data-qa*="date"]',
            '.date',
            'time'
          ];
          
          for (const selector of dateSelectors) {
            const el = reviewEl.find(selector).first();
            if (el.length > 0) {
              reviewDate = el.text().trim();
              if (reviewDate) break;
            }
          }
          
          // Extract full review link
          let fullReviewLink = '';
          const linkEl = reviewEl.find('a[href*="http"]').first();
          if (linkEl.length > 0) {
            fullReviewLink = linkEl.attr('href') || '';
          }

          // Only add if we have essential data
          if (reviewer || publication) {
            reviews.push({
              reviewer: reviewer || 'Unknown',
              publication: publication || 'Unknown',
              top_critic: isTopCritics,
              original_score: '', // RT doesn't show original scores consistently
              review_date: reviewDate || '',
              review_text: reviewText || '',
              full_review_link: fullReviewLink
            });
          }
        } catch (error) {
          console.error('Error parsing individual review:', error);
        }
      });

      console.log(`✅ Extracted ${reviews.length} ${isTopCritics ? 'top critic' : 'critic'} reviews`);
      return reviews;

    } catch (error) {
      console.error(`❌ Error getting ${isTopCritics ? 'top critic' : 'critic'} reviews:`, error);
      return [];
    }
  }

  // Audience reviews extraction (simplified for now)
  private async getAudienceReviews(reviewsUrl: string, verified: boolean = false): Promise<AudienceReview[]> {
    try {
      const url = verified ? `${reviewsUrl}?type=verified_audience` : `${reviewsUrl}?type=user`;
      console.log(`🔍 Getting ${verified ? 'verified ' : ''}audience reviews from: ${url}`);
      
      await this.waitForRateLimit();
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      const reviews: AudienceReview[] = [];
      
      // Audience reviews might have different structure
      const reviewElements = $('[data-qa="review-item"], .audience-review, .user-review');
      console.log(`🔍 Found ${reviewElements.length} audience review elements`);

      // For now, return empty array as audience reviews need separate analysis
      // This can be enhanced later based on the actual structure
      console.log(`⚠️ Audience review extraction needs further analysis`);
      
      return reviews;

    } catch (error) {
      console.error(`❌ Error getting audience reviews:`, error);
      return [];
    }
  }

  // Main scraping function with retry logic
  async scrapeMovieByUrl(movieUrl: string, tmdbId?: number, title?: string): Promise<RottenTomatoesData | null> {
    // Check cache first
    const cachedData = this.getCachedData(movieUrl);
    if (cachedData) {
      return cachedData;
    }

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`\n🍅 Scraping Rotten Tomatoes data from: ${movieUrl} (Attempt ${attempt}/${this.config.retryAttempts})`);
        
        const reviewsUrl = `${movieUrl}/reviews`;

        // Get scores from main page
        const { tomatoMeter, audienceScore } = await this.getScores(movieUrl);

        // Get critic reviews (regular and top critics)
        const regularCriticReviews = await this.getCriticReviews(reviewsUrl, false);
        const topCriticReviews = await this.getCriticReviews(reviewsUrl, true);
        
        // Combine and mark top critics
        const allCriticReviews = [
          ...regularCriticReviews,
          ...topCriticReviews.map(review => ({ ...review, top_critic: true }))
        ];

        // Get audience reviews (simplified for now)
        const audienceReviews = await this.getAudienceReviews(reviewsUrl, false);

        const result: RottenTomatoesData = {
          tmdb_id: tmdbId,
          title,
          url: movieUrl,
          tomato_meter_score: tomatoMeter,
          audience_score: audienceScore,
          critic_reviews: allCriticReviews,
          audience_reviews: audienceReviews,
          scraped_at: new Date().toISOString()
        };

        console.log(`\n✅ Scraping completed successfully`);
        console.log(`📊 Tomato Meter: ${tomatoMeter}% | Audience: ${audienceScore}%`);
        console.log(`📝 Found ${allCriticReviews.length} critic reviews and ${audienceReviews.length} audience reviews`);

        // Cache the result
        this.setCachedData(movieUrl, result);

        return result;

      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ All ${this.config.retryAttempts} attempts failed for ${movieUrl}`);
    return null;
  }

  // Scrape by movie title and year (tries multiple URL variations)
  async scrapeMovie(title: string, year?: string, tmdbId?: number): Promise<RottenTomatoesData | null> {
    const urlVariations = this.generateUrlVariations(title, year);
    
    console.log(`🔍 Trying ${urlVariations.length} URL variations for "${title}"`);
    
    for (let i = 0; i < urlVariations.length; i++) {
      const movieUrl = urlVariations[i];
      console.log(`🔗 Attempt ${i + 1}: ${movieUrl}`);
      
      try {
        // First, quickly check if the page exists by looking at the title
        await this.waitForRateLimit();
        await this.page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForTimeout(2000);
        
        const pageTitle = await this.page.title();
        
        // If we get a generic "Rotten Tomatoes: Movies" title, it's likely a 404
        if (pageTitle.includes('Rotten Tomatoes: Movies') && !pageTitle.includes(title)) {
          console.log(`❌ URL ${i + 1} appears to be invalid (generic title: "${pageTitle}")`);
          continue;
        }
        
        console.log(`✅ Found valid page: "${pageTitle}"`);
        
        // If we found a valid page, scrape it
        const data = await this.scrapeMovieByUrl(movieUrl, tmdbId, title);
        
        if (data && (data.tomato_meter_score !== null || data.critic_reviews.length > 0)) {
          console.log(`✅ Successfully scraped data from URL variation ${i + 1}`);
          return data;
        }
        
      } catch (error) {
        console.log(`❌ URL ${i + 1} failed: ${error}`);
        continue;
      }
    }
    
    console.log(`❌ All ${urlVariations.length} URL variations failed for "${title}"`);
    return null;
  }

  // Get scraping statistics
  getStats() {
    return {
      requestCount: this.requestCount,
      cacheDir: this.config.cacheDir,
      config: this.config
    };
  }
}

export { EnhancedRottenTomatoesScraper, type RottenTomatoesData, type CriticReview, type AudienceReview, type ScrapingConfig }; 