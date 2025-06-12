import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const envLines = envContent.split('\n')
  envLines.forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runMigration() {
  try {
    console.log('🚀 Starting database setup...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_streaming_services.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Running migration: Create streaming_services table...')
    
    // Execute migration
    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })
    
    if (migrationError) {
      console.error('❌ Migration failed:', migrationError)
      return
    }
    
    console.log('✅ Migration completed successfully!')
    
    // Read and execute the data population script
    const populatePath = path.join(__dirname, 'populate_streaming_services.sql')
    const populateSQL = fs.readFileSync(populatePath, 'utf8')
    
    console.log('📊 Populating streaming services data...')
    
    const { error: populateError } = await supabase.rpc('exec_sql', {
      sql: populateSQL
    })
    
    if (populateError) {
      console.error('❌ Data population failed:', populateError)
      return
    }
    
    console.log('✅ Data population completed successfully!')
    
    // Verify the data was inserted
    const { data, error } = await supabase
      .from('streaming_services')
      .select('name, monthly_price')
      .order('name')
    
    if (error) {
      console.error('❌ Failed to verify data:', error)
      return
    }
    
    console.log('\n🎉 Database setup complete!')
    console.log(`📊 Inserted ${data.length} streaming services:`)
    data.forEach(service => {
      console.log(`   • ${service.name} - $${service.monthly_price}/month`)
    })
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Alternative method using direct SQL execution
async function runMigrationDirect() {
  try {
    console.log('🚀 Starting database setup (direct method)...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_streaming_services.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Creating streaming_services table...')
    
    // Split the migration into individual statements
    const migrationStatements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (const statement of migrationStatements) {
      const { error } = await supabase.rpc('execute_sql', { query: statement })
      if (error) {
        console.error('❌ Error executing statement:', error)
        console.log('Statement:', statement)
      }
    }
    
    console.log('✅ Table creation completed!')
    
    // Insert data using the insert method
    console.log('📊 Inserting streaming services data...')
    
    const streamingServices = [
      { name: 'Netflix', logo_url: 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png', website_url: 'https://netflix.com', description: 'Movies, TV shows, and original content', monthly_price: 15.49 },
      { name: 'Disney+', logo_url: 'https://cnbl-cdn.bamgrid.com/assets/7ecc8bcb60ad77193058d63e321bd21cbac2fc67e652dfa304f8bc5671c551ac.png', website_url: 'https://disneyplus.com', description: 'Disney, Marvel, Star Wars, and more', monthly_price: 13.99 },
      { name: 'Amazon Prime Video', logo_url: 'https://m.media-amazon.com/images/G/01/digital/video/web/Logo-min.png', website_url: 'https://primevideo.com', description: 'Movies, TV shows, and Amazon Originals', monthly_price: 8.99 },
      { name: 'Hulu', logo_url: 'https://www.hulu.com/static/hitch/s3/attachments/ckcosx8zr000201l39dc3du8y/hulu-logo-green.png', website_url: 'https://hulu.com', description: 'TV shows, movies, and live TV', monthly_price: 14.99 },
      { name: 'HBO Max', logo_url: 'https://play-lh.googleusercontent.com/1iyX7VdQ5zpPZDcOuHEzpIBa-_hLO-V4pGlCSoqkSYU5JrWaouV2jeH_oKsqMPOWNF0', website_url: 'https://hbomax.com', description: 'HBO content, movies, and originals', monthly_price: 14.99 },
      { name: 'Apple TV+', logo_url: 'https://www.apple.com/v/apple-tv-plus/n/images/meta/apple-tv-plus__f0gqjbt3vveq_og.png', website_url: 'https://tv.apple.com', description: 'Apple original movies and TV shows', monthly_price: 6.99 },
      { name: 'Spotify', logo_url: 'https://developer.spotify.com/assets/branding-guidelines/icon1@2x.png', website_url: 'https://spotify.com', description: 'Music streaming and podcasts', monthly_price: 10.99 },
      { name: 'YouTube TV', logo_url: 'https://tv.youtube.com/img/icons/favicons/favicon-32x32.png', website_url: 'https://tv.youtube.com', description: 'Live TV streaming service', monthly_price: 64.99 },
      { name: 'ESPN+', logo_url: 'https://a4.espncdn.com/combiner/i?img=%2Fi%2Fespn%2Fmisc_logos%2F500%2Fespn_plus.png', website_url: 'https://espnplus.com', description: 'Sports streaming and exclusive content', monthly_price: 9.99 },
      { name: 'Crunchyroll', logo_url: 'https://www.crunchyroll.com/build/assets/img/favicons/favicon-32x32.png', website_url: 'https://crunchyroll.com', description: 'Anime streaming service', monthly_price: 7.99 }
    ]
    
    const { error: insertError } = await supabase
      .from('streaming_services')
      .insert(streamingServices)
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError)
      return
    }
    
    console.log('✅ Data insertion completed!')
    
    // Verify the data
    const { data, error } = await supabase
      .from('streaming_services')
      .select('name, monthly_price')
      .order('name')
    
    if (error) {
      console.error('❌ Failed to verify data:', error)
      return
    }
    
    console.log('\n🎉 Database setup complete!')
    console.log(`📊 Inserted ${data.length} streaming services:`)
    data.forEach(service => {
      console.log(`   • ${service.name} - $${service.monthly_price}/month`)
    })
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Run the setup
runMigrationDirect() 