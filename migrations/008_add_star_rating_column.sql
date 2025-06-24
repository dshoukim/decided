-- Migration to add star_rating column to movie_ratings table
-- This allows users to rate movies with 1-5 stars in addition to categorical ratings

-- Add star_rating column
ALTER TABLE public.movie_ratings 
ADD COLUMN IF NOT EXISTS star_rating INTEGER;

-- Add check constraint for star rating (1-5)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'star_rating_check' 
        AND conrelid = 'public.movie_ratings'::regclass
    ) THEN
        ALTER TABLE public.movie_ratings 
        ADD CONSTRAINT star_rating_check 
        CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5));
    END IF;
END
$$;

-- Update the existing rating_type check constraint to include 'star'
ALTER TABLE public.movie_ratings 
DROP CONSTRAINT IF EXISTS movie_ratings_rating_type_check;

ALTER TABLE public.movie_ratings 
ADD CONSTRAINT movie_ratings_rating_type_check 
CHECK (rating_type IN ('like', 'dislike', 'love', 'not_seen', 'star'));

-- Add index for star ratings for better query performance
CREATE INDEX IF NOT EXISTS idx_movie_ratings_star_rating 
ON public.movie_ratings(star_rating);

-- Add index on combination of user_id and star_rating for user rating queries
CREATE INDEX IF NOT EXISTS idx_movie_ratings_user_star 
ON public.movie_ratings(user_id, star_rating) 
WHERE star_rating IS NOT NULL; 