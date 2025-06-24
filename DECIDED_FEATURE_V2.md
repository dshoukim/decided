# Decided Feature V2 - Complete Refactoring Plan

## Executive Summary

The current implementation of the "Decided" feature suffers from race conditions, complex state management, unreliable real-time synchronization, and scattered business logic. This refactoring plan proposes a complete architectural overhaul based on server-driven UI, simplified state management, and robust error handling.

## Current Implementation Issues

### 1. Critical Problems
- **Race Conditions**: Multiple concurrent bracket submissions cause 409 conflicts despite deduplication attempts
- **State Synchronization**: Complex state management across Zustand, React state, server state, and real-time messages
- **Match Progression Bug**: Client-side calculation of current match allows users to skip matches
- **Real-time Complexity**: Too many event types with complex subscription management
- **Connection Issues**: WebSocket subscription conflicts and connection cleanup problems

### 2. Architectural Issues
- Business logic scattered across client and server
- No single source of truth for room state
- Complex tournament generation with many edge cases
- Poor error recovery and no graceful degradation
- Excessive API endpoints with inconsistent patterns

### 3. Code Quality Issues
- Logic duplication between files
- Overly complex component hierarchy
- Difficult to test due to tight coupling
- No proper audit trail for debugging

## Proposed Architecture

### Core Principles

1. **Server-Driven UI**: The server is the single source of truth. Clients only display what the server provides.
2. **Simplified State**: Replace complex state management with a simple state object from the server.
3. **Unified Actions**: All user interactions go through a single action endpoint.
4. **Idempotent Operations**: All operations can be safely retried without side effects.
5. **Graceful Degradation**: System remains functional even when real-time features fail.

### System Architecture

```
┌─────────────┐     SSE/Polling    ┌─────────────┐
│   Client    │ ◄────────────────► │   Server    │
│             │                     │             │
│ - Display   │     Actions        │ - Logic     │
│ - Actions   │ ──────────────────► │ - State     │
└─────────────┘                     └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  Database   │
                                    │             │
                                    │ - Truth     │
                                    └─────────────┘
```

## Database Schema Changes

### New Tables

```sql
-- Stores complete UI state for each room
CREATE TABLE room_states (
  room_id UUID PRIMARY KEY REFERENCES rooms(id),
  state_version INTEGER NOT NULL DEFAULT 1,
  current_state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Tracks when matches are complete (both users picked)
CREATE TABLE match_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  match_id VARCHAR(50) NOT NULL,
  round_number INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  next_match_id VARCHAR(50),
  UNIQUE(room_id, match_id)
);

-- Audit log for all user actions
CREATE TABLE user_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  action_payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  result VARCHAR(20) NOT NULL, -- 'success', 'error', 'ignored'
  error_message TEXT,
  INDEX idx_user_actions_room_user (room_id, user_id)
);
```

### Modified Tables

```sql
-- Add fields to track user progress independently
ALTER TABLE room_participants
  ADD COLUMN current_match_index INTEGER DEFAULT 0,
  ADD COLUMN last_action_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN completed_matches TEXT[] DEFAULT '{}';

-- Simplify rooms table
ALTER TABLE rooms
  DROP COLUMN tournament_data; -- Move to room_states

-- Better constraints on bracket_picks
ALTER TABLE bracket_picks
  ADD CONSTRAINT unique_room_user_match UNIQUE (room_id, user_id, match_id);
```

## API Design

### Endpoints

```typescript
// 1. Create a room
POST /api/decided/rooms
Response: { roomCode: string }

// 2. Join a room  
POST /api/decided/rooms/[code]/join
Response: { success: boolean }

// 3. Get current state (polling fallback)
GET /api/decided/rooms/[code]/state
Response: RoomState

// 4. Server-Sent Events stream
GET /api/decided/rooms/[code]/stream
Response: EventSource stream of RoomState

// 5. Universal action endpoint
POST /api/decided/rooms/[code]/action
Body: {
  action: 'start' | 'pick' | 'leave' | 'extend',
  payload: any,
  idempotencyKey?: string
}
Response: { success: boolean, state: RoomState }
```

### State Shape

