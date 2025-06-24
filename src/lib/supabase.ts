import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// Note: supabase-js v2.x does not support custom Realtime WebSocket URLs directly.
// To use a tunnel (e.g., ngrok), set NEXT_PUBLIC_SUPABASE_URL to your tunnel's public URL.

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string // UUID referencing auth.users.id
          email: string
          name: string
          username: string
          date_of_birth: string
          gender: string | null
          streaming_services: string[] | null // Array of streaming service IDs
          selected_genres: string[] | null // Array of genre IDs
          selected_characteristics: string[] | null // Array of characteristic IDs
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string // UUID must be provided (auth.users.id)
          email: string
          name: string
          username: string
          date_of_birth: string
          gender?: string | null
          streaming_services?: string[] | null // Array of streaming service IDs
          selected_genres?: string[] | null // Array of genre IDs
          selected_characteristics?: string[] | null // Array of characteristic IDs
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          username?: string
          date_of_birth?: string
          gender?: string | null
          streaming_services?: string[] | null // Array of streaming service IDs
          selected_genres?: string[] | null // Array of genre IDs
          selected_characteristics?: string[] | null // Array of characteristic IDs
          created_at?: string
          updated_at?: string
        }
      }
      streaming_services: {
        Row: {
          id: number
          name: string
          logo_url: string
          website_url: string
          description: string
          monthly_price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          logo_url?: string
          website_url?: string
          description?: string
          monthly_price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          logo_url?: string
          website_url?: string
          description?: string
          monthly_price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      genres: {
        Row: {
          id: number
          name: string
          description: string | null
          icon: string | null
          color: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          description?: string | null
          icon?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string | null
          icon?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      genre_characteristics: {
        Row: {
          id: number
          genre_id: number
          name: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          genre_id: number
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          genre_id?: number
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
    }
  }
} 