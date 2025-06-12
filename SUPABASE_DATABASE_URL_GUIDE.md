# Supabase DATABASE_URL Configuration Guide

## Finding Your Database URL

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **Database**
4. Find the **Connection String** section

## Important: Use the Correct Connection String

For serverless environments (like Next.js), you should use the **Session Mode** pooler connection string:

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**NOT** the direct connection string which looks like:
```
postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres
```

## Common Issues

### 1. "password authentication failed for user"
This error typically means:
- You're using your local username instead of the Supabase database credentials
- The DATABASE_URL is not properly formatted
- You're using the wrong connection string type

### 2. SSL Connection Required
Supabase requires SSL connections. The connection is already configured for this in the code.

## Setting up your .env.local

Create or update your `.env.local` file:

```env
# Existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database URL - Use the Session Mode pooler string
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

## Verifying Your Configuration

1. The username should be `postgres.[project-ref]` (NOT your personal username)
2. The host should end with `.pooler.supabase.com` for pooled connections
3. The port should be `6543` for pooled connections
4. Include `?pgbouncer=true` at the end

## Troubleshooting Steps

1. Check the console output when starting the app - it will log the connection details (without password)
2. Verify your DATABASE_URL matches the format above
3. Ensure you're using the password from Supabase, not your Supabase account password
4. Try connecting with a database client to verify credentials

## Example Working Configuration

```env
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:MySecurePassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Where:
- `abcdefghijklmnop` is your project reference
- `MySecurePassword123` is your database password (from Supabase dashboard)
- `aws-0-us-east-1` is your project's region 