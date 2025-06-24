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

  async init() {
    this.browser = await chromium.launch({ 
      headless: false, // Set to true in production
      slowMo: 1000 // Slow down operations to be respectful
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
      await this.page.goto(movieUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      // Try multiple selectors for tomato meter
      let tomatoMeter: number | null = null;
      const tomatoSelectors = [
        'rt-button[data-qa="tomatometer"] rt-text',
        '[data-qa="tomatometer-score"]',
        '.mop-ratings-wrap__percentage',
        'score-board-deprecated[audiencescore] [slot="criticsScore"]',
        '[data-testid="critics-score"]'
      ];

      for (const selector of tomatoSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const scoreText = element.text().trim().replace('%', '');
          const score = parseInt(scoreText);
          if (!isNaN(score)) {
            tomatoMeter = score;
            break;
          }
        }
      }

      // Try multiple selectors for audience score
      let audienceScore: number | null = null;
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
            break;
          }
        }
      }

      console.log(`Scores found - Tomato Meter: ${tomatoMeter}%, Audience: ${audienceScore}%`);
      return { tomatoMeter, audienceScore };

    } catch (error) {
      console.error('Error getting scores:', error);
      return { tomatoMeter: null, audienceScore: null };
    }
  }

  // Scrape critic reviews
  private async getCriticReviews(reviewsUrl: string, isTopCritics: boolean = false): Promise<CriticReview[]> {
    try {
      const url = isTopCritics ? `${reviewsUrl}?type=top_critics` : reviewsUrl;
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      const reviews: CriticReview[] = [];

      // Look for review containers
      const reviewSelectors = [
        '[data-qa="review-item"]',
        '.review_table_row',
        '.review-row',
        '[data-testid="review"]'
      ];

      let reviewElements = $();
      for (const selector of reviewSelectors) {
        reviewElements = $(selector);
        if (reviewElements.length > 0) break;
      }

      reviewElements.each((index, element) => {
        try {
          const reviewEl = $(element);
          
          // Extract reviewer name
          const reviewer = reviewEl.find('[data-qa="review-author"], .critic-name, .reviewer-name, a[href*="/critics/"]').first().text().trim();
          
          // Extract publication
          const publication = reviewEl.find('[data-qa="review-publication"], .publication, .critic-publication').first().text().trim();
          
          // Extract review text
          const reviewText = reviewEl.find('[data-qa="review-text"], .review-text, .the_review').first().text().trim();
          
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

      console.log(`Found ${reviews.length} ${isTopCritics ? 'top critic' : 'critic'} reviews`);
      return reviews;

    } catch (error) {
      console.error(`Error getting ${isTopCritics ? 'top critic' : 'critic'} reviews:`, error);
      return [];
    }
  }

  // Scrape audience reviews
  private async getAudienceReviews(reviewsUrl: string, verified: boolean = false): Promise<AudienceReview[]> {
    try {
      const url = verified ? `${reviewsUrl}?type=verified_audience` : `${reviewsUrl}?type=user`;
      await this.page.goto(url, { waitUntil: 'networkidle' });
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
        if (reviewElements.length > 0) break;
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

      console.log(`Found ${reviews.length} ${verified ? 'verified' : 'regular'} audience reviews`);
      return reviews;

    } catch (error) {
      console.error(`Error getting ${verified ? 'verified' : 'regular'} audience reviews:`, error);
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
}

// Test function with a hardcoded popular movie
async function testScrapingWithKnownMovie() {
  try {
    console.log('🎬 Testing scraper with "Deep Cover" (2025)...');
    
    // Initialize scraper
    const scraper = new RottenTomatoesScraper();
    await scraper.init();

    try {
      // Test with the movie mentioned in the examples
      const data = await scraper.scrapeMovie('Deep Cover', '2025');
      
      // Display results
      console.log('\n📈 RESULTS:');
      console.log('====================');
      console.log(JSON.stringify(data, null, 2));
      
    } finally {
      await scraper.close();
    }

  } catch (error) {
    console.error('❌ Error during scraping test:', error);
  }
}

// Main execution
testScrapingWithKnownMovie()
  .then(() => {
    console.log('\n✅ Scraping test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

export { RottenTomatoesScraper, type RottenTomatoesData, type CriticReview, type AudienceReview }; 