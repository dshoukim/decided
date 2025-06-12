-- Add user_note column to movie_ratings table
ALTER TABLE public.movie_ratings 
ADD COLUMN IF NOT EXISTS user_note TEXT; 