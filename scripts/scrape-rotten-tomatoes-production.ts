import 'dotenv/config';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { db } from '../src/db';
import { films } from '../src/db/schema';
import { eq } from 'drizzle-orm';

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
      slowMo: headless ? 500 : 1000 // Slower when visible for debugging
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
          // Usually critics score comes first, then audience score
          if (tomatoMeter === null) tomatoMeter = scores[0];
          if (audienceScore === null) audienceScore = scores[1];
          console.log(`🔍 Extracted scores from JSON pattern: tomato=${tomatoMeter}%, audience=${audienceScore}%`);
        }
      }

      // Fallback to selector-based extraction if pattern matching failed
      if (tomatoMeter === null) {
        const tomatoSelectors = [
          'rt-button[data-qa="tomatometer"] rt-text',
          '[data-qa="tomatometer-score"]',
          '.mop-ratings-wrap__percentage',
          'score-board-deprecated[audiencescore] [slot="criticsScore"]',
          '[data-testid="critics-score"]',
          '[data-testid="tomatometer-score"]'
        ];

        for (const selector of tomatoSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const scoreText = element.text().trim().replace('%', '');
            const score = parseInt(scoreText);
            if (!isNaN(score)) {
              tomatoMeter = score;
              console.log(`🔍 Extracted tomato meter from selector "${selector}": ${tomatoMeter}%`);
              break;
            }
          }
        }
      }

      if (audienceScore === null) {
        const audienceSelectors = [
          'rt-button[data-qa="audience-score"] rt-text',
          '[data-qa="audience-score"]',
          'score-board-deprecated[audiencescore] [slot="audienceScore"]',
          '[data-testid="audience-score"]'
        ];

        for (const selector of audienceSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const scoreText = element.text().trim().replace('%', '');
            const score = parseInt(scoreText);
            if (!isNaN(score)) {
              audienceScore = score;
              console.log(`🔍 Extracted audience score from selector "${selector}": ${audienceScore}%`);
              break;
            }
          }
        }
      }

      console.log(`📊 Final scores - Tomato Meter: ${tomatoMeter}%, Audience: ${audienceScore}%`);
      return { tomatoMeter, audienceScore };

    } catch (error) {
      console.error('❌ Error getting scores:', error);
      return { tomatoMeter: null, audienceScore: null };
    }
  }

  // Scrape critic reviews
  private async getCriticReviews(reviewsUrl: string, isTopCritics: boolean = false): Promise<CriticReview[]> {
    try {
      const url = isTopCritics ? `${reviewsUrl}?type=top_critics` : reviewsUrl;
      console.log(`🔍 Getting ${isTopCritics ? 'top critic' : 'critic'} reviews from: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      const reviews: CriticReview[] = [];

      // Look for review containers
      const reviewSelectors = [
        '[data-qa="review-item"]',
        '.review_table_row',
        '.review-row',
        '[data-testid="review"]',
        '.review-item'
      ];

      let reviewElements = $();
      for (const selector of reviewSelectors) {
        reviewElements = $(selector);
        if (reviewElements.length > 0) {
          console.log(`🔍 Found ${reviewElements.length} review elements with selector: ${selector}`);
          break;
        }
      }

      reviewElements.each((index, element) => {
        try {
          const reviewEl = $(element);
          
          // Extract reviewer name
          const reviewerSelectors = ['[data-qa="review-author"]', '.critic-name', '.reviewer-name', 'a[href*="/critics/"]'];
          let reviewer = '';
          for (const sel of reviewerSelectors) {
            const el = reviewEl.find(sel).first();
            if (el.length > 0) {
              reviewer = el.text().trim();
              break;
            }
          }
          
          // Extract publication
          const publicationSelectors = ['[data-qa="review-publication"]', '.publication', '.critic-publication'];
          let publication = '';
          for (const sel of publicationSelectors) {
            const el = reviewEl.find(sel).first();
            if (el.length > 0) {
              publication = el.text().trim();
              break;
            }
          }
          
          // Extract review text
          const reviewTextSelectors = ['[data-qa="review-text"]', '.review-text', '.the_review'];
          let reviewText = '';
          for (const sel of reviewTextSelectors) {
            const el = reviewEl.find(sel).first();
            if (el.length > 0) {
              reviewText = el.text().trim();
              break;
            }
          }
          
          // Extract original score
          const originalScore = reviewEl.find('.original-score, [data-qa="review-score"]').first().text().trim();
          
          // Extract review date
          const reviewDate = reviewEl.find('[data-qa="review-date"], .review-date, .critic-date').first().text().trim();
          
          // Extract full review link
          let fullReviewLink = '';
          const linkEl = reviewEl.find('a[href*="http"], .external-link a, [data-qa="review-link"]').first();
          if (linkEl.length > 0) {
            fullReviewLink = linkEl.attr('href') || '';
          }

          if (reviewer) {
            reviews.push({
              reviewer,
              publication: publication || '',
              top_critic: isTopCritics,
              original_score: originalScore || '',
              review_date: reviewDate || '',
              review_text: reviewText || '',
              full_review_link: fullReviewLink
            });
          }
        } catch (error) {
          console.error('Error parsing individual review:', error);
        }
      });

      console.log(`✅ Found ${reviews.length} ${isTopCritics ? 'top critic' : 'critic'} reviews`);
      return reviews;

    } catch (error) {
      console.error(`❌ Error getting ${isTopCritics ? 'top critic' : 'critic'} reviews:`, error);
      return [];
    }
  }

  // Scrape audience reviews
  private async getAudienceReviews(reviewsUrl: string, verified: boolean = false): Promise<AudienceReview[]> {
    try {
      const url = verified ? `${reviewsUrl}?type=verified_audience` : `${reviewsUrl}?type=user`;
      console.log(`🔍 Getting ${verified ? 'verified' : 'regular'} audience reviews from: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      const reviews: AudienceReview[] = [];

      // Look for audience review containers
      const reviewSelectors = [
        '[data-qa="audience-review"]',
        '.audience-review',
        '.user-review',
        '[data-testid="audience-review"]'
      ];

      let reviewElements = $();
      for (const selector of reviewSelectors) {
        reviewElements = $(selector);
        if (reviewElements.length > 0) {
          console.log(`🔍 Found ${reviewElements.length} audience review elements with selector: ${selector}`);
          break;
        }
      }

      reviewElements.each((index, element) => {
        try {
          const reviewEl = $(element);
          
          // Extract user name
          const user = reviewEl.find('[data-qa="audience-review-author"], .user-name, .audience-author').first().text().trim();
          
          // Extract rating
          const ratingEl = reviewEl.find('[data-qa="audience-rating"], .user-rating, .star-rating');
          let rating = '';
          if (ratingEl.length > 0) {
            // Look for star ratings or numeric ratings
            const stars = ratingEl.find('.star, .filled-star').length;
            if (stars > 0) {
              rating = `${stars}/5`;
            } else {
              rating = ratingEl.text().trim();
            }
          }
          
          // Extract review text
          const reviewText = reviewEl.find('[data-qa="audience-review-text"], .user-review-text, .audience-review-text').first().text().trim();
          
          // Extract date
          const date = reviewEl.find('[data-qa="audience-review-date"], .review-date, .user-date').first().text().trim();

          if (user) {
            reviews.push({
              user,
              rating: rating || '',
              date: date || '',
              verified_audience: verified,
              review_text: reviewText || ''
            });
          }
        } catch (error) {
          console.error('Error parsing individual audience review:', error);
        }
      });

      console.log(`✅ Found ${reviews.length} ${verified ? 'verified' : 'regular'} audience reviews`);
      return reviews;

    } catch (error) {
      console.error(`❌ Error getting ${verified ? 'verified' : 'regular'} audience reviews:`, error);
      return [];
    }
  }

  // Main scraping function
  async scrapeMovie(title: string, year?: string): Promise<RottenTomatoesData> {
    console.log(`\n🍅 Scraping Rotten Tomatoes data for: ${title} ${year ? `(${year})` : ''}`);
    
    const slug = this.titleToSlug(title, year);
    const baseUrl = `https://www.rottentomatoes.com/m/${slug}`;
    const reviewsUrl = `${baseUrl}/reviews`;

    console.log(`Attempting to scrape: ${baseUrl}`);

    // Get scores from main page
    const { tomatoMeter, audienceScore } = await this.getScores(baseUrl);

    // Get all types of reviews
    const [
      regularCriticReviews,
      topCriticReviews,
      audienceReviews,
      verifiedAudienceReviews
    ] = await Promise.all([
      this.getCriticReviews(reviewsUrl, false),
      this.getCriticReviews(reviewsUrl, true),
      this.getAudienceReviews(reviewsUrl, false),
      this.getAudienceReviews(reviewsUrl, true)
    ]);

    // Combine all critic reviews
    const allCriticReviews = [...regularCriticReviews, ...topCriticReviews];
    
    // Combine all audience reviews
    const allAudienceReviews = [...audienceReviews, ...verifiedAudienceReviews];

    const result: RottenTomatoesData = {
      tomato_meter_score: tomatoMeter,
      audience_score: audienceScore,
      critic_reviews: allCriticReviews,
      audience_reviews: allAudienceReviews
    };

    console.log(`\n✅ Scraping completed for ${title}`);
    console.log(`📊 Tomato Meter: ${tomatoMeter}% | Audience: ${audienceScore}%`);
    console.log(`📝 Found ${allCriticReviews.length} critic reviews and ${allAudienceReviews.length} audience reviews`);

    return result;
  }

  // Scrape movie by direct URL
  async scrapeMovieByUrl(movieUrl: string): Promise<RottenTomatoesData> {
    console.log(`\n🍅 Scraping Rotten Tomatoes data from: ${movieUrl}`);
    
    const reviewsUrl = `${movieUrl}/reviews`;

    // Get scores from main page
    const { tomatoMeter, audienceScore } = await this.getScores(movieUrl);

    // Get critic reviews (both regular and top critics)
    const [regularCriticReviews, topCriticReviews] = await Promise.all([
      this.getCriticReviews(reviewsUrl, false),
      this.getCriticReviews(reviewsUrl, true)
    ]);

    // For now, skip audience reviews to make scraping faster
    const allCriticReviews = [...regularCriticReviews, ...topCriticReviews];

    const result: RottenTomatoesData = {
      tomato_meter_score: tomatoMeter,
      audience_score: audienceScore,
      critic_reviews: allCriticReviews,
      audience_reviews: [] // Skip for faster execution
    };

    console.log(`\n✅ Scraping completed`);
    console.log(`📊 Tomato Meter: ${tomatoMeter}% | Audience: ${audienceScore}%`);
    console.log(`📝 Found ${allCriticReviews.length} critic reviews`);

    return result;
  }
}

