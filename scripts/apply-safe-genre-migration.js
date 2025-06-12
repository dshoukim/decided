import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function applySafeGenreMigration() {
  try {
    console.log('🔧 Safe Genre Migration (handles existing tables)');
    console.log('This version will not fail if tables already exist!\n');
    
    const migration = fs.readFileSync('migrations/003_create_genres_and_characteristics_safe.sql', 'utf8');
    
    console.log('📄 Safe SQL to run in Supabase Dashboard:');
    console.log('Go to: https://supabase.com/dashboard/project/[your-project]/sql');
    console.log('Clear the editor and run this SQL:');
    console.log('==========================================');
    console.log(migration);
    console.log('==========================================');
    console.log('\n✅ This migration safely handles:');
    console.log('• Existing tables (uses CREATE TABLE IF NOT EXISTS)');
    console.log('• Existing columns (checks before adding)');
    console.log('• Existing data (only inserts missing records)');
    console.log('• Existing indexes and policies');
    console.log('\n🎬 After running this, your genre preferences will work!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

applySafeGenreMigration(); 