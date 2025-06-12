import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
console.log(`Loading .env.local file from: ${envPath}`);
dotenv.config({ path: envPath });

import { db } from '../src/db';
import { watchList, movieRatings } from '../src/db/schema';
import { sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

// This is a script to analyze the current database structure.
// It is not part of the main application and should be run from the command line.

async function analyzeCurrentStructure() {
  console.log('Analyzing database structure...');

  try {
    // Get counts
    const watchListCountResult = await db.select({ count: sql<number>`count(*)` }).from(watchList);
    const watchListCount = watchListCountResult[0]?.count || 0;

    const ratingsCountResult = await db.select({ count: sql<number>`count(*)` }).from(movieRatings);
    const ratingsCount = ratingsCountResult[0]?.count || 0;

    console.log(`- Found ${watchListCount} records in watch_list.`);
    console.log(`- Found ${ratingsCount} records in movie_ratings.`);

    // Check for overlapping data
    if (ratingsCount > 0) {
      const overlappingRecords = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM movie_ratings mr
        INNER JOIN watch_list wl ON mr.movie_id = wl.movie_id AND mr.user_id = wl.user_id
      `);
      const overlapCount = (overlappingRecords[0] as any)?.count || 0;
      console.log(`- Found ${overlapCount} movies that are both in watch_list and have ratings.`);
    }

    // Check for orphaned ratings
    if (ratingsCount > 0) {
      const orphanedRatings = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM movie_ratings mr
        LEFT JOIN watch_list wl ON mr.movie_id = wl.movie_id AND mr.user_id = wl.user_id
        WHERE wl.id IS NULL
      `);
      const orphanCount = (orphanedRatings[0] as any)?.count || 0;
      console.log(`- Found ${orphanCount} ratings for movies not on any user's watch list.`);
    }

    console.log('\nAnalysis complete.');

  } catch (error: any) {
    console.error('Error analyzing database structure:', error);
    if (error.message.includes('relation "movie_ratings" does not exist')) {
        console.log('The movie_ratings table does not exist, no analysis needed for it.');
    }
  }
}

analyzeCurrentStructure().finally(() => {
  console.log('Script finished.');
  process.exit(0);
}); 