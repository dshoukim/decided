# Watch List Feature Documentation

## Overview

The Watch List feature allows users to:
- **Auto-populate** movies marked as "haven't seen" from their movie survey
- **Search and add** new movies using TMDB API integration
- **View detailed movie information** including posters, descriptions, ratings, and streaming platforms
- **Add personal notes** about why they want to watch each movie
- **Track watched status** and manage their viewing progress
- **Remove movies** from their watch list

## Features

### 🎯 Core Functionality

1. **Auto-Population from Survey**
   - Automatically adds movies rated as "not_seen" from movie preferences survey
   - Shows notification when movies are auto-added
   - Prevents duplicates when adding movies

2. **Movie Search**
   - Real-time search using TMDB API
   - Autocomplete dropdown with movie suggestions
   - Shows movie posters, titles, release years, ratings, and descriptions
   - Debounced search (300ms) for performance

3. **Movie Details Modal**
   - Full movie information display
   - Streaming platform availability (where supported by TMDB)
   - Personal note input for adding context
   - Beautiful responsive design

4. **Watch List Management**
   - Grid view of movies with poster cards
   - Separate sections for "Movies to Watch" and "Watched Movies"
   - Mark as watched/unwatched functionality
   - Remove from watch list option
   - Personal notes display

### 🗄️ Database Schema

**watch_list table:**
```sql
CREATE TABLE watch_list (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_movie_id INTEGER NOT NULL,
    movie_title TEXT NOT NULL,
    movie_data JSONB, -- Movie metadata from TMDB
    user_note TEXT, -- Personal note about why they want to watch
    added_from TEXT NOT NULL CHECK (added_from IN ('survey', 'search', 'manual')),
    is_watched BOOLEAN DEFAULT FALSE,
    watched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes and Security:**
- Unique constraint on (user_id, tmdb_movie_id)
- Row Level Security (RLS) enabled
- Users can only access their own watch list items

### 🔌 API Endpoints

#### 1. `/api/watch-list`
- **GET**: Fetch user's watch list
  - Query params: `userId`
  - Returns: Array of watch list items with metadata

- **POST**: Add movie to watch list
  - Body: `userId`, `tmdbMovieId`, `movieTitle`, `movieData`, `userNote`, `addedFrom`
  - Features: Upsert functionality to prevent duplicates

- **PUT**: Update watch list item (mark as watched, update note)
  - Body: `userId`, `tmdbMovieId`, `isWatched`, `userNote`

- **DELETE**: Remove movie from watch list
  - Query params: `userId`, `tmdbMovieId`

#### 2. `/api/populate-watch-list`
- **POST**: Auto-populate from survey results
  - Body: `userId`
  - Finds movies rated as "not_seen" and adds to watch list
  - Prevents duplicates and returns count of added movies

#### 3. `/api/search-movies`
- **GET**: Search movies using TMDB
  - Query params: `query`, `page` (optional)
  - Returns: Paginated movie search results

#### 4. `/api/streaming-providers`
- **GET**: Get streaming platform information
  - Query params: `movieId`, `region` (optional, defaults to 'US')
  - Returns: Available streaming platforms for the movie

### 🎨 Components

#### 1. `WatchList.tsx` - Main Component
- Manages overall watch list state and functionality
- Handles auto-population from survey
- Integrates search, modal, and list management
- Responsive grid layout for movie cards

#### 2. `MovieSearch.tsx` - Search Component
- Real-time movie search with autocomplete
- Debounced API calls for performance
- Click-outside handling for dropdown
- Loading states and error handling

#### 3. `MovieDetailModal.tsx` - Detail Modal
- Full-screen movie detail display
- Streaming platform integration
- Personal note input and management
- Add to watch list functionality

#### 4. `WatchListCard.tsx` - Movie Card
- Individual movie display in grid
- Poster image with fallback
- Watch status indicators
- Action buttons (view, mark watched, remove)

### 🔧 TMDB Integration Enhancements

Enhanced the existing TMDB service with:

1. **Streaming Providers**: `getStreamingProviders(movieId, region)`
2. **Detailed Search**: `searchMoviesDetailed(query, page)`
3. **Popular Movies**: `getPopularMovies(page)`
4. **Trending Movies**: `getTrendingMovies(timeWindow)`

### 🎯 Dashboard Integration

The watch list is prominently featured on the dashboard:
- Full-width section above user info cards
- Auto-runs on dashboard load
- Suggests movie survey completion for new users
- Integrated with existing user authentication

### 💡 User Experience Features

1. **Smart Auto-Population**
   - One-time notification when movies are auto-added
   - Prevents re-adding movies already in watch list
   - Graceful handling when no survey data exists

2. **Visual Feedback**
   - Loading spinners during API calls
   - Success notifications for actions
   - Confirmation dialogs for destructive actions
   - Empty states with helpful guidance

3. **Responsive Design**
   - Mobile-friendly movie cards
   - Responsive grid layout (1-4 columns based on screen size)
   - Touch-friendly button sizing
   - Optimized modal for mobile viewing

### 🚀 Getting Started

1. **Database Setup**
   ```bash
   # Run the database setup SQL
   psql -h your-supabase-host -U postgres -d postgres -f database-setup.sql
   ```

2. **Environment Variables**
   Ensure you have TMDB API access configured:
   ```env
   NEXT_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_bearer_token
   # OR
   NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
   ```

3. **Usage Flow**
   - User completes movie survey → Movies auto-added to watch list
   - User can search and add additional movies
   - User manages watch list from dashboard
   - User tracks viewing progress over time

### 🔮 Future Enhancements

1. **Enhanced Streaming Data**
   - Integration with JustWatch API for better streaming platform data
   - Price tracking for rental/purchase options
   - Regional availability improvements

2. **Social Features**
   - Share watch lists with friends
   - Collaborative watch lists
   - Movie recommendations based on friends' lists

3. **Advanced Organization**
   - Custom tags and categories
   - Priority/rating system
   - Watch list folders/collections
   - Export functionality

4. **Smart Features**
   - AI-powered similar movie suggestions
   - Watch time estimation
   - Mood-based filtering
   - Release date notifications

### 🐛 Troubleshooting

**Common Issues:**

1. **TMDB API Errors**: Verify environment variables are correctly set
2. **Database Permissions**: Ensure RLS policies are properly configured
3. **Auto-Population Not Working**: Check that movie_ratings table has "not_seen" entries
4. **Streaming Data Missing**: This is expected - TMDB has limited streaming provider data

**Debug Steps:**
1. Check browser console for API errors
2. Verify Supabase connection and authentication
3. Test TMDB API access independently
4. Check database table structure and data

### 📊 Performance Considerations

1. **API Optimization**
   - Debounced search prevents excessive API calls
   - Cached TMDB responses where appropriate
   - Batch operations for database updates

2. **Image Loading**
   - Optimized poster image sizes
   - Fallback images for missing posters
   - Lazy loading for large watch lists

3. **Database Efficiency**
   - Proper indexing on search columns
   - Efficient query patterns
   - Row-level security for data isolation

The watch list feature provides a comprehensive movie management experience that integrates seamlessly with the existing survey and recommendation system. 