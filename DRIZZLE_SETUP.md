# Drizzle ORM Setup Guide

This project has been configured to use [Drizzle ORM](https://orm.drizzle.team/) with Supabase PostgreSQL database.

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```env
# Existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database URL for Drizzle ORM
# Find this in your Supabase dashboard under Settings > Database
# Use the "Session Mode" pooler connection string for serverless environments
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres
```

### 2. Apply Database Migrations

Run the existing migration to add the `user_note` field to the `movie_ratings` table:

```sql
-- In your Supabase SQL editor, run:
ALTER TABLE public.movie_ratings 
ADD COLUMN IF NOT EXISTS user_note TEXT;
```

### 3. Project Structure

```
src/
├── db/
│   ├── index.ts      # Database connection
│   └── schema.ts     # Drizzle schema definitions
├── app/
│   └── api/
│       ├── save-movie-rating/  # Updated to use Drizzle
│       └── watch-list/         # Updated to use Drizzle
```

## Key Changes

### Database Connection (`src/db/index.ts`)
- Uses `postgres` driver with Drizzle
- Configured for serverless with `prepare: false`
- Exports `db` instance for use in API routes

### Schema Definitions (`src/db/schema.ts`)
- Defines all database tables using Drizzle schema
- Includes TypeScript type exports for each table
- Maintains all existing indexes and constraints

### API Routes
- Updated to use Drizzle's query builder instead of Supabase client
- Better type safety with inferred types from schema
- More explicit query construction

## Benefits of Using Drizzle

1. **Type Safety**: Full TypeScript support with inferred types
2. **Performance**: Optimized queries with minimal overhead
3. **Developer Experience**: Better autocomplete and error messages
4. **Flexibility**: More control over complex queries
5. **Database Agnostic**: Easy to switch between different databases

## Common Drizzle Patterns

### Select Query
```typescript
const results = await db
  .select()
  .from(movieRatings)
  .where(eq(movieRatings.userId, userId))
```

### Insert with Conflict Handling
```typescript
// Check if exists first
const existing = await db
  .select()
  .from(movieRatings)
  .where(and(
    eq(movieRatings.userId, userId),
    eq(movieRatings.tmdbMovieId, movieId)
  ))
  .limit(1)

// Then insert or update
if (existing.length > 0) {
  await db.update(movieRatings).set({...}).where(...)
} else {
  await db.insert(movieRatings).values({...})
}
```

### Delete Query
```typescript
await db
  .delete(watchList)
  .where(eq(watchList.id, id))
```

## Migrations

To generate migrations from schema changes:

```bash
npm run drizzle-kit generate
```

To apply migrations:

```bash
npm run drizzle-kit migrate
```

## Troubleshooting

1. **Connection Issues**: Ensure your DATABASE_URL is correct
2. **Type Errors**: Run `npm run build` to check for TypeScript issues
3. **Migration Errors**: Check that all required fields have defaults or are nullable

## Resources

- [Drizzle Documentation](https://orm.drizzle.team/)
- [Drizzle with Supabase Guide](https://orm.drizzle.team/docs/connect-supabase)
- [Drizzle Query Builder](https://orm.drizzle.team/docs/select) 