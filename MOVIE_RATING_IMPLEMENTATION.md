# Movie Rating System Implementation

## Overview

This implementation adds a comprehensive movie rating system that integrates with The Movie Database (TMDB) API to provide rich movie information and allows users to rate movies based on AI-generated recommendations.

## Features Implemented

### 1. **TMDB API Integration** 
- **Service**: `src/lib/tmdb.ts`
- Searches movies by title
- Retrieves detailed movie information (poster, description, ratings, etc.)
- Handles batch movie searches for multiple titles
- Provides poster and backdrop image URLs

### 2. **Enhanced Recommendation API**
- **Route**: `src/app/api/generate-recommendations/route.ts`
- Now fetches TMDB data for each LLM recommendation
- Combines AI insights with real movie data
- Returns enriched recommendations with movie posters and details

### 3. **Movie Rating System**
- **API Route**: `src/app/api/save-movie-rating/route.ts`
- **Database Table**: `movie_ratings`
- **Rating Types**: 
  - ❤️ Love it
  - 👍 Like it  
  - 👎 Don't like
  - 🤷 Haven't seen
- Stores user ratings with movie metadata

### 4. **Movie Rating Interface**
- **Page**: `src/app/movie-recommendations/page.tsx`
- **Component**: Card-by-card movie rating interface
- **Features**:
  - Movie posters and descriptions
  - Progress tracking
  - Navigation between movies
  - Skip functionality
  - Real-time rating saving

### 5. **Loading States**
- **Component**: `src/components/LoadingSpinner.tsx`
- Movie-themed loading animations
- Loading overlay during recommendation generation
- Progress indicators

## Database Schema

```sql
CREATE TABLE public.movie_ratings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_movie_id INTEGER NOT NULL,
    movie_title TEXT NOT NULL,
    rating_type TEXT NOT NULL CHECK (rating_type IN ('like', 'dislike', 'love', 'not_seen')),
    movie_data JSONB, -- Store additional movie data from TMDB
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## User Flow

1. **Genre Preferences**: User selects genres and characteristics
2. **Loading State**: Shows movie-themed loading animation
3. **AI Processing**: LLM generates 20 movie recommendations
4. **TMDB Integration**: System fetches movie data for each recommendation
5. **Movie Rating**: User rates movies one by one with rich UI
6. **Data Storage**: Ratings saved to database with movie metadata
7. **Completion**: User redirected to dashboard

## Environment Variables Required

```env
# TMDB API Credentials (choose one)
NEXT_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_access_token
# OR
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key

# Existing Supabase and OpenAI variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

## Setup Instructions

### 1. Database Setup
Run the SQL from `database-setup.sql` in your Supabase SQL Editor to create the `movie_ratings` table.

### 2. Environment Variables
Add your TMDB API credentials to your `.env.local` file.

### 3. Dependencies
Already installed:
- `axios` for HTTP requests
- Existing Next.js and Supabase dependencies

## API Endpoints

### `/api/generate-recommendations` (Enhanced)
- **Method**: POST
- **Input**: `{ selectedGenres, selectedCharacteristics, userId }`
- **Output**: Enriched recommendations with TMDB data

### `/api/save-movie-rating` (New)
- **Method**: POST
- **Input**: `{ userId, tmdbMovieId, movieTitle, ratingType, movieData }`
- **Output**: Saved rating confirmation

- **Method**: GET
- **Input**: `?userId=user_id`
- **Output**: All user's movie ratings

## Error Handling

- Graceful handling of missing TMDB data
- Fallback displays for movies not found
- Comprehensive error logging
- User-friendly error messages

## Security

- Row Level Security (RLS) on movie_ratings table
- Users can only access their own ratings
- Input validation on rating types
- Protected API routes

## Future Enhancements

- Movie recommendation refinement based on ratings
- Analytics dashboard for user preferences
- Social features (sharing ratings)
- Integration with streaming service availability
- Enhanced movie filtering and search 