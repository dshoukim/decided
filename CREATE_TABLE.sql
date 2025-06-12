-- Run this SQL in your Supabase SQL Editor to create the streaming_services table

-- Create streaming_services table
CREATE TABLE public.streaming_services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    website_url TEXT,
    description TEXT,
    monthly_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_streaming_services_name ON public.streaming_services(name);
CREATE INDEX idx_streaming_services_active ON public.streaming_services(is_active);

-- Enable Row Level Security
ALTER TABLE public.streaming_services ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
CREATE POLICY "Allow read access to streaming services" ON public.streaming_services
    FOR SELECT USING (true);

-- Allow full access for authenticated users
CREATE POLICY "Allow full access for authenticated users" ON public.streaming_services
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert popular streaming services
INSERT INTO public.streaming_services (name, logo_url, website_url, description, monthly_price) VALUES
('Netflix', 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png', 'https://netflix.com', 'Movies, TV shows, and original content', 15.49),
('Disney+', 'https://upload.wikimedia.org/wikipedia/commons/3/36/Disney%2B_logo.svg', 'https://disneyplus.com', 'Disney, Marvel, Star Wars, and more', 13.99),
('Amazon Prime Video', 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg', 'https://primevideo.com', 'Movies, TV shows, and Amazon Originals', 8.99),
('Hulu', 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg', 'https://hulu.com', 'TV shows, movies, and live TV', 14.99),
('HBO Max', 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg', 'https://hbomax.com', 'HBO content, movies, and originals', 14.99),
('Apple TV+', 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg', 'https://tv.apple.com', 'Apple original movies and TV shows', 6.99),
('Paramount+', 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus_logo.svg', 'https://paramountplus.com', 'CBS, Paramount movies, and originals', 5.99),
('Peacock', 'https://upload.wikimedia.org/wikipedia/commons/d/d3/NBCUniversal_Peacock_Logo.svg', 'https://peacocktv.com', 'NBCUniversal content and originals', 5.99),
('Spotify', 'https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg', 'https://spotify.com', 'Music streaming and podcasts', 10.99),
('Apple Music', 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Apple_Music_icon.svg', 'https://music.apple.com', 'Music streaming service', 10.99),
('YouTube TV', 'https://upload.wikimedia.org/wikipedia/commons/f/fc/YouTube_TV_logo.svg', 'https://tv.youtube.com', 'Live TV streaming service', 64.99),
('YouTube Music', 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Youtube_Music_icon.svg', 'https://music.youtube.com', 'Music streaming from YouTube', 9.99),
('ESPN+', 'https://upload.wikimedia.org/wikipedia/commons/5/51/ESPN%2B_logo.svg', 'https://espnplus.com', 'Sports streaming and exclusive content', 9.99),
('Crunchyroll', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.png', 'https://crunchyroll.com', 'Anime streaming service', 7.99),
('Tubi', 'https://upload.wikimedia.org/wikipedia/commons/3/34/Tubi_logo.svg', 'https://tubitv.com', 'Free movies and TV shows', 0.00),
('Pluto TV', 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Pluto_TV_logo.svg', 'https://pluto.tv', 'Free live TV and on-demand', 0.00);

-- Verify the data was inserted
SELECT name, monthly_price, description FROM public.streaming_services ORDER BY name; 

-- Create movie_ratings table for storing user movie preferences
CREATE TABLE public.movie_ratings (
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
CREATE INDEX idx_movie_ratings_user_id ON public.movie_ratings(user_id);
CREATE INDEX idx_movie_ratings_tmdb_id ON public.movie_ratings(tmdb_movie_id);
CREATE INDEX idx_movie_ratings_rating_type ON public.movie_ratings(rating_type);
CREATE UNIQUE INDEX idx_movie_ratings_user_movie ON public.movie_ratings(user_id, tmdb_movie_id);

-- Enable Row Level Security
ALTER TABLE public.movie_ratings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own ratings
CREATE POLICY "Users can view their own movie ratings" ON public.movie_ratings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own movie ratings" ON public.movie_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own movie ratings" ON public.movie_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own movie ratings" ON public.movie_ratings
    FOR DELETE USING (auth.uid() = user_id); 