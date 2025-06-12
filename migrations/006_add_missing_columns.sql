-- Add missing columns to users table for genre and characteristic preferences

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS selected_genres TEXT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS selected_characteristics TEXT[]; 