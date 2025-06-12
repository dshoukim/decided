-- Create movie_ratings table for storing user movie preferences
CREATE TABLE IF NOT EXISTS public.movie_ratings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_movie_id INTEGER NOT NULL,
    movie_title TEXT NOT NULL,
    rating_type TEXT NOT NULL CHECK (rating_type IN ('like', 'dislike', 'love', 'not_seen')),
    movie_data JSONB, -- Store additional movie data from TMDB (poster, description, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_movie_ratings_user_id ON public.movie_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_ratings_tmdb_id ON public.movie_ratings(tmdb_movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_ratings_rating_type ON public.movie_ratings(rating_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_ratings_user_movie ON public.movie_ratings(user_id, tmdb_movie_id);

-- Enable Row Level Security
ALTER TABLE public.movie_ratings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own ratings
CREATE OR REPLACE POLICY "Users can view their own movie ratings" 
ON "public"."movie_ratings"
AS PERMISSIVE 
FOR SELECT 
TO public 
USING ((auth.uid() = user_id));

CREATE OR REPLACE POLICY "Users can insert their own movie ratings" 
ON "public"."movie_ratings"
AS PERMISSIVE 
FOR INSERT 
TO public 
WITH CHECK ((auth.uid() = user_id));

CREATE OR REPLACE POLICY "Users can update their own movie ratings" 
ON "public"."movie_ratings"
AS PERMISSIVE 
FOR UPDATE 
TO public 
USING ((auth.uid() = user_id))
WITH CHECK ((auth.uid() = user_id));

CREATE OR REPLACE POLICY "Users can delete their own movie ratings" 
ON "public"."movie_ratings"
AS PERMISSIVE 
FOR DELETE 
TO public 
USING ((auth.uid() = user_id));

-- Create watch_list table for storing user's movies they want to watch
CREATE TABLE IF NOT EXISTS public.watch_list (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_movie_id INTEGER NOT NULL,
    movie_title TEXT NOT NULL,
    movie_data JSONB, -- Store movie data from TMDB (poster, description, ratings, etc.)
    user_note TEXT, -- User's personal note about why they want to watch this
    added_from TEXT NOT NULL CHECK (added_from IN ('survey', 'search', 'manual')),
    is_watched BOOLEAN DEFAULT FALSE, -- Track if they've watched it yet
    watched_at TIMESTAMP WITH TIME ZONE, -- When they marked it as watched
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_watch_list_user_id ON public.watch_list(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_list_tmdb_id ON public.watch_list(tmdb_movie_id);
CREATE INDEX IF NOT EXISTS idx_watch_list_added_from ON public.watch_list(added_from);
CREATE INDEX IF NOT EXISTS idx_watch_list_is_watched ON public.watch_list(is_watched);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_list_user_movie ON public.watch_list(user_id, tmdb_movie_id);

-- Enable Row Level Security
ALTER TABLE public.watch_list ENABLE ROW LEVEL SECURITY;

-- Users can only access their own watch list
CREATE OR REPLACE POLICY "Users can view their own watch list" 
ON "public"."watch_list"
AS PERMISSIVE 
FOR SELECT 
TO public 
USING ((auth.uid() = user_id));

CREATE OR REPLACE POLICY "Users can insert their own watch list items" 
ON "public"."watch_list"
AS PERMISSIVE 
FOR INSERT 
TO public 
WITH CHECK ((auth.uid() = user_id));

CREATE OR REPLACE POLICY "Users can update their own watch list items" 
ON "public"."watch_list"
AS PERMISSIVE 
FOR UPDATE 
TO public 
USING ((auth.uid() = user_id))
WITH CHECK ((auth.uid() = user_id));

CREATE OR REPLACE POLICY "Users can delete their own watch list items" 
ON "public"."watch_list"
AS PERMISSIVE 
FOR DELETE 
TO public 
USING ((auth.uid() = user_id)); 