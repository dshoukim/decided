# Technical Context: Decided

## Technology Stack

### Frontend Framework
- **Next.js 15**: React framework with App Router for modern SSR/SSG capabilities
- **React 19**: Latest React with improved concurrent features and hooks
- **TypeScript 5.8+**: Full type safety across the application
- **Tailwind CSS 4.x**: Utility-first CSS framework with modern design system
- **shadcn/ui**: High-quality React components built on Radix UI

### Backend Infrastructure
- **Supabase**: Backend-as-a-Service providing authentication, database, and real-time features
  - PostgreSQL database with Row Level Security (RLS)
  - Real-time subscriptions via WebSocket
  - Google OAuth integration
  - Edge functions for serverless computing

### Database & ORM
- **PostgreSQL**: Primary database via Supabase cloud hosting
- **Drizzle ORM 0.44+**: TypeScript-first ORM with excellent type inference
- **Database Migrations**: Version-controlled schema changes via Drizzle Kit

### State Management
- **Zustand 5.x**: Lightweight state management for client-side tournament state
- **SWR 2.x**: Data fetching with caching, revalidation, and optimistic updates
- **React Query (TanStack)**: Server state management and caching layer

### External APIs & Web Scraping
- **TMDB API**: Comprehensive movie database integration for film metadata, posters, trailers, and details
  - Movie search by title and TMDB ID
  - Video/trailer fetching with intelligent prioritization
  - Keywords, genres, production companies, and financial data
- **Rotten Tomatoes Scraper**: Advanced web scraping infrastructure for critic scores and reviews
  - **Playwright 1.x**: Browser automation with proper user agent simulation
  - **Cheerio**: HTML parsing and element selection for review extraction
  - **Enhanced URL Handling**: Smart disambiguation between movie titles
  - **Rate Limiting & Caching**: Respectful scraping with 24-hour cache system
  - **Review Extraction**: Comprehensive critic review data with metadata
- **Supabase Real-time**: WebSocket-based real-time synchronization

### Development Tools
- **ESLint 9**: Code linting with Next.js configuration
- **PostCSS**: CSS processing for Tailwind CSS
- **Turbopack**: Fast development bundler (Next.js dev mode)
- **tsx**: TypeScript execution for scraping scripts and utilities

## Architecture Patterns

### Application Structure
```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # Server-side API endpoints
│   ├── decide-together/   # Main tournament feature pages
│   └── auth/              # Authentication flow pages
├── components/            # Reusable React components
├── lib/                   # Shared utilities and services
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand state stores
│   ├── services/         # Business logic services
│   └── utils/            # Helper functions
├── db/                    # Database schema and configuration
└── scripts/               # Data management and scraping utilities
    ├── enhanced-rt-scraper.ts       # Core RT scraping engine
    ├── rt-scraper-cli.ts           # Command-line interface
    ├── rt-database-integration.ts  # Database batch processing
    ├── analyze-rt-structure.ts     # RT HTML analysis tools
    └── populate-films-from-tmdb.ts # TMDB data population
```

### Design Patterns

**Hook-Based Architecture**
- Custom hooks encapsulate complex state logic (`useRoom`, `useTournament`)
- Server state managed via SWR with real-time updates
- Clear separation between UI components and business logic

**Service Layer Pattern**
- Business logic abstracted into service classes
- `TournamentEngine`: Core tournament bracket generation
- `RoomStateManager`: Room lifecycle and state transitions
- `ActionProcessor`: User action handling and validation
- `EnhancedRottenTomatoesScraper`: RT data extraction and management

**Event-Driven Updates**
- Real-time events via Supabase channels
- Optimistic UI updates with server reconciliation
- Zustand stores for centralized state management

## Movie Data Infrastructure

### Enhanced Scraping Architecture

**Rotten Tomatoes Integration**
```typescript
class EnhancedRottenTomatoesScraper {
  // Smart URL generation without default year suffixes
  generateUrlVariations(title: string, year?: string): string[]
  
  // Comprehensive data extraction
  scrapeMovieByUrl(url: string): Promise<RottenTomatoesData>
  extractScores(page: Page): Promise<ScoreData>
  extractReviews(page: Page): Promise<ReviewData[]>
  
  // Production features
  waitForRateLimit(): Promise<void>  // Respectful 2s delays
  getCachedData(url: string): RottenTomatoesData | null  // 24h cache
  saveCachedData(url: string, data: RottenTomatoesData): void
}
```

**Movie Data Pipeline**
```typescript
// TMDB + RT data integration
interface ComprehensiveMovieData {
  // TMDB fields
  tmdbId: number
  title: string
  overview: string
  releaseDate: string
  trailerLink: string | null
  
  // RT fields (proposed)
  rtTomatoMeter: number | null
  rtAudienceScore: number | null
  rtCriticReviews: ReviewData[]
  rtUrl: string | null
  rtLastUpdated: Date | null
}
```

