import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function applyPhase1Migration() {
  console.log('🚀 Applying Phase 1 Database Migration...\n');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    return;
  }

  // Create postgres client
  const sql = postgres(connectionString, { 
    prepare: false,
    max: 1,
  });
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'drizzle', '0001_mixed_the_order.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await sql.unsafe(statement);
        console.log('✅ Success');
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate column') ||
            error.message.includes('already exists')) {
          console.log('ℹ️  Already exists, skipping');
        } else {
          console.error('❌ Error:', error.message);
          // Continue with other statements
        }
      }
    }
    
    console.log('\n🎉 Phase 1 Migration Complete!');
    
    // Test the new tables
    console.log('\nTesting new tables...');
    
    const testQueries = [
      { name: 'rooms', query: 'SELECT 1 FROM rooms LIMIT 1' },
      { name: 'room_participants', query: 'SELECT 1 FROM room_participants LIMIT 1' },
      { name: 'bracket_picks', query: 'SELECT 1 FROM bracket_picks LIMIT 1' },
      { name: 'user_movie_elo', query: 'SELECT 1 FROM user_movie_elo LIMIT 1' },
      { name: 'room_history', query: 'SELECT 1 FROM room_history LIMIT 1' },
    ];
    
    for (const test of testQueries) {
      try {
        await sql.unsafe(test.query);
        console.log(`✅ Table '${test.name}' is accessible`);
      } catch (error) {
        console.log(`❌ Table '${test.name}' failed:`, error.message);
      }
    }
    
    // Test watch_list consolidation
    console.log('\nTesting watch_list consolidation...');
    try {
      await sql.unsafe('SELECT rating, liked, review, decided_together_room_id, pending_rating FROM watch_list LIMIT 1');
      console.log('✅ watch_list consolidation successful');
    } catch (error) {
      console.log('❌ watch_list consolidation failed:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    // Close the connection
    await sql.end();
  }
}

applyPhase1Migration(); 