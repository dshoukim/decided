-- First, add new columns to watch_list
ALTER TABLE watch_list 
ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 10),
ADD COLUMN liked BOOLEAN,
ADD COLUMN review TEXT,
ADD COLUMN watched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_watched BOOLEAN DEFAULT false,
ADD COLUMN decided_together_room_id UUID REFERENCES rooms(id),
ADD COLUMN pending_rating BOOLEAN DEFAULT false;

-- Migrate existing ratings data
UPDATE watch_list wl
SET 
  rating = mr.rating,
  liked = mr.liked,
  review = mr.review,
  watched_at = mr.created_at,
  is_watched = true
FROM movie_ratings mr
WHERE wl.user_id = mr.user_id 
  AND wl.movie_id = mr.movie_id;

-- Insert movies that were rated but not in watchlist
INSERT INTO watch_list (user_id, movie_id, title, poster_path, rating, liked, review, watched_at, is_watched, created_at)
SELECT 
  mr.user_id,
  mr.movie_id,
  mr.title,
  mr.poster_path,
  mr.rating,
  mr.liked,
  mr.review,
  mr.created_at,
  true,
  mr.created_at
FROM movie_ratings mr
LEFT JOIN watch_list wl ON mr.user_id = wl.user_id AND mr.movie_id = wl.movie_id
WHERE wl.id IS NULL;

-- Create views for easier querying
CREATE VIEW unwatched_movies AS
SELECT * FROM watch_list 
WHERE is_watched = false OR is_watched IS NULL;

CREATE VIEW watched_movies AS
SELECT * FROM watch_list 
WHERE is_watched = true;

CREATE VIEW rated_movies AS
SELECT * FROM watch_list 
WHERE rating IS NOT NULL;

CREATE VIEW pending_ratings AS
SELECT * FROM watch_list 
WHERE is_watched = true AND rating IS NULL;

CREATE VIEW collaborative_watches AS
SELECT * FROM watch_list 
WHERE decided_together_room_id IS NOT NULL;

-- Add indexes for new columns
CREATE INDEX idx_watch_list_is_watched ON watch_list(is_watched);
CREATE INDEX idx_watch_list_rating ON watch_list(rating);
CREATE INDEX idx_watch_list_pending_rating ON watch_list(pending_rating) WHERE pending_rating = true;
CREATE INDEX idx_watch_list_decided_together ON watch_list(decided_together_room_id); 