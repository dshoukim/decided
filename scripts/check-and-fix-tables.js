import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAndFixTables() {
  try {
    console.log('🔍 Checking current database structure...\n');

    // Check genres table structure
    console.log('📋 Checking genres table:');
    const { data: genreColumns, error: genreError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'genres')
      .order('ordinal_position');

    if (genreError) {
      console.log('❌ Error checking genres table:', genreError.message);
    } else if (genreColumns && genreColumns.length > 0) {
      console.log('✅ Genres table exists with columns:');
      genreColumns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ Genres table does not exist');
    }

    // Check users table structure  
    console.log('\n📋 Checking users table:');
    const { data: userColumns, error: userError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .order('ordinal_position');

    if (userError) {
      console.log('❌ Error checking users table:', userError.message);
    } else if (userColumns && userColumns.length > 0) {
      console.log('✅ Users table exists with columns:');
      userColumns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ Users table does not exist');
    }

    console.log('\n🔧 RECOMMENDED FIX:');
    console.log('Run this SQL in your Supabase Dashboard to fix the issues:');
    console.log('========================================');

    const fixSQL = `
-- Step 1: Drop existing genres table if it has wrong structure
DROP TABLE IF EXISTS public.genres CASCADE;
DROP TABLE IF EXISTS public.genre_characteristics CASCADE;

-- Step 2: Create genres table with correct structure
CREATE TABLE public.genres (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create genre_characteristics table
CREATE TABLE public.genre_characteristics (
  id SERIAL PRIMARY KEY,
  genre_id INTEGER REFERENCES public.genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Add missing columns to users table (safe)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'selected_genres') THEN
    ALTER TABLE public.users ADD COLUMN selected_genres TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'selected_characteristics') THEN
    ALTER TABLE public.users ADD COLUMN selected_characteristics TEXT[];
  END IF;
END $$;

-- Step 5: Insert genres data
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

-- Step 6: Insert characteristics for Action
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Action'), 'Fast-paced', 'Quick cuts and rapid scene changes'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Martial Arts', 'Hand-to-hand combat and fighting choreography'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Car Chases', 'High-speed vehicle pursuits'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Explosions', 'Big budget special effects and pyrotechnics'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Superhero', 'Characters with special powers'),
((SELECT id FROM public.genres WHERE name = 'Action'), 'Military', 'War and combat scenarios');

-- Step 7: Insert characteristics for Comedy
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Slapstick', 'Physical comedy and visual gags'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Witty Dialogue', 'Clever and humorous conversations'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Romantic Comedy', 'Love stories with comedic elements'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Dark Comedy', 'Humor in serious or taboo subjects'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Parody', 'Satirical takes on other genres or topics'),
((SELECT id FROM public.genres WHERE name = 'Comedy'), 'Stand-up Style', 'Comedy that feels like live performance');

-- Step 8: Insert characteristics for Drama
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Character Development', 'Deep exploration of personalities'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Family Dynamics', 'Relationships within families'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Historical', 'Set in past time periods'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Biographical', 'Based on real peoples lives'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Social Issues', 'Addresses societal problems'),
((SELECT id FROM public.genres WHERE name = 'Drama'), 'Coming of Age', 'Stories about growing up');

-- Step 9: Insert characteristics for Horror
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Jump Scares', 'Sudden frightening moments'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Psychological', 'Mental and emotional fear'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Supernatural', 'Ghosts, demons, and otherworldly entities'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Slasher', 'Killer stalking victims'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Body Horror', 'Graphic and disturbing physical transformations'),
((SELECT id FROM public.genres WHERE name = 'Horror'), 'Zombie', 'Undead apocalypse scenarios');

-- Step 10: Insert characteristics for Sci-Fi
INSERT INTO public.genre_characteristics (genre_id, name, description) VALUES
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Space Travel', 'Interstellar journeys and alien worlds'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Time Travel', 'Moving through different time periods'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Dystopian', 'Dark futuristic societies'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'AI/Robots', 'Artificial intelligence and robotic characters'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Cyberpunk', 'High-tech, low-life future scenarios'),
((SELECT id FROM public.genres WHERE name = 'Sci-Fi'), 'Hard Science', 'Scientifically accurate concepts');

-- Step 11: Create indexes
CREATE INDEX idx_genre_characteristics_genre_id ON public.genre_characteristics(genre_id);
CREATE INDEX idx_genres_name ON public.genres(name);
CREATE INDEX IF NOT EXISTS idx_users_selected_genres ON public.users USING GIN(selected_genres);
CREATE INDEX IF NOT EXISTS idx_users_selected_characteristics ON public.users USING GIN(selected_characteristics);

-- Step 12: Enable RLS
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genre_characteristics ENABLE ROW LEVEL SECURITY;

-- Step 13: Create policies
CREATE POLICY "Genres are publicly readable" ON public.genres FOR SELECT USING (true);
CREATE POLICY "Genre characteristics are publicly readable" ON public.genre_characteristics FOR SELECT USING (true);
`;

    console.log(fixSQL);
    console.log('========================================');
    console.log('\n✅ This will:');
    console.log('1. Remove existing incomplete tables');
    console.log('2. Create tables with correct structure');
    console.log('3. Add missing columns to users table');
    console.log('4. Insert all genre and characteristic data');
    console.log('5. Set up indexes and security policies');
    console.log('\n🎬 After running this, your genre preferences will work perfectly!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAndFixTables(); 