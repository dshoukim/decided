import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

async function quickAnalysis() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log('🔍 Analyzing The Dark Knight reviews page...');
    
    await page.goto('https://www.rottentomatoes.com/m/the_dark_knight/reviews', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    await page.waitForTimeout(3000);

    const content = await page.content();
    const $ = cheerio.load(content);

    console.log(`📄 Page title: ${$('title').text()}`);

    // Look for review containers
    const containers = [
      { selector: '[data-qa="review-item"]', name: 'data-qa review-item' },
      { selector: '[data-testid*="review"]', name: 'data-testid review' },
      { selector: '.review-item', name: 'review-item class' },
      { selector: 'article', name: 'article elements' },
      { selector: '[class*="review"]', name: 'any review class' },
    ];

    console.log('\n🔍 Container Analysis:');
    for (const { selector, name } of containers) {
      const elements = $(selector);
      console.log(`  ${name}: ${elements.length} elements`);
      
      if (elements.length > 0 && elements.length < 50) { // Reasonable number
        console.log(`    ✅ Found working selector: ${selector}`);
        
        // Analyze first element structure
        const firstEl = elements.first();
        console.log('    📋 First element structure:');
        console.log(`      - Classes: ${firstEl.attr('class')}`);
        console.log(`      - Text preview: "${firstEl.text().trim().substring(0, 100)}..."`);
        
        // Look for sub-elements
        const subElements = {
          'Author': ['[data-qa*="author"]', '.critic', '.reviewer', 'a[href*="/critics/"]'],
          'Publication': ['[data-qa*="publication"]', '.publication', '.source'],
          'Text': ['[data-qa*="text"]', '.review-text', 'p'],
          'Date': ['[data-qa*="date"]', '.date', 'time'],
          'Link': ['a[href*="http"]', '.external-link']
        };

        for (const [type, selectors] of Object.entries(subElements)) {
          for (const subSelector of selectors) {
            const subEls = firstEl.find(subSelector);
            if (subEls.length > 0) {
              const text = subEls.first().text().trim().substring(0, 50);
              console.log(`        ${type}: ${subSelector} -> "${text}..."`);
              break; // Found one, move to next type
            }
          }
        }
        break; // Found a working container, no need to check others
      }
    }

    // Save HTML for manual inspection
    const filename = `rt-quick-analysis-${Date.now()}.html`;
    writeFileSync(filename, content);
    console.log(`\n💾 Saved HTML to: ${filename}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

quickAnalysis(); 