```typescript
interface RoomState {
  version: number;
  screen: 'lobby' | 'bracket' | 'waiting' | 'final' | 'winner' | 'error';
  
  data: {
    room: {
      code: string;
      timeRemaining?: number;
      participants: Array<{
        userId: string;
        name: string;
        avatarUrl?: string;
        isActive: boolean;
        isReady: boolean;
      }>;
    };
    
    tournament?: {
      currentMatch?: {
        matchId: string;
        movieA: Movie;
        movieB: Movie;
      };
      progress: {
        userPicks: number;
        totalPicks: number;
        currentRound: number;
        totalRounds: number;
      };
      partnerProgress?: {
        picks: number;
        total: number;
      };
    };
    
    winner?: {
      movie: Movie;
      addedToWatchlists: boolean;
    };
  };
  
  availableActions: string[];
  error?: string;
  lastUpdated: string;
}
```

## Server Implementation

### Core Services

```typescript
// services/RoomStateManager.ts
class RoomStateManager {
  async getState(roomId: string, userId: string): Promise<RoomState> {
    const state = await this.loadFromDB(roomId);
    return this.personalizeForUser(state, userId);
  }
  
  async processAction(roomId: string, userId: string, action: Action): Promise<RoomState> {
    // 1. Validate action
    // 2. Apply action to state
    // 3. Save new state
    // 4. Broadcast to participants
    // 5. Return new state
  }
  
  private async broadcast(roomId: string, state: RoomState) {
    // Send to all SSE connections
    // Trigger polling clients to refresh
  }
}

// services/TournamentManager.ts  
class TournamentManager {
  generateTournament(userAMovies: Movie[], userBMovies: Movie[]): Tournament {
    // Simplified tournament generation
    // No mock data, just handle edge cases gracefully
  }
  
  processPickAction(state: RoomState, userId: string, pick: Pick): RoomState {
    // 1. Record pick
    // 2. Check if match complete
    // 3. Advance if needed
    // 4. Return updated state
  }
}

// services/ActionProcessor.ts
class ActionProcessor {
  async process(roomId: string, userId: string, action: Action): Promise<Result> {
    // 1. Acquire lock on room
    // 2. Load current state
    // 3. Validate action
    // 4. Apply action
    // 5. Save state
    // 6. Release lock
    // 7. Broadcast update
  }
}
```

## Client Implementation

### Simplified Architecture

```typescript
// hooks/useDecidedRoom.ts
function useDecidedRoom(roomCode: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Try SSE first
    const eventSource = new EventSource(`/api/decided/rooms/${roomCode}/stream`);
    
    eventSource.onmessage = (event) => {
      setState(JSON.parse(event.data));
    };
    
    eventSource.onerror = () => {
      // Fall back to polling
      const interval = setInterval(async () => {
        const response = await fetch(`/api/decided/rooms/${roomCode}/state`);
        if (response.ok) {
          setState(await response.json());
        }
      }, 2000);
      
      return () => clearInterval(interval);
    };
    
    return () => eventSource.close();
  }, [roomCode]);
  
  const sendAction = async (action: string, payload?: any) => {
    try {
      const response = await fetch(`/api/decided/rooms/${roomCode}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, payload }),
      });
      
      if (!response.ok) throw new Error('Action failed');
      
      const result = await response.json();
      setState(result.state);
    } catch (err) {
      setError(err.message);
    }
  };
  
  return { state, error, sendAction };
}

