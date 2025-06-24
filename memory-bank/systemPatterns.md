# System Patterns: Decided

## Architectural Overview

### High-Level System Design

```
┌─────────────────┐    HTTP/WebSocket    ┌─────────────────┐
│   Next.js App   │ ◄─────────────────► │   Supabase      │
│                 │                      │                 │
│ - UI Components │                      │ - PostgreSQL    │
│ - Client Hooks  │                      │ - Auth          │
│ - State Stores  │                      │ - Realtime      │
└─────────────────┘                      └─────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                      ┌─────────────────┐
│   TMDB API      │                      │   External      │
│                 │                      │   Services      │
│ - Movie Data    │                      │                 │
│ - Poster Images │                      │ - ngrok (dev)   │
└─────────────────┘                      └─────────────────┘
```

### Core System Patterns

## Data Flow Architecture

### Client-Server Interaction Pattern

**1. User Action → API Endpoint → Database → Real-time Broadcast**
```typescript
// Example: User picks a movie in tournament
User clicks movie → POST /api/rooms/[code]/bracket 
                 → Save to bracket_picks table
                 → Broadcast pick_made event
                 → All clients receive update
                 → UI reflects new state
```

**2. Optimistic UI Updates with Server Reconciliation**
```typescript
// Pattern used in tournament store
const pickMovie = (movieId: number) => {
  // 1. Optimistic update
  updateLocalState(movieId)
  
  // 2. Server call
  const result = await api.submitPick(movieId)
  
  // 3. Reconcile if needed
  if (!result.success) {
    revertLocalState()
  }
}
```

## Component Architecture Patterns

### Hook-Based State Management

**Custom Hooks for Feature Isolation**
```typescript
// useRoom.ts - Room lifecycle management
// useTournament.ts - Tournament state and actions
// useUser.ts - User authentication and profile
```

**State Composition Pattern**
```typescript
function TournamentInterface() {
  const { room, participants } = useRoom(roomCode)
  const { currentMatch, submitPick } = useTournament(roomCode)
  const { user } = useUser()
  
  // Component logic combines multiple state sources
}
```

### Real-time Synchronization Pattern

**Channel-Based Event Distribution**
```typescript
// Supabase channel subscription pattern
const channel = supabase.channel(`room:${roomCode}`)
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'bracket_picks' 
  }, handlePickUpdate)
  .on('broadcast', { event: 'round_completed' }, handleRoundComplete)
  .subscribe()
```

**Event-Driven State Updates**
```typescript
// Tournament store pattern
const handleRealTimeEvent = (event: RealTimeEvent) => {
  switch (event.type) {
    case 'pick_made':
      updatePartnerProgress(event.data)
      break
    case 'round_completed':
      advanceToNextRound(event.data)
      break
    case 'tournament_completed':
      showWinner(event.data)
      break
  }
}
```

## Service Layer Patterns

### Movie Data Management Patterns

**TMDB Integration Strategy**
```typescript
// Automated movie data population with rate limiting
class TMDBPopulator {
  async fetchMovieDetails(tmdbId: number): Promise<TMDBMovieDetails>
  async fetchMovieVideos(tmdbId: number): Promise<TMDBVideo[]>
  extractTrailerUrl(videos: TMDBVideo[]): string | null
  
  // Batch processing with rate limiting
  async populateMovies(identifiers: (string | number)[], options: {
    batchSize: number
    delay: number
  }): Promise<PopulationResult>
}
```

**Movie Data Transformation Pattern**
```typescript
// Transform TMDB data to database schema
function transformMovieData(tmdbMovie: TMDBMovieDetails): FilmsInsert {
  return {
    tmdbId: tmdbMovie.id,
    title: tmdbMovie.title,
    voteAverage: Math.round((tmdbMovie.vote_average || 0) * 10), // Integer storage
    popularity: Math.round((tmdbMovie.popularity || 0) * 1000),
    genres: tmdbMovie.genres?.map(g => g.name) || [],
    trailerLink: extractTrailerUrl(tmdbMovie.videos),
    // ... other transformations
  }
}
```

**Upsert Pattern for Data Consistency**
```typescript
// Prevent duplicates using TMDB ID constraint
await db.insert(films)
  .values(movieData)
  .onConflictDoUpdate({
    target: films.tmdbId,
    set: {
      updatedAt: new Date(),
      ...movieData
    }
  })
```

### Tournament Engine Architecture