**URL Handling Strategy**
```typescript
// Smart RT URL resolution
generateUrlVariations(title: string, year?: string): string[] {
  const baseSlug = this.titleToSlug(title)
  const urls = [`https://www.rottentomatoes.com/m/${baseSlug}`]
  
  // Only add year for disambiguation when needed
  if (year) {
    urls.push(`https://www.rottentomatoes.com/m/${baseSlug}_${year}`)
  }
  
  return urls
}
```

### CLI Tools & Batch Processing

**Command-Line Interface**
```bash
# Movie scraping
npx tsx scripts/rt-scraper-cli.ts movie -m "The Dark Knight" -y 2008

# URL scraping  
npx tsx scripts/rt-scraper-cli.ts url -u "https://www.rottentomatoes.com/m/oppenheimer_2023"

# Batch demonstration
npx tsx scripts/rt-scraper-cli.ts demo --limit 5 --verbose

# HTML structure analysis
npx tsx scripts/rt-scraper-cli.ts analyze
```

**Batch Processing Architecture**
```typescript
// Database integration for large-scale RT data collection
class RTDatabaseIntegrator {
  async batchProcessMovies(options: {
    batchSize: number
    delay: number
    testMode: boolean
  }): Promise<ProcessingResults>
  
  async updateFilmsWithRTData(movies: Movie[]): Promise<void>
  validateRTData(data: RottenTomatoesData): boolean
  generateProcessingReport(): ProcessingReport
}
```

## Database Design

### Core Tables
```sql
-- User management
users: User profiles and preferences
movie_ratings: ELO-based movie preference tracking
watch_list: Personal movie collections

-- Enhanced movie database
films: Comprehensive movie metadata (27+ fields)
  - TMDB/IMDB IDs, titles, descriptions
  - Ratings, popularity, financial data
  - Genres, production companies, countries
  - Poster/backdrop paths, trailer links
  - Keywords and additional metadata
  - [Proposed] RT scores and review data

-- Tournament system
rooms: Game session containers
room_participants: User participation tracking
bracket_picks: Individual tournament decisions
user_movie_elo: Preference learning system
```

### Proposed RT Data Schema Extension
```sql
-- Additional fields for films table
ALTER TABLE films ADD COLUMN rt_tomato_meter INTEGER;
ALTER TABLE films ADD COLUMN rt_audience_score INTEGER;
ALTER TABLE films ADD COLUMN rt_url TEXT;
ALTER TABLE films ADD COLUMN rt_last_updated TIMESTAMP;

-- Separate table for detailed reviews
CREATE TABLE rt_reviews (
  id SERIAL PRIMARY KEY,
  film_id INTEGER REFERENCES films(id),
  reviewer_name TEXT,
  publication TEXT,
  review_text TEXT,
  review_date DATE,
  external_url TEXT,
  is_top_critic BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Web Scraping Infrastructure

### Rate Limiting & Caching Strategy

**Respectful Scraping Practices**
- **Default Rate Limit**: 2000ms delays between requests
- **Configurable Delays**: Adjustable via CLI options (minimum 1000ms recommended)
- **24-Hour Caching**: File-based cache system to avoid re-scraping
- **Cache Hit Optimization**: 394x performance improvement with cached data
- **User Agent Compliance**: Proper browser simulation via Playwright

**Error Handling & Resilience**
```typescript
interface ScrapeOptions {
  retryAttempts: number     // Default: 3
  retryDelay: number        // Exponential backoff
  timeout: number           // Request timeout
  enableCache: boolean      // Cache toggle
  rateLimitMs: number       // Delay between requests
}
```

### Review Extraction Architecture

**Updated RT HTML Selectors**
```typescript
const RT_SELECTORS = {
  reviewContainer: '[data-qa="review-item"]',
  reviewerName: 'a[href*="/critics/"]',
  publication: '[data-qa="review-publication"]',
  reviewText: '.review-text',
  reviewDate: '[data-qa="review-date"]',
  externalLink: 'a[href*="http"]'
}
```

**Comprehensive Review Data**
```typescript
interface ReviewData {
  reviewer: string
  publication: string
  reviewText: string
  date: string
  externalUrl: string | null
  isTopCritic: boolean
}
```

## Security & Compliance

### Web Scraping Ethics
- **Terms of Service Compliance**: Review RT terms and adjust practices accordingly
- **Rate Limiting**: Respectful delays to avoid overwhelming RT servers
- **Caching Strategy**: Minimize repeated requests through intelligent caching
- **User Agent**: Proper browser simulation to avoid anti-bot measures
- **Data Usage**: Ethical use of scraped data for movie recommendation purposes

### Legal Considerations
- Regular review of RT terms of service
- Compliance with data usage policies
- Graceful degradation when scraping is unavailable
- User transparency about data sources

This enhanced technical foundation supports comprehensive movie data integration while maintaining ethical scraping practices and production reliability. 