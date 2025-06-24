import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

class RTStructureAnalyzer {
  private browser: any = null;
  private page: any = null;

  async init() {
    this.browser = await chromium.launch({ 
      headless: false, // Keep visible so we can see what's happening
      slowMo: 1000 
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

  async analyzeReviewPage(movieUrl: string) {
    const reviewsUrl = `${movieUrl}/reviews`;
    console.log(`🔍 Analyzing review page structure: ${reviewsUrl}`);
    
    try {
      await this.page.goto(reviewsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(5000); // Wait for dynamic content

      const content = await this.page.content();
      const $ = cheerio.load(content);

      console.log(`\n📄 Page title: ${$('title').text()}`);
      console.log(`🔍 Page URL: ${this.page.url()}`);

      // Look for potential review containers
      console.log(`\n🔍 Looking for review container patterns...`);
      
      const potentialContainers = [
        '[data-qa="review-item"]',
        '[data-testid="review"]',
        '.review-item',
        '.review-container',
        '.review-row',
        '.review_table_row',
        '[class*="review"]',
        '[data-qa*="review"]',
        '[data-testid*="review"]',
        'article',
        '.critic-review',
        '.user-review'
      ];

      for (const selector of potentialContainers) {
        const elements = $(selector);
        console.log(`  ${selector}: ${elements.length} elements`);
        
        if (elements.length > 0) {
          console.log(`    ✅ Found elements with selector: ${selector}`);
          
                     // Analyze the first few elements
           elements.slice(0, 3).each((index, element) => {
             const $el = $(element);
             console.log(`      Element ${index + 1}:`);
             console.log(`        Classes: ${$el.attr('class') || 'none'}`);
             // Type guard for element attributes
             const attrs = (element as any).attribs || {};
             console.log(`        Data attributes:`, Object.keys(attrs)
               .filter(key => key.startsWith('data-'))
               .map(key => `${key}="${attrs[key]}"`)
               .join(', ') || 'none');
             console.log(`        Text preview: "${$el.text().trim().substring(0, 100)}..."`);
           });
        }
      }

      // Look for specific review elements within any found containers
      console.log(`\n🔍 Looking for specific review data elements...`);
      
      const reviewDataSelectors = {
        'Author/Reviewer': [
          '[data-qa="review-author"]',
          '[data-qa*="author"]',
          '.critic-name',
          '.reviewer-name',
          '.review-author',
          'a[href*="/critics/"]',
          '[class*="author"]',
          '[class*="critic"]'
        ],
        'Publication': [
          '[data-qa="review-publication"]',
          '[data-qa*="publication"]',
          '.publication',
          '.critic-publication',
          '.review-publication',
          '[class*="publication"]'
        ],
        'Review Text': [
          '[data-qa="review-text"]',
          '[data-qa*="text"]',
          '.review-text',
          '.the_review',
          '.review-content',
          '[class*="review-text"]',
          'p[class*="review"]'
        ],
        'Date': [
          '[data-qa="review-date"]',
          '[data-qa*="date"]',
          '.review-date',
          '.critic-date',
          '[class*="date"]',
          'time'
        ],
        'Score/Rating': [
          '[data-qa="review-score"]',
          '[data-qa*="score"]',
          '.original-score',
          '.review-score',
          '[class*="score"]',
          '[class*="rating"]'
        ],
        'External Link': [
          'a[href*="http"]',
          '.external-link',
          '[data-qa*="link"]',
          '.review-link'
        ]
      };

      for (const [category, selectors] of Object.entries(reviewDataSelectors)) {
        console.log(`\n  ${category}:`);
        for (const selector of selectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`    ✅ ${selector}: ${elements.length} elements`);
            // Show sample text from first element
            const sampleText = elements.first().text().trim().substring(0, 80);
            if (sampleText) {
              console.log(`      Sample: "${sampleText}..."`);
            }
          }
        }
      }

      // Check for pagination or load more buttons
      console.log(`\n🔍 Looking for pagination/load more...`);
      const paginationSelectors = [
        '.pagination',
        '[data-qa*="pagination"]',
        '[data-qa*="load"]',
        '.load-more',
        'button[class*="load"]',
        'button[class*="more"]',
        '.next-page'
      ];

      for (const selector of paginationSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`  ✅ ${selector}: ${elements.length} elements`);
        }
      }

      // Save the HTML for manual inspection
      const fs = await import('fs');
      const filename = `rt-structure-analysis-${Date.now()}.html`;
      await fs.writeFileSync(filename, content);
      console.log(`\n💾 Saved full HTML to: ${filename}`);

    } catch (error) {
      console.error('❌ Error analyzing structure:', error);
    }
  }

  async analyzeTopCriticsPage(movieUrl: string) {
    const topCriticsUrl = `${movieUrl}/reviews?type=top_critics`;
    console.log(`\n🔍 Analyzing top critics page: ${topCriticsUrl}`);
    
    try {
      await this.page.goto(topCriticsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      console.log(`📄 Top Critics Page title: ${$('title').text()}`);
      
      // Check if the structure is different for top critics
      const reviewElements = $('[data-qa="review-item"]');
      console.log(`🔍 Found ${reviewElements.length} review elements on top critics page`);

    } catch (error) {
      console.error('❌ Error analyzing top critics structure:', error);
    }
  }

  async analyzeAudienceReviewsPage(movieUrl: string) {
    const audienceUrl = `${movieUrl}/reviews?type=user`;
    console.log(`\n🔍 Analyzing audience reviews page: ${audienceUrl}`);
    
    try {
      await this.page.goto(audienceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(3000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      console.log(`📄 Audience Reviews Page title: ${$('title').text()}`);
      
      // Look for audience-specific elements
      const audienceSelectors = [
        '[data-qa*="audience"]',
        '[data-qa*="user"]',
        '.audience-review',
        '.user-review',
        '[class*="audience"]',
        '[class*="user"]'
      ];

      console.log(`🔍 Looking for audience-specific elements...`);
      for (const selector of audienceSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`  ✅ ${selector}: ${elements.length} elements`);
        }
      }

    } catch (error) {
      console.error('❌ Error analyzing audience reviews structure:', error);
    }
  }
}

async function main() {
  const analyzer = new RTStructureAnalyzer();
  
  try {
    await analyzer.init();
    
    // Use a popular movie with lots of reviews
    const testMovie = 'https://www.rottentomatoes.com/m/the_dark_knight';
    
    console.log('🍅 Starting Rotten Tomatoes Structure Analysis');
    console.log('='.repeat(50));
    
    // Analyze different types of review pages
    await analyzer.analyzeReviewPage(testMovie);
    await analyzer.analyzeTopCriticsPage(testMovie);
    await analyzer.analyzeAudienceReviewsPage(testMovie);
    
    console.log('\n✅ Analysis completed!');
    console.log('Check the saved HTML file for manual inspection.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await analyzer.close();
  }
}

main().catch(console.error); 