**Bracket Generation Strategy**
```typescript
class TournamentEngine {
  // Single elimination tournament with 8-16 movies
  generateBracket(movies: Movie[], userCount: number): TournamentBracket
  
  // Round advancement logic
  advanceTournamentRound(tournament: Tournament, picks: BracketPick[]): Tournament
  
  // Winner determination
  determineWinner(finalRoundPicks: BracketPick[]): Movie
}
```

**State Management Pattern**
```typescript
// Room state encapsulation
class RoomStateManager {
  loadFromDB(roomCode: string): Promise<RoomState>
  updateState(roomCode: string, updates: Partial<RoomState>): Promise<void>
  getParticipants(roomCode: string): Promise<Participant[]>
}
```

### Action Processing Pattern

**Command Pattern for User Actions**
```typescript
interface UserAction {
  type: 'start' | 'pick' | 'leave' | 'extend'
  payload: any
  userId: string
  roomCode: string
}

class ActionProcessor {
  async processAction(action: UserAction): Promise<ActionResult> {
    // Validation → Execution → Side Effects → Response
  }
}
```

## Database Patterns

### Audit Trail Pattern
```sql
-- Every significant action logged for debugging
CREATE TABLE user_actions (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Denormalization for Performance
```sql
-- Room participants track their own progress
ALTER TABLE room_participants 
ADD COLUMN completed_matches TEXT[] DEFAULT '{}',
ADD COLUMN current_match_index INTEGER DEFAULT 0;
```

### Event Sourcing for Tournament State
```sql
-- Tournament state reconstructable from picks
SELECT * FROM bracket_picks 
WHERE room_id = ? 
ORDER BY created_at ASC;
-- → Reconstruct complete tournament progression
```

## Error Handling Patterns

### Graceful Degradation Strategy

**Real-time → Polling Fallback**
```typescript
// If WebSocket fails, fall back to polling
const useRoomWithFallback = (roomCode: string) => {
  const [realtimeConnected, setRealtimeConnected] = useState(true)
  
  useEffect(() => {
    if (!realtimeConnected) {
      // Poll every 2 seconds as fallback
      const interval = setInterval(refetchRoomState, 2000)
      return () => clearInterval(interval)
    }
  }, [realtimeConnected])
}
```

**Progressive Enhancement**
```typescript
// Core functionality works without real-time features
const TournamentMatch = ({ match, onPick }) => {
  // Always works: Display match and allow picking
  // Enhanced: Show partner progress if real-time connected
  // Enhanced: Show live updates during picks
}
```

### Idempotent Operations Pattern
```typescript
// All user actions can be safely retried
POST /api/rooms/[code]/bracket
{
  "action": "pick",
  "movieId": 123,
  "matchId": "r1m1",
  "idempotencyKey": "user123-r1m1-20240101"
}
// → Same request twice = same result, no duplicate picks
```

## Security Patterns

### Row Level Security (RLS) Pattern
```sql
-- Users can only access rooms they participate in
CREATE POLICY room_access ON rooms
FOR ALL USING (
  id IN (
    SELECT room_id FROM room_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

### Data Validation Pipeline
```typescript
// Server-side validation pattern
const validatePickAction = (action: PickAction) => {
  const schema = z.object({
    movieId: z.number().positive(),
    matchId: z.string().regex(/^r\d+m\d+$/),
    // ... other validations
  })
  
  return schema.parse(action)
}
```

## Testing Patterns

### Real-time Testing Strategy
```typescript
// Multi-browser testing with ngrok
// Browser 1: localhost:3000
// Browser 2: https://abc123.ngrok.io
// Both connect to same Supabase instance
// Test tournament synchronization
```

### Mocking Strategy
```typescript
// Mock Supabase for unit tests
const mockSupabase = {
  channel: () => ({
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  })
}
```

## Performance Patterns

### Lazy Loading Strategy
```typescript
// Tournament components loaded only when needed
const TournamentInterface = lazy(() => import('./TournamentInterface'))
const BracketScreen = lazy(() => import('./BracketScreen'))
```

### Caching Strategy
```typescript
// SWR with real-time invalidation
const { data: room } = useSWR(
  `room-${roomCode}`,
  () => fetchRoom(roomCode),
  {
    refreshInterval: 0, // Disabled - real-time updates instead
    revalidateOnFocus: false,
    dedupingInterval: 5000
  }
)
```

These patterns provide consistency, maintainability, and reliability across the Decided application while supporting the real-time collaborative features. 