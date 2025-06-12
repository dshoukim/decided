-- Make date_of_birth column nullable for users who don't provide this information
-- This allows both Google OAuth and email/password users to create profiles

ALTER TABLE public.users ALTER COLUMN date_of_birth DROP NOT NULL; 