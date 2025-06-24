# Decided - Real-time Collaborative Movie Selection

A Next.js application for real-time, collaborative movie selection using a tournament-style system.

## Features

- 🔐 Google OAuth authentication via Supabase
- 👥 Real-time collaborative rooms for 2 participants
- 🎬 Tournament-style movie selection from merged watchlists
- 🏆 ELO-based rating system for movie preferences
- 💾 Data persistence to Supabase tables
- 🎨 Modern UI with Tailwind CSS and shadcn/ui
- 📱 Mobile-first responsive design
- 🔄 Real-time synchronization with optimistic UI updates

## Prerequisites

Before running this application, make sure you have:

- Node.js 18+ installed
- A Supabase project set up
- Google OAuth configured in your Supabase project

## Installation

1. Clone and navigate to the project:
```bash
cd decided
```

2. Install dependencies:
```bash
npm install
```

3. The environment variables are already configured in `.env.local`.

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

---

## Local Real-time Testing with ngrok (WebSocket Tunneling)

To test real-time tournament flows with two users (on different devices or networks), you need your local Supabase Realtime server to be publicly accessible. You can do this using [ngrok](https://ngrok.com/):

1. **Start your local Supabase backend** (if not already running).
2. **Start ngrok** to tunnel your Supabase backend port (default is 54321):
   ```bash
   ngrok http 54321
   ```
3. **Copy the public ngrok URL** (e.g., `https://abcd1234.ngrok.io`).
4. **Update your `.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.ngrok.io
   ```
   (Keep your existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` value.)
5. **Restart your Next.js app** if it was running.
6. **Open the app on two devices/browsers** using the ngrok URL to test real-time features.

**Note:**
- Never use ngrok for production.
- For security, restrict access to your tunnel if possible.
- If you use a custom port or a different tunnel provider, adjust the instructions accordingly.

---

## How It Works

### Core Feature: Decided

1. **Room Creation**: A user initiates a session, creating a unique room code.
2. **Invitation**: The user shares the code or a QR code with a friend.
3. **Lobby**: Both users join the room and can see each other in the lobby.
4. **Tournament**: The tournament starts, merging movies from both users' watchlists.
5. **Pairwise Comparison**: Each user is presented with pairs of movies and chooses their preference.
6. **Winner**: After several rounds, a winning movie is chosen and added to both users' watchlists.

### Key Components

- **`src/app/decide-together`**: Main entry point and room management UI.
- **`src/components/decide-together`**: Components for the tournament interface.
- **`src/lib/hooks/useRoom.ts`**: Hook for managing room state and real-time events.
- **`src/lib/stores/tournamentStore.ts`**: Zustand store for centralized state management.
- **`src/lib/tournament-engine.ts`**: Core logic for generating tournament brackets.

## Technology Stack

- **Next.js 15** - React framework with App Router
- **Supabase** - Backend as a Service for auth, database, and real-time
- **Drizzle ORM** - TypeScript ORM for database access
- **Zustand** - State management
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety and better developer experience

## Supabase Configuration

Make sure your Supabase project is configured with:

1. **Google OAuth Provider** enabled in Authentication settings
2. **Authorized redirect URLs** including your development and production URLs
3. **Users table** created with the schema above

## Building for Production

```bash
npm run build
npm start
```

## Security Notes

- Environment variables are properly configured for client-side usage
- Authentication state is managed securely with Supabase
- Database operations use Row Level Security (RLS) policies
- OAuth redirect URLs should be properly configured in production
