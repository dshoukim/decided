# Drizzle Agent Guide for Cursor AI

This guide provides essential information for Cursor agents working with Drizzle ORM in this Next.js + Supabase project.

## 🚨 Critical Setup Rule

**ALWAYS ensure `drizzle.config.ts` loads environment variables from `.env.local`**

```typescript
import { defineConfig } from 'drizzle-kit'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['public'],
})
```

**Why this is critical**: Drizzle CLI runs outside of Next.js and doesn't automatically load `.env.local`. Without explicit dotenv loading, `DATABASE_URL` will be undefined and all Drizzle commands will fail.

## Environment Variables Required

Ensure these variables exist in `.env.local`:

```env
# Database connection (use pooled connection for serverless)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Analytics (if using PostHog)
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Database Architecture

This project uses **Drizzle ORM for database operations** with **Supabase for auth/realtime**:

- **Drizzle**: Primary ORM for type-safe database queries and migrations
- **Supabase Client**: Used for authentication, realtime subscriptions, and storage
- **Database**: PostgreSQL hosted on Supabase with connection pooling

### Schema Location
- **Main schema**: `src/db/schema.ts` - Contains all table definitions
- **Database client**: `src/db/index.ts` - Drizzle client configuration
- **Generated types**: Auto-generated TypeScript types from schema

## Drizzle Commands Reference

### Essential Commands

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push schema directly to database (skip migrations)
npx drizzle-kit push

# Pull current database schema
npx drizzle-kit introspect

# Launch Drizzle Studio (database GUI)
npx drizzle-kit studio

# Check migration status
npx drizzle-kit up
```

### Command Purposes

- **`generate`**: Creates migration files when schema changes
- **`push`**: Direct schema sync (good for development)
- **`introspect`**: Reverse-engineer schema from existing database
- **`studio`**: Visual database browser and editor

## Migration Workflow

### Development Phase
1. Modify `src/db/schema.ts`
2. Run `npx drizzle-kit push` for instant sync
3. Test changes in development

### Production Phase
1. Modify `src/db/schema.ts`
2. Run `npx drizzle-kit generate` to create migration
3. Review generated migration in `drizzle/` folder
4. Apply migration using custom script or CI/CD

### Custom Migration Scripts
This project includes custom migration scripts in `scripts/` folder that handle:
- Environment variable loading
- Error handling for existing tables/columns
- Migration verification
- Rollback scenarios

## Schema Management Best Practices

### 1. Always Use TypeScript Types
```typescript
import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  created_at: timestamp('created_at').defaultNow(),
  is_active: boolean('is_active').default(true),
})
```

### 2. Define Relations
```typescript
import { relations } from 'drizzle-orm'

export const usersRelations = relations(users, ({ many }) => ({
  watchList: many(watchList),
  roomParticipants: many(roomParticipants),
}))
```

### 3. Use Consistent Naming
- Table names: `snake_case` (e.g., `room_participants`)
- Column names: `snake_case` (e.g., `created_at`)
- File names: `kebab-case` (e.g., `user-profile.ts`)

## Troubleshooting Common Issues

### 1. "DATABASE_URL is not set"
**Cause**: `drizzle.config.ts` not loading `.env.local`
**Solution**: Add dotenv loading to config file (see Critical Setup Rule above)

### 2. "password authentication failed"
**Cause**: Wrong connection string format
**Solution**: Use pooled connection string with `pgbouncer=true`

### 3. "relation does not exist"
**Cause**: Schema out of sync with database
**Solutions**:
- Run `npx drizzle-kit push` to sync schema
- Check if migration was applied correctly
- Verify table names match schema exactly

### 4. "Column already exists" during migration
**Cause**: Migration applied partially or manually
**Solution**: Use conditional statements in custom migration scripts

### 5. Type errors in queries
**Cause**: Schema changes not reflected in TypeScript
**Solution**: Restart TypeScript server after schema changes

## Query Examples

### Basic Queries
```typescript
import { db } from '@/db'
import { users, watchList } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// Select with conditions
const user = await db.select().from(users).where(eq(users.id, userId))

// Join tables
const userWithWatchList = await db
  .select()
  .from(users)
  .leftJoin(watchList, eq(users.id, watchList.user_id))
  .where(eq(users.id, userId))

// Insert
const newUser = await db.insert(users).values({
  id: 'user-123',
  email: 'user@example.com'
}).returning()

// Update
await db.update(users)
  .set({ is_active: false })
  .where(eq(users.id, userId))

// Delete
await db.delete(users).where(eq(users.id, userId))
```

### Complex Queries
```typescript
// Subqueries
const activeUsers = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.is_active, true),
      exists(
        db.select().from(watchList).where(eq(watchList.user_id, users.id))
      )
    )
  )

// Aggregations
const userStats = await db
  .select({
    userId: users.id,
    watchListCount: count(watchList.id)
  })
  .from(users)
  .leftJoin(watchList, eq(users.id, watchList.user_id))
  .groupBy(users.id)
```

## Integration with Supabase

### Server-Side Operations
```typescript
// Use Drizzle for database operations
import { db } from '@/db'
import { createClient } from '@/lib/supabase/server'

// Use Supabase for auth
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

// Combine both
const userProfile = await db.select().from(users).where(eq(users.id, user.id))
```

### Client-Side Operations
```typescript
// Use Supabase for auth/realtime
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// Use API routes with Drizzle for data operations
const response = await fetch('/api/user-profile', {
  method: 'POST',
  body: JSON.stringify({ userId: user.id })
})
```

## File Structure

```
src/
├── db/
│   ├── index.ts          # Drizzle client configuration
│   └── schema/
│       └── index.ts      # Main schema file
├── lib/
│   └── supabase/
│       ├── client.ts     # Client-side Supabase
│       └── server.ts     # Server-side Supabase
└── app/
    └── api/              # API routes using Drizzle
drizzle/                  # Generated migrations
drizzle.config.ts         # Drizzle configuration
scripts/                  # Custom migration scripts
```

## Testing Database Changes

Always test database changes with:

```bash
# 1. Check environment loading
node check-env.js

# 2. Test database connection
node test-phase1-setup.js

# 3. Verify schema sync
npx drizzle-kit introspect
```

## Emergency Procedures

### Reset Development Database
1. Create backup: `pg_dump DATABASE_URL > backup.sql`
2. Reset schema: `npx drizzle-kit push --force`
3. Restore data if needed

### Rollback Migration
1. Identify last good migration
2. Manually revert schema changes
3. Run `npx drizzle-kit push` to sync

## Key Reminders for Agents

1. **Always check if `.env.local` exists** before running Drizzle commands
2. **Never run `drizzle-kit push` in production** without data backup
3. **Use custom migration scripts** for complex schema changes
4. **Test database connection** before making schema changes
5. **Keep Drizzle for data, Supabase for auth/realtime** - don't mix responsibilities
6. **Generate TypeScript types** after schema changes for type safety

This guide should prevent common Drizzle issues and ensure smooth database operations in this project. 