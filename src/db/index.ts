import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as relations from './relations'

// Create the connection string from environment variables
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Log connection info for debugging (without sensitive data)
try {
  const urlParts = new URL(connectionString)
  console.log('Connecting to database:', {
    host: urlParts.hostname,
    port: urlParts.port || '5432',
    database: urlParts.pathname.slice(1),
    username: urlParts.username,
    ssl: urlParts.hostname.includes('supabase.com') ? 'required' : 'prefer'
  })
} catch (e) {
  console.error('Invalid DATABASE_URL format')
}

// For Supabase pooler connections
const client = postgres(connectionString, { 
  prepare: false, // Required for Transaction pool mode
  max: 1, // Limit connections for serverless
  // SSL is handled automatically by the postgres driver when connecting to Supabase
  connection: {
    application_name: 'decided-drizzle'
  },
  // Add connection timeout
  connect_timeout: 10,
})

// Create the drizzle instance with schema and relations
export const db = drizzle(client, { schema: { ...schema, ...relations } })

// Export the client if needed for cleanup
export { client } 