// components/DecidedRoom.tsx
function DecidedRoom({ roomCode }: { roomCode: string }) {
  const { state, error, sendAction } = useDecidedRoom(roomCode);
  
  if (!state) return <Loading />;
  if (error) return <Error message={error} />;
  
  switch (state.screen) {
    case 'lobby':
      return <Lobby state={state} onStart={() => sendAction('start')} />;
    case 'bracket':
      return <Bracket state={state} onPick={(pick) => sendAction('pick', pick)} />;
    case 'waiting':
      return <Waiting state={state} />;
    case 'final':
      return <FinalRound state={state} onPick={(pick) => sendAction('pick', pick)} />;
    case 'winner':
      return <Winner state={state} />;
    default:
      return <Error message="Unknown state" />;
  }
}
```

## Real-time Architecture

### Server-Sent Events (SSE)

```typescript
// api/rooms/[code]/stream/route.ts
export async function GET(req: Request, { params: { code } }) {
  const { userId } = await auth(req);
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      const state = await roomStateManager.getState(roomId, userId);
      controller.enqueue(`data: ${JSON.stringify(state)}\n\n`);
      
      // Subscribe to changes
      const unsubscribe = roomStateManager.subscribe(roomId, (newState) => {
        const personalizedState = personalizeForUser(newState, userId);
        controller.enqueue(`data: ${JSON.stringify(personalizedState)}\n\n`);
      });
      
      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Error Handling & Recovery

### Strategies

1. **Graceful Degradation**
   - SSE → Polling (2s interval) → Manual refresh
   - Optimistic updates with rollback on failure
   - Offline queue for actions

2. **Idempotency**
   - All actions include optional idempotencyKey
   - Server deduplicates within 5-minute window
   - Safe to retry any action

3. **Timeout Handling**
   ```typescript
   // Rooms auto-close after 30 minutes of inactivity
   // Warning shown after 20 minutes
   // Any action extends the session
   ```

4. **Recovery Scenarios**
   - **Disconnection**: Automatically rejoin on reconnect
   - **Browser Refresh**: Full state recovery from server
   - **Network Issues**: Queue actions, retry with backoff
   - **Server Errors**: Show error state with retry option

## Migration Strategy

### Phase 1: Database & Core Services (Days 1-2)
- Create new tables with migrations
- Implement RoomStateManager service
- Build ActionProcessor with locking
- Add comprehensive logging

### Phase 2: API Implementation (Days 3-4)
- Create universal action endpoint
- Implement SSE streaming endpoint
- Add state retrieval endpoint
- Build action validation layer

### Phase 3: Client Refactor (Days 5-6)
- Remove Zustand and complex hooks
- Implement useDecidedRoom hook
- Create state-driven components
- Add optimistic updates

### Phase 4: Testing & Migration (Days 7-8)
- Unit tests for state transitions
- Integration tests for full flows
- Load testing with 100 concurrent rooms
- Migrate existing room data

## Testing Strategy

### Test Scenarios

1. **Unit Tests**
   ```typescript
   describe('RoomStateManager', () => {
     test('processes pick action correctly', async () => {
       const state = await manager.processAction(roomId, userId, {
         action: 'pick',
         payload: { matchId: 'r1m1', selectedMovieId: 123 }
       });
       expect(state.data.tournament.progress.userPicks).toBe(1);
     });
   });
   ```

2. **Integration Tests**
   - Complete tournament flow
   - Concurrent user actions
   - Network failure recovery
   - State consistency

3. **Load Tests**
   - 100 concurrent rooms
   - 1000 actions per minute
   - Measure response times
   - Monitor error rates

4. **Chaos Testing**
   - Random disconnections
   - Server restarts
   - Database failures
   - Network delays

## Performance Optimizations

1. **Database**
   - Index on room_states(room_id, state_version)
   - JSONB indexing for common queries
   - Connection pooling

2. **Caching**
   - Redis for active room states
   - 5-second TTL for state cache
   - Invalidate on any action

3. **API**
   - Response compression
   - HTTP/2 for SSE
   - CDN for static assets

## Monitoring & Observability

### Metrics
- Action processing time (p50, p95, p99)
- SSE connection count
- Polling fallback rate
- Error rates by type
- Room completion rate

### Logging
- All actions to user_actions table
- Error details with stack traces
- Performance timing for each step
- User journey tracking

### Alerts
- High error rate (>5%)
- Slow action processing (>2s)
- SSE connection failures
- Database connection issues

## Benefits of This Approach

1. **Reliability**: Single source of truth eliminates sync issues
2. **Simplicity**: Dramatically reduced code complexity
3. **Debuggability**: Complete audit trail of all actions
4. **Scalability**: Stateless servers, easy horizontal scaling
5. **Maintainability**: Clear separation of concerns
6. **Testability**: Pure functions, easy to test
7. **User Experience**: Faster, more reliable, better error handling

## Timeline

- **Week 1**: Backend implementation and testing
- **Week 2**: Frontend refactor and integration
- **Week 3**: Testing, optimization, and deployment

## Conclusion

This refactoring addresses all critical issues in the current implementation while providing a much simpler, more reliable architecture. The server-driven approach eliminates race conditions, simplifies state management, and provides a better foundation for future enhancements. 