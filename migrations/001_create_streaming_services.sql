-- Create streaming_services table
CREATE TABLE public.streaming_services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    website_url TEXT,
    description TEXT,
    monthly_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on name for faster lookups
CREATE INDEX idx_streaming_services_name ON public.streaming_services(name);

-- Create an index on is_active for filtering active services
CREATE INDEX idx_streaming_services_active ON public.streaming_services(is_active);

-- Add Row Level Security (RLS)
ALTER TABLE public.streaming_services ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to all users
CREATE POLICY "Allow read access to streaming services" ON public.streaming_services
    FOR SELECT USING (true);

-- Policy to allow insert/update/delete for authenticated users (if needed later)
CREATE POLICY "Allow full access for authenticated users" ON public.streaming_services
    FOR ALL USING (auth.role() = 'authenticated'); 