# Tournament Testing Guide

## Problem Fixed

The main issue was an infinite loop error caused by unstable Zustand selectors in `useTournament.ts`. The selector was creating new objects on every render, causing React to think the state had changed continuously.

## Key Fixes Applied

### 1. Fixed useTournament.ts
- Replaced object-creating selector with individual property selectors
- Used stable references for store actions
- Proper memoization of computed values

### 2. Fixed useRoom.ts
- Stabilized user info dependencies using useState instead of useRef
- Fixed useEffect dependencies to prevent unnecessary realtime reconnections
- Improved connection state management

### 3. Created Test UI
- Added `/test-tournament-ui` page for easier testing
- Shows real-time connection status and tournament progress

## Local Testing Instructions

### Step 1: Start Development Server
```bash
npm run dev
```

### Step 2: Test with Single Browser
1. Go to `http://localhost:3000/test-tournament-ui`
2. Click "Create Test Room"
3. Click "Join Room" 
4. Verify no infinite loop errors in console
5. Check that connection status shows "connected"

### Step 3: Test with Two Browsers
1. **Browser 1 (Regular):**
   - Go to `http://localhost:3000/decide-together`
   - Click "Create Room"
   - Copy the room code

2. **Browser 2 (Incognito):**
   - Go to `http://localhost:3000/decide-together/[ROOM_CODE]`
   - Page should load without errors
   - Should show "Join Room" button

3. **Both browsers:**
   - Click "Join Room" in Browser 2
   - Verify both show 2/2 participants
   - Click "Start Tournament" in Browser 1
   - Both should show tournament interface

### Step 4: Verify Real-time Features
- Check that participant status updates in real-time
- Verify tournament start propagates to both browsers
- Confirm no infinite loop errors in either browser console

## Expected Behavior

### ✅ Working Features
- Room creation and joining
- Real-time participant updates
- Tournament generation and start
- Stable React rendering (no infinite loops)
- Connection status indicators

### 🚫 Previously Broken
- Infinite loop errors from Zustand selectors
- Unstable useEffect dependencies
- Connection conflicts

## Debug Information

### Console Logs to Monitor
- `Realtime connected for room: [ROOM_CODE]`
- `Tournament started successfully`
- No "infinite loop" errors
- No repeated connection attempts

### Key Metrics
- Page should load in < 2 seconds
- Real-time updates should propagate within 1 second
- No memory leaks or excessive re-renders

## Production Testing

The same testing can be done on the hosted version:
1. Deploy the changes
2. Open two different devices/browsers
3. Follow the same testing steps
4. Verify real-time features work across network

## Troubleshooting

### If you still see infinite loops:
1. Check browser console for specific error location
2. Verify Zustand selectors are not creating new objects
3. Ensure useEffect dependencies are stable

### If real-time isn't working:
1. Check Supabase connection in Network tab
2. Verify WebSocket connections are established
3. Check for subscription conflicts in console

### If tournament doesn't start:
1. Ensure exactly 2 participants joined
2. Check API logs for tournament generation errors
3. Verify room owner permissions 