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
      headless: false, // Keep visible for debugging
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

  // Get Rotten Tomatoes scores from main movie page
  private async getScores(movieUrl: string): Promise<{ tomatoMeter: number | null, audienceScore: number | null }> {
    try {
      console.log(`🔍 Navigating to: ${movieUrl}`);
      await this.page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      console.log(`🔍 Page title: ${$('title').text()}`);

      // Debug: Print some basic page info
      const h1 = $('h1').text();
      console.log(`🔍 Main heading: ${h1}`);

      // Extract scores using text pattern matching from the visible content
      let tomatoMeter: number | null = null;
      let audienceScore: number | null = null;

      // Look for text patterns that indicate scores
      // From the debug output, we can see patterns like "91%\n        Tomatometer" and "79%\n        Popcornmeter"
      
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

      // Fallback to selector-based extraction if JSON parsing failed
      if (tomatoMeter === null) {
        const tomatoSelectors = [
          'rt-button[data-qa="tomatometer"] rt-text',
          '[data-qa="tomatometer-score"]',
          '.mop-ratings-wrap__percentage',
          'score-board-deprecated[audiencescore] [slot="criticsScore"]',
          '[data-testid="critics-score"]',
          '[data-testid="tomatometer-score"]',
          '.mop-ratings-wrap__percentage.mop-ratings-wrap__percentage--tomatometer',
          'score-icon[class*="tomatometer"] ~ *'
        ];

        for (const selector of tomatoSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const scoreText = element.text().trim().replace('%', '');
            console.log(`🔍 Found tomato meter element with selector "${selector}": "${scoreText}"`);
            const score = parseInt(scoreText);
            if (!isNaN(score)) {
              tomatoMeter = score;
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
          '[data-testid="audience-score"]',
          '[data-testid="audience-score-percentage"]',
          '.mop-ratings-wrap__percentage.mop-ratings-wrap__percentage--audience'
        ];

        for (const selector of audienceSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const scoreText = element.text().trim().replace('%', '');
            console.log(`🔍 Found audience score element with selector "${selector}": "${scoreText}"`);
            const score = parseInt(scoreText);
            if (!isNaN(score)) {
              audienceScore = score;
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

      // Debug: Check what review containers we can find
      console.log(`🔍 Looking for review containers...`);
      
      // Look for review containers
      const reviewSelectors = [
        '[data-qa="review-item"]',
        '.review_table_row',
        '.review-row',
        '[data-testid="review"]',
        '.review-item',
        'div[class*="review"]'
      ];

      let reviewElements = $();
      for (const selector of reviewSelectors) {
        reviewElements = $(selector);
        console.log(`🔍 Selector "${selector}" found ${reviewElements.length} elements`);
        if (reviewElements.length > 0) break;
      }

      if (reviewElements.length === 0) {
        console.log('🔍 No review elements found, checking page structure...');
        console.log('🔍 Page title:', $('title').text());
        console.log('🔍 Available divs with data attributes:');
        $('div[data-qa], div[data-testid]').each((i, el) => {
          if (i < 10) { // Limit output
            const $el = $(el);
            console.log(`  - div with ${Object.keys(el.attribs).map(k => `${k}="${el.attribs[k]}"`).join(' ')}`);
          }
        });
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
            
            console.log(`📝 Found review by ${reviewer} from ${publication}`);
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

  // Main scraping function
  async scrapeMovieByUrl(movieUrl: string): Promise<RottenTomatoesData> {
    console.log(`\n🍅 Scraping Rotten Tomatoes data from: ${movieUrl}`);
    
    const reviewsUrl = `${movieUrl}/reviews`;

    // Get scores from main page
    const { tomatoMeter, audienceScore } = await this.getScores(movieUrl);

    // Get critic reviews (regular only for now)
    const regularCriticReviews = await this.getCriticReviews(reviewsUrl, false);

    const result: RottenTomatoesData = {
      tomato_meter_score: tomatoMeter,
      audience_score: audienceScore,
      critic_reviews: regularCriticReviews,
      audience_reviews: [] // Skip audience reviews for this test
    };

    console.log(`\n✅ Scraping completed`);
    console.log(`📊 Tomato Meter: ${tomatoMeter}% | Audience: ${audienceScore}%`);
    console.log(`📝 Found ${regularCriticReviews.length} critic reviews`);

    return result;
  }
}

// Test function with the exact URL from the search results
async function testScrapingWithDirectURL() {
  try {
    console.log('🎬 Testing scraper with direct Rotten Tomatoes URL...');
    
    // Initialize scraper
    const scraper = new RottenTomatoesScraper();
    await scraper.init();

    try {
      // Use the exact URL from the web search results
      const data = await scraper.scrapeMovieByUrl('https://www.rottentomatoes.com/m/deep_cover_2025');
      
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
testScrapingWithDirectURL()
  .then(() => {
    console.log('\n✅ Scraping test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

export { RottenTomatoesScraper, type RottenTomatoesData, type CriticReview, type AudienceReview }; 