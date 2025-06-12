# Decided Feature Implementation Guide

## 1. Overview

The "Decided" feature is a real-time, collaborative movie selection system designed to solve the common problem of two people spending excessive time choosing what to watch together. It uses a tournament-style bracket, ELO-based movie ratings, and real-time communication via Supabase to create a fun and engaging experience.

## 2. Core Concepts

- **Rooms**: A private, collaborative session initiated by one user and joined by another.
- **Tournament Bracket**: A single-elimination tournament generated from the combined movie watchlists of both participants.
- **Pairwise Comparison**: Users are presented with pairs of movies and must choose their preference, which advances one movie to the next round.
- **ELO Rating**: Movie preferences are recorded using an ELO rating system, which helps refine future recommendations.
- **Real-time Sync**: The entire experience is synchronized in real-time between participants using Supabase Realtime Channels.

## 3. Technical Architecture

### 3.1 Frontend

- **Framework**: Next.js with App Router
- **State Management**: Zustand for centralized, hook-based state management (`tournamentStore`).
- **UI Components**: React components built with shadcn/ui and Tailwind CSS.
- **Real-time Hooks**: Custom hooks (`useRoom`, `useTournament`) manage real-time subscriptions and interactions with the backend.
- **Optimistic UI**: State changes are applied immediately on the client-side to provide a responsive feel, with server state used as the source of truth.

### 3.2 Backend

- **Provider**: Supabase (Auth, Database, Realtime)
- **Database**: PostgreSQL with schemas managed by Drizzle ORM.
- **API**: Next.js API Routes handle room creation, joining, and tournament actions.
- **Realtime**: Supabase Realtime Channels broadcast events (`user-joined`, `tournament-started`, `pick-submitted`, etc.) to all clients in a room.

### 3.3 Database Schema

- **`users`**: Stores user profile information.
- **`watch_list`**: Contains movies added by users.
- **`rooms`**: Manages collaborative sessions, including room code, status, and participants.
- **`room_participants`**: Links users to rooms.
- **`bracket_picks`**: Records each user's pick in a tournament match.
- **`user_movie_elo`**: Stores ELO ratings for each user-movie pair.
- **`room_history`**: Archives completed tournaments for future reference.

## 4. Key Implementation Files

- **`src/app/decide-together/**`**: Entry point and UI for creating/joining rooms.
- **`src/components/decide-together/**`**: All React components for the tournament UI.
- **`src/lib/stores/tournamentStore.ts`**: Zustand store for global tournament state.
- **`src/lib/hooks/useRoom.ts`**: Manages room-level logic and channel subscriptions.
- **`src/lib/hooks/useTournament.ts`**: Handles tournament-specific logic, including submitting picks.
- **`src/app/api/rooms/**`**: Backend API endpoints for room and tournament management.

## 5. User Flow

1.  **Initiation**: User clicks "Decided" from their dashboard, which calls the `/api/rooms` endpoint to create a new room.
2.  **Lobby**: The user is redirected to the room page (`/decide-together/[code]`), where they wait for another participant.
3.  **Joining**: A second user joins using the room code, triggering a `user-joined` event.
4.  **Start Tournament**: The room owner starts the tournament, which calls the `/api/rooms/[code]/start` endpoint.
5.  **Tournament Flow**:
    - The backend generates the tournament bracket.
    - Clients receive the tournament data via a `tournament-started` event.
    - The UI transitions to the `BracketScreen` component.
    - Users make their picks, which are sent via the `/api/rooms/[code]/bracket` endpoint.
    - `pick-submitted` events are broadcast to update the UI for both users.
6.  **Winner Announcement**: Once all rounds are complete, the system determines a winner, and the UI displays the `WinnerAnnouncement` component.

This consolidated guide provides a complete overview of the "Decided" feature, replacing the previous phased markdown files. 