import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function setupUsersTable() {
  try {
    console.log('🔍 Checking current users table...');
    
    // Check if users table exists and its structure
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users');
    
    if (tablesError) {
      console.log('Error checking tables:', tablesError.message);
    } else {
      console.log('Tables found:', tables);
    }

    // Try to check table structure
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'users');
    
    if (columnsError) {
      console.log('Error checking columns:', columnsError.message);
    } else {
      console.log('Current users table structure:', columns);
    }

    console.log('\n📄 SQL to run in Supabase Dashboard:');
    console.log('Go to: https://supabase.com/dashboard/project/[your-project]/sql');
    console.log('Run this SQL:');
    console.log('----------------------------------------');
    
    const migration = fs.readFileSync('migrations/002_create_users_table.sql', 'utf8');
    console.log(`-- First drop existing table
DROP TABLE IF EXISTS public.users CASCADE;

${migration}`);
    
    console.log('----------------------------------------');
    console.log('\n✅ After running the SQL, try the profile setup again!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

setupUsersTable(); 