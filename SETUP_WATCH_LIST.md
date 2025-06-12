# Quick Setup Guide: Watch List Feature

## 🚀 Quick Start

### Step 1: Clone and Set Up the Project

1. Open your terminal and clone the repository:
   ```bash
   git clone https://github.com/your-repo/decided.git
   ```

2. Navigate to the project directory:
   ```bash
   cd decided
   ```

3. Install the dependencies:

### Step 2: Set up the Database
Run the SQL commands in `database-setup.sql` to create the `watch_list` table:

```sql
-- The watch_list table and policies are already included in database-setup.sql
-- Just run: psql -h your-supabase-host -U postgres -d postgres -f database-setup.sql
```

### Step 3: Verify Environment Variables
Make sure you have TMDB API access configured in your `.env.local`:

```env
# You need at least one of these:
NEXT_PUBLIC_TMDB_ACCESS_TOKEN=your_tmdb_bearer_token
# OR
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key

# Also ensure your Supabase variables are set:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 4: Start the Development Server
```bash
cd supabase-auth
npm run dev
```

### Step 5: Test the Feature
1. **Complete the movie survey** if you haven't already (`/movie-recommendations`)
2. **Visit the dashboard** (`/dashboard`) 
3. **Check for auto-populated movies** from your survey
4. **Try searching** for new movies to add
5. **Test the movie detail modal** by clicking on search results
6. **Add movies with personal notes**
7. **Mark movies as watched/unwatched**

## 🎯 Key User Flow

1. **Survey Completion** → Movies rated as "haven't seen" are auto-added to watch list
2. **Dashboard Visit** → Watch list prominently displayed with auto-populated movies
3. **Search & Add** → Users can search TMDB database and add new movies
4. **Movie Details** → Click any movie to see full details, streaming info, and add notes
5. **Progress Tracking** → Mark movies as watched and track viewing progress

## 🧪 Testing Features

### Test Auto-Population
1. Complete the movie rating survey with some "Haven't Seen" selections
2. Visit dashboard - should see green notification about auto-added movies
3. Check that movies appear in "Movies to Watch" section

### Test Movie Search
1. Click "Add Movies" button on dashboard
2. Type in movie search box (e.g., "Inception")
3. Click on search results to see movie details
4. Add movie with a personal note
5. Verify it appears in your watch list

### Test Movie Management
1. Click "View Details" on any watch list movie
2. Mark movie as watched/unwatched
3. Remove movie from watch list
4. Check that changes persist after page refresh

## 🔍 Troubleshooting

**No auto-populated movies?**
- Make sure you completed the movie survey with "Haven't Seen" ratings
- Check database for entries in `movie_ratings` table with `rating_type = 'not_seen'`

**Search not working?**
- Verify TMDB API credentials in environment variables
- Check browser console for API errors
- Test TMDB API directly: `https://api.themoviedb.org/3/search/movie?query=test`

**Streaming info not showing?**
- This is expected - TMDB has limited streaming provider data
- Feature works but may show "Streaming information not available"

**Database errors?**
- Ensure `watch_list` table exists and has proper RLS policies
- Check that user is authenticated
- Verify Supabase connection

## 💡 Feature Highlights

- ✅ **Auto-population** from movie survey results
- ✅ **Real-time search** with TMDB integration  
- ✅ **Movie details modal** with streaming info
- ✅ **Personal notes** for each movie
- ✅ **Watch status tracking** (watched/unwatched)
- ✅ **Responsive design** for mobile and desktop
- ✅ **Secure data isolation** with Row Level Security

## 🎬 What's Next?

The watch list feature is now fully integrated! Users can:
- See movies they marked as "haven't seen" automatically added
- Search and discover new movies to add
- Track their viewing progress
- Add personal context with notes
- Manage their movie watching journey

The feature provides a seamless transition from movie discovery (via survey) to movie management (via watch list). 