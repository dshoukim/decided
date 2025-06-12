import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function applyGenreMigration() {
  try {
    console.log('🎬 Applying genre migration...');
    
    const migration = fs.readFileSync('migrations/003_create_genres_and_characteristics.sql', 'utf8');
    
    console.log('📄 SQL to run in Supabase Dashboard:');
    console.log('Go to: https://supabase.com/dashboard/project/[your-project]/sql');
    console.log('Run this SQL:');
    console.log('----------------------------------------');
    console.log(migration);
    console.log('----------------------------------------');
    console.log('\n✅ After running the SQL, the genre preferences flow will be ready!');
    console.log('\n📋 New flow:');
    console.log('1. Profile Setup → /profile-setup');
    console.log('2. Streaming Services → /streaming-preferences');
    console.log('3. Genre Preferences → /genre-preferences');
    console.log('4. Dashboard → /dashboard');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

applyGenreMigration(); 