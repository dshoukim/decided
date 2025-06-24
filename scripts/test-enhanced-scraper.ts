import { EnhancedRottenTomatoesScraper } from './enhanced-rt-scraper';

async function testEnhancedScraper() {
  console.log('🚀 Testing Enhanced Rotten Tomatoes Scraper');
  console.log('='.repeat(50));

  const scraper = new EnhancedRottenTomatoesScraper({
    headless: true,
    rateLimitMs: 1500,
    enableCache: true,
    retryAttempts: 2
  });

  try {
    await scraper.init();
    
    // Test with The Dark Knight
    console.log('\n🎬 Testing with The Dark Knight...');
    const data = await scraper.scrapeMovieByUrl('https://www.rottentomatoes.com/m/the_dark_knight');
    
    if (data) {
      console.log('\n📈 RESULTS:');
      console.log('====================');
      console.log(`🍅 Tomato Meter: ${data.tomato_meter_score}%`);
      console.log(`🍿 Audience Score: ${data.audience_score}%`);
      console.log(`📝 Critic Reviews: ${data.critic_reviews.length}`);
      console.log(`💬 Audience Reviews: ${data.audience_reviews.length}`);
      
      // Show sample reviews
      if (data.critic_reviews.length > 0) {
        console.log('\n📋 Sample Reviews:');
        data.critic_reviews.slice(0, 3).forEach((review, index) => {
          console.log(`\n  ${index + 1}. ${review.reviewer} - ${review.publication}`);
          console.log(`     Date: ${review.review_date}`);
          console.log(`     Text: ${review.review_text.substring(0, 100)}...`);
          console.log(`     Link: ${review.full_review_link}`);
        });
      }
      
      // Show stats
      console.log('\n📊 Scraper Stats:');
      const stats = scraper.getStats();
      console.log(`   Requests made: ${stats.requestCount}`);
      console.log(`   Cache directory: ${stats.cacheDir}`);
      console.log(`   Rate limit: ${stats.config.rateLimitMs}ms`);
      
    } else {
      console.log('❌ No data returned from scraper');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
  }
}

testEnhancedScraper(); 