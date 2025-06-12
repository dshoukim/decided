-- Add avatar_url column to users table
-- This stores the profile picture URL for users (from Google OAuth or default)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create a default avatar URL for users who don't have one
UPDATE public.users 
SET avatar_url = 'https://ui-avatars.com/api/?name=' || COALESCE(name, 'User') || '&background=3b82f6&color=ffffff&size=200'
WHERE avatar_url IS NULL; 