// Test function to scrape a random film from our database
async function testScrapingWithDatabaseFilm() {
  try {
    console.log('🎬 Fetching a random film from database...');
    
    // Get a random film from our database
    const randomFilms = await db
      .select({
        id: films.id,
        title: films.title,
        releaseDate: films.releaseDate,
        tmdbId: films.tmdbId
      })
      .from(films)
      .limit(1)
      .offset(Math.floor(Math.random() * 100)); // Get a somewhat random film

    if (randomFilms.length === 0) {
      console.error('❌ No films found in database');
      return;
    }

    const film = randomFilms[0];
    const year = film.releaseDate ? new Date(film.releaseDate).getFullYear().toString() : undefined;
    
    console.log(`\n🎯 Selected film: ${film.title} ${year ? `(${year})` : ''}`);
    console.log(`📁 Database ID: ${film.id}, TMDB ID: ${film.tmdbId}`);

    // Initialize scraper
    const scraper = new RottenTomatoesScraper();
    await scraper.init(true); // headless = true for production

    try {
      // Scrape the movie
      const data = await scraper.scrapeMovie(film.title, year);
      
      // Display results
      console.log('\n📈 RESULTS:');
      console.log('====================');
      console.log(`Tomato Meter: ${data.tomato_meter_score}%`);
      console.log(`Audience Score: ${data.audience_score}%`);
      console.log(`Critic Reviews: ${data.critic_reviews.length}`);
      console.log(`Audience Reviews: ${data.audience_reviews.length}`);
      
      // Display first few critic reviews
      if (data.critic_reviews.length > 0) {
        console.log('\nFirst 3 Critic Reviews:');
        data.critic_reviews.slice(0, 3).forEach((review, index) => {
          console.log(`${index + 1}. ${review.reviewer} (${review.publication})`);
          console.log(`   "${review.review_text.substring(0, 100)}..."`);
          console.log(`   Date: ${review.review_date}, Top Critic: ${review.top_critic}`);
          console.log('');
        });
      }
      
      // TODO: Save to database
      console.log('\n💾 (Data would be saved to database here)');
      
    } finally {
      await scraper.close();
    }

  } catch (error) {
    console.error('❌ Error during scraping test:', error);
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'test') {
    testScrapingWithDatabaseFilm()
      .then(() => {
        console.log('\n✅ Scraping test completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: npx tsx scripts/scrape-rotten-tomatoes-production.ts test');
    process.exit(1);
  }
}

export { RottenTomatoesScraper, type RottenTomatoesData, type CriticReview, type AudienceReview }; 