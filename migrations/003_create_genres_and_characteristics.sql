-- Create genres table
CREATE TABLE public.genres (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- emoji or icon identifier
  color TEXT, -- hex color for UI theming
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create genre_characteristics table
CREATE TABLE public.genre_characteristics (
  id SERIAL PRIMARY KEY,
  genre_id INTEGER REFERENCES public.genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update users table to include genre preferences
ALTER TABLE public.users 
ADD COLUMN selected_genres TEXT[], -- Array of genre IDs
ADD COLUMN selected_characteristics TEXT[]; -- Array of characteristic IDs

-- Insert sample genres
INSERT INTO public.genres (name, description, icon, color) VALUES
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
('Mystery', 'Puzzles and unknown elements to solve', '🔍', '#6366f1');

-- Insert sample characteristics for Action genre
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Action'), 'Fast-paced', 'Quick cuts and rapid scene changes'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Martial Arts', 'Hand-to-hand combat and fighting choreography'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Car Chases', 'High-speed vehicle pursuits'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Explosions', 'Big budget special effects and pyrotechnics'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Superhero', 'Characters with special powers'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Military', 'War and combat scenarios');

-- Insert sample characteristics for Comedy genre
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Slapstick', 'Physical comedy and visual gags'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Witty Dialogue', 'Clever and humorous conversations'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Romantic Comedy', 'Love stories with comedic elements'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Dark Comedy', 'Humor in serious or taboo subjects'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Parody', 'Satirical takes on other genres or topics'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Stand-up Style', 'Comedy that feels like live performance');

-- Insert sample characteristics for Drama genre
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Character Development', 'Deep exploration of personalities'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Family Dynamics', 'Relationships within families'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Historical', 'Set in past time periods'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Biographical', 'Based on real peoples lives'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Social Issues', 'Addresses societal problems'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Coming of Age', 'Stories about growing up');

-- Insert sample characteristics for Horror genre
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Jump Scares', 'Sudden frightening moments'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Psychological', 'Mental and emotional fear'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Supernatural', 'Ghosts, demons, and otherworldly entities'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Slasher', 'Killer stalking victims'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Body Horror', 'Graphic and disturbing physical transformations'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Zombie', 'Undead apocalypse scenarios');

-- Insert sample characteristics for Sci-Fi genre
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Space Travel', 'Interstellar journeys and alien worlds'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Time Travel', 'Moving through different time periods'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Dystopian', 'Dark futuristic societies'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'AI/Robots', 'Artificial intelligence and robotic characters'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Cyberpunk', 'High-tech, low-life future scenarios'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Hard Science', 'Scientifically accurate concepts');

-- Create indexes for better performance
CREATE INDEX idx_genre_characteristics_genre_id ON public.genre_characteristics(genre_id);
CREATE INDEX idx_genres_name ON public.genres(name);
CREATE INDEX idx_users_selected_genres ON public.users USING GIN(selected_genres);
CREATE INDEX idx_users_selected_characteristics ON public.users USING GIN(selected_characteristics);

-- Enable RLS on new tables
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genre_characteristics ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (anyone can see genres and characteristics)
CREATE POLICY "Genres are publicly readable" ON public.genres
  FOR SELECT USING (true);

CREATE POLICY "Genre characteristics are publicly readable" ON public.genre_characteristics
  FOR SELECT USING (true); 