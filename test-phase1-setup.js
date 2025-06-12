import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPhase1Setup() {
  console.log('🔍 Testing Phase 1 Implementation...\n');

  // Test 1: Database Connection
  console.log('1. Testing Database Connection...');
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return;
  }

  // Test 2: Check for Decided Tables
  console.log('\n2. Checking Decided Tables...');
  const requiredTables = ['rooms', 'room_participants', 'bracket_picks', 'user_movie_elo', 'room_history'];
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        console.log(`❌ Table '${table}' does not exist`);
      } else if (error) {
        console.log(`⚠️  Table '${table}' exists but query failed:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists and accessible`);
      }
    } catch (error) {
      console.log(`❌ Error checking table '${table}':`, error.message);
    }
  }

  // Test 3: Check watch_list consolidation
  console.log('\n3. Checking watch_list consolidation...');
  try {
    const { data, error } = await supabase
      .from('watch_list')
      .select('rating, liked, review, is_watched, decided_together_room_id, pending_rating')
      .limit(1);
    
    if (error) {
      console.log('❌ watch_list consolidation incomplete:', error.message);
    } else {
      console.log('✅ watch_list consolidation fields present');
    }
  } catch (error) {
    console.log('❌ Error checking watch_list:', error.message);
  }

  // Test 4: Environment Variables
  console.log('\n4. Checking Environment Variables...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar} is set`);
    } else {
      console.log(`❌ ${envVar} is missing`);
    }
  }

  // Test 5: PostHog Configuration (optional)
  console.log('\n5. Checking PostHog Configuration...');
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    console.log('✅ NEXT_PUBLIC_POSTHOG_KEY is set');
  } else {
    console.log('⚠️  NEXT_PUBLIC_POSTHOG_KEY is not set (optional)');
  }

  if (process.env.NEXT_PUBLIC_POSTHOG_HOST) {
    console.log('✅ NEXT_PUBLIC_POSTHOG_HOST is set');
  } else {
    console.log('ℹ️  NEXT_PUBLIC_POSTHOG_HOST not set (will use default)');
  }

  // Test 6: Realtime Connection
  console.log('\n6. Testing Realtime Connection...');
  try {
    const channel = supabase.channel('test-phase1-setup');
    
    const subscribed = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });

    if (subscribed) {
      console.log('✅ Realtime connection successful');
      await channel.unsubscribe();
    } else {
      console.log('❌ Realtime connection failed');
    }
  } catch (error) {
    console.log('❌ Realtime test error:', error.message);
  }

  console.log('\n🎉 Phase 1 Implementation Test Complete!\n');
}

// Run the test
testPhase1Setup().catch(console.error); 