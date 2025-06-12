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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function insertStreamingServices() {
  try {
    console.log('📊 Inserting streaming services data...')
    
    const streamingServices = [
      { name: 'Netflix', logo_url: 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png', website_url: 'https://netflix.com', description: 'Movies, TV shows, and original content', monthly_price: 15.49 },
      { name: 'Disney+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Disney%2B_logo.svg', website_url: 'https://disneyplus.com', description: 'Disney, Marvel, Star Wars, and more', monthly_price: 13.99 },
      { name: 'Amazon Prime Video', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg', website_url: 'https://primevideo.com', description: 'Movies, TV shows, and Amazon Originals', monthly_price: 8.99 },
      { name: 'Hulu', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg', website_url: 'https://hulu.com', description: 'TV shows, movies, and live TV', monthly_price: 14.99 },
      { name: 'HBO Max', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg', website_url: 'https://hbomax.com', description: 'HBO content, movies, and originals', monthly_price: 14.99 },
      { name: 'Apple TV+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg', website_url: 'https://tv.apple.com', description: 'Apple original movies and TV shows', monthly_price: 6.99 },
      { name: 'Spotify', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg', website_url: 'https://spotify.com', description: 'Music streaming and podcasts', monthly_price: 10.99 },
      { name: 'YouTube TV', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/YouTube_TV_logo.svg', website_url: 'https://tv.youtube.com', description: 'Live TV streaming service', monthly_price: 64.99 },
      { name: 'ESPN+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/ESPN%2B_logo.svg', website_url: 'https://espnplus.com', description: 'Sports streaming and exclusive content', monthly_price: 9.99 },
      { name: 'Crunchyroll', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.png', website_url: 'https://crunchyroll.com', description: 'Anime streaming service', monthly_price: 7.99 },
      { name: 'Paramount+', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus_logo.svg', website_url: 'https://paramountplus.com', description: 'CBS, Paramount movies, and originals', monthly_price: 5.99 },
      { name: 'Peacock', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/NBCUniversal_Peacock_Logo.svg', website_url: 'https://peacocktv.com', description: 'NBCUniversal content and originals', monthly_price: 5.99 },
      { name: 'Apple Music', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Apple_Music_icon.svg', website_url: 'https://music.apple.com', description: 'Music streaming service', monthly_price: 10.99 },
      { name: 'YouTube Music', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Youtube_Music_icon.svg', website_url: 'https://music.youtube.com', description: 'Music streaming from YouTube', monthly_price: 9.99 },
      { name: 'Tubi', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Tubi_logo.svg', website_url: 'https://tubitv.com', description: 'Free movies and TV shows', monthly_price: 0.00 }
    ]
    
    // Insert one at a time to handle any conflicts
    for (const service of streamingServices) {
      try {
        const { data, error } = await supabase
          .from('streaming_services')
          .insert([service])
          .select()
        
        if (error) {
          console.log(`⚠️  Skipping ${service.name}: ${error.message}`)
        } else {
          console.log(`✅ Added ${service.name}`)
        }
      } catch (err) {
        console.log(`⚠️  Error with ${service.name}:`, err.message)
      }
    }
    
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
    console.log(`📊 Total streaming services in database: ${data.length}`)
    data.forEach(service => {
      const price = service.monthly_price === 0 ? 'Free' : `$${service.monthly_price}/month`
      console.log(`   • ${service.name} - ${price}`)
    })
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

insertStreamingServices() 