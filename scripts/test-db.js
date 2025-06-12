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

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('❌ Database connection error:', testError)
      return
    }
    
    console.log('✅ Database connection successful')
    
    // Check if users table exists and get structure
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5)
    
    if (usersError) {
      console.error('❌ Error querying users table:', usersError)
    } else {
      console.log('✅ Users table query successful')
      console.log(`📊 Found ${users.length} user records`)
      
      if (users.length > 0) {
        console.log('👤 Sample user record structure:')
        const sampleUser = users[0]
        Object.keys(sampleUser).forEach(key => {
          console.log(`   ${key}: ${typeof sampleUser[key]} = ${sampleUser[key]}`)
        })
      }
    }
    
    // Check streaming_services table
    const { data: services, error: servicesError } = await supabase
      .from('streaming_services')
      .select('id, name, monthly_price')
      .limit(3)
    
    if (servicesError) {
      console.error('❌ Error querying streaming_services table:', servicesError)
    } else {
      console.log('✅ Streaming services table query successful')
      console.log(`🎬 Found ${services.length} streaming services`)
      services.forEach(service => {
        console.log(`   ${service.name} - $${service.monthly_price}/month`)
      })
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testDatabase() 