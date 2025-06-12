-- Safe migration that handles existing tables
-- This version checks if tables exist before creating them

-- Create genres table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.genres (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- emoji or icon identifier
  color TEXT, -- hex color for UI theming
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create genre_characteristics table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.genre_characteristics (
  id SERIAL PRIMARY KEY,
  genre_id INTEGER REFERENCES public.genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns to users table if they don't exist
DO $$ 
BEGIN
  -- Check and add selected_genres column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'selected_genres') THEN
    ALTER TABLE public.users ADD COLUMN selected_genres TEXT[];
  END IF;
  
  -- Check and add selected_characteristics column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'selected_characteristics') THEN
    ALTER TABLE public.users ADD COLUMN selected_characteristics TEXT[];
  END IF;
END $$;

-- Insert sample genres (only if they don't exist)
INSERT INTO public.genres (name, description, icon, color) 
SELECT * FROM (VALUES
  ('Action', 'High-energy movies and shows with intense sequences', '💥', '#ef4444'),
  ('Comedy', 'Funny content that makes you laugh', '😄', '#f59e0b'),
  ('Drama', 'Emotional storytelling with character development', '🎭', '#8b5cf6'),
  ('Horror', 'Scary and suspenseful content', '👻', '#1f2937'),
  ('Romance', 'Love stories and romantic relationships', '💕', '#ec4899'),
  ('Sci-Fi', 'Science fiction and futuristic concepts', '🚀', '#06b6d4'),
  ('Fantasy', 'Magical and mythical worlds', '🧙‍♂️', '#10b981'),
  ('Thriller', 'Suspenseful and edge-of-your-seat content', '🔥', '#dc2626'),
  ('Documentary', 'Educational and real-world content', '📚', '#059669'),
  ('Animation', 'Animated movies and shows', '🎨', '#f97316'),
  ('Crime', 'Detective stories and criminal investigations', '🕵️', '#374151'),
  ('Mystery', 'Puzzles and unknown elements to solve', '🔍', '#6366f1')
) AS v(name, description, icon, color)
WHERE NOT EXISTS (SELECT 1 FROM public.genres WHERE genres.name = v.name);

-- Insert sample characteristics for Action genre (only if they don't exist)
INSERT INTO public.genre_characteristics (genre_id, name, description)
SELECT genre_id, name, description FROM (
  SELECT 
    (SELECT id FROM public.genres WHERE name = 'Action') as genre_id,
    'Fast-paced' as name,
    'Quick cuts and rapid scene changes' as description
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Action'),
    'Martial Arts',
    'Hand-to-hand combat and fighting choreography'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Action'),
    'Car Chases',
    'High-speed vehicle pursuits'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Action'),
    'Explosions',
    'Big budget special effects and pyrotechnics'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Action'),
    'Superhero',
    'Characters with special powers'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Action'),
    'Military',
    'War and combat scenarios'
) AS action_chars
WHERE NOT EXISTS (
  SELECT 1 FROM public.genre_characteristics gc 
  WHERE gc.genre_id = action_chars.genre_id 
  AND gc.name = action_chars.name
);

-- Insert sample characteristics for Comedy genre (only if they don't exist)
INSERT INTO public.genre_characteristics (genre_id, name, description)
SELECT genre_id, name, description FROM (
  SELECT 
    (SELECT id FROM public.genres WHERE name = 'Comedy') as genre_id,
    'Slapstick' as name,
    'Physical comedy and visual gags' as description
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Comedy'),
    'Witty Dialogue',
    'Clever and humorous conversations'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Comedy'),
    'Romantic Comedy',
    'Love stories with comedic elements'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Comedy'),
    'Dark Comedy',
    'Humor in serious or taboo subjects'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Comedy'),
    'Parody',
    'Satirical takes on other genres or topics'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Comedy'),
    'Stand-up Style',
    'Comedy that feels like live performance'
) AS comedy_chars
WHERE NOT EXISTS (
  SELECT 1 FROM public.genre_characteristics gc 
  WHERE gc.genre_id = comedy_chars.genre_id 
  AND gc.name = comedy_chars.name
);

-- Insert sample characteristics for Drama genre (only if they don't exist)
INSERT INTO public.genre_characteristics (genre_id, name, description)
SELECT genre_id, name, description FROM (
  SELECT 
    (SELECT id FROM public.genres WHERE name = 'Drama') as genre_id,
    'Character Development' as name,
    'Deep exploration of personalities' as description
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Drama'),
    'Family Dynamics',
    'Relationships within families'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Drama'),
    'Historical',
    'Set in past time periods'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Drama'),
    'Biographical',
    'Based on real peoples lives'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Drama'),
    'Social Issues',
    'Addresses societal problems'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Drama'),
    'Coming of Age',
    'Stories about growing up'
) AS drama_chars
WHERE NOT EXISTS (
  SELECT 1 FROM public.genre_characteristics gc 
  WHERE gc.genre_id = drama_chars.genre_id 
  AND gc.name = drama_chars.name
);

-- Insert sample characteristics for Horror genre (only if they don't exist)
INSERT INTO public.genre_characteristics (genre_id, name, description)
SELECT genre_id, name, description FROM (
  SELECT 
    (SELECT id FROM public.genres WHERE name = 'Horror') as genre_id,
    'Jump Scares' as name,
    'Sudden frightening moments' as description
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Horror'),
    'Psychological',
    'Mental and emotional fear'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Horror'),
    'Supernatural',
    'Ghosts, demons, and otherworldly entities'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Horror'),
    'Slasher',
    'Killer stalking victims'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Horror'),
    'Body Horror',
    'Graphic and disturbing physical transformations'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Horror'),
    'Zombie',
    'Undead apocalypse scenarios'
) AS horror_chars
WHERE NOT EXISTS (
  SELECT 1 FROM public.genre_characteristics gc 
  WHERE gc.genre_id = horror_chars.genre_id 
  AND gc.name = horror_chars.name
);

-- Insert sample characteristics for Sci-Fi genre (only if they don't exist)
INSERT INTO public.genre_characteristics (genre_id, name, description)
SELECT genre_id, name, description FROM (
  SELECT 
    (SELECT id FROM public.genres WHERE name = 'Sci-Fi') as genre_id,
    'Space Travel' as name,
    'Interstellar journeys and alien worlds' as description
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Sci-Fi'),
    'Time Travel',
    'Moving through different time periods'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Sci-Fi'),
    'Dystopian',
    'Dark futuristic societies'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Sci-Fi'),
    'AI/Robots',
    'Artificial intelligence and robotic characters'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Sci-Fi'),
    'Cyberpunk',
    'High-tech, low-life future scenarios'
  UNION ALL SELECT 
    (SELECT id FROM public.genres WHERE name = 'Sci-Fi'),
    'Hard Science',
    'Scientifically accurate concepts'
) AS scifi_chars
WHERE NOT EXISTS (
  SELECT 1 FROM public.genre_characteristics gc 
  WHERE gc.genre_id = scifi_chars.genre_id 
  AND gc.name = scifi_chars.name
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_genre_characteristics_genre_id ON public.genre_characteristics(genre_id);
CREATE INDEX IF NOT EXISTS idx_genres_name ON public.genres(name);

-- Create GIN indexes if they don't exist (these might fail if columns don't exist yet, so we'll ignore errors)
DO $$ 
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_users_selected_genres ON public.users USING GIN(selected_genres);
  EXCEPTION WHEN OTHERS THEN
    -- Ignore error if column doesn't exist
    NULL;
  END;
  
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_users_selected_characteristics ON public.users USING GIN(selected_characteristics);
  EXCEPTION WHEN OTHERS THEN
    -- Ignore error if column doesn't exist
    NULL;
  END;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genre_characteristics ENABLE ROW LEVEL SECURITY;

-- Create policies (with IF NOT EXISTS equivalent)
DO $$ 
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'genres' AND policyname = 'Genres are publicly readable') THEN
    EXECUTE 'CREATE POLICY "Genres are publicly readable" ON public.genres FOR SELECT USING (true)';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'genre_characteristics' AND policyname = 'Genre characteristics are publicly readable') THEN
    EXECUTE 'CREATE POLICY "Genre characteristics are publicly readable" ON public.genre_characteristics FOR SELECT USING (true)';
  END IF;
END $$; 