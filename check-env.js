import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

console.log('🔍 Checking Environment Variables from .env.local\n');

console.log('PostHog Key exists:', !!process.env.NEXT_PUBLIC_POSTHOG_KEY);
console.log('PostHog Host exists:', !!process.env.NEXT_PUBLIC_POSTHOG_HOST);

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  console.log('PostHog Key starts with:', process.env.NEXT_PUBLIC_POSTHOG_KEY.substring(0, 12) + '...');
}

if (process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  console.log('PostHog Host:', process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

// Also check the other variables for comparison
console.log('\nOther environment variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL); 