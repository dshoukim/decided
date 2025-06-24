# Project Brief: Decided - Real-time Collaborative Movie Selection

## Project Overview

**Decided** is a Next.js web application that enables real-time collaborative movie selection between two users through a tournament-style voting system. Users create or join rooms, merge their movie watchlists, and participate in pairwise movie comparisons to collectively decide on a movie to watch together.

## Core Requirements

### Functional Requirements
1. **User Authentication**: Google OAuth via Supabase for secure user management
2. **Room Management**: Create/join rooms with unique 6-character codes
3. **Real-time Collaboration**: Two users can participate simultaneously with live synchronization
4. **Tournament System**: Bracket-style movie elimination from merged watchlists
5. **Movie Database Integration**: TMDB API for movie data and poster images
6. **Personal Movie Management**: User watchlists with ratings and preferences
7. **ELO Rating System**: Sophisticated preference tracking for movie recommendations
8. **Cross-platform Support**: Mobile-first responsive design

### Technical Requirements
- **Performance**: Sub-second real-time updates between participants
- **Reliability**: Graceful degradation when real-time features fail
- **Data Consistency**: Single source of truth with conflict resolution
- **Security**: Row Level Security (RLS) for all database operations
- **Scalability**: Support for concurrent rooms and users

## Success Criteria

### User Experience
- Room creation and joining works within 10 seconds
- Tournament progression feels smooth and responsive
- Clear visual feedback for user actions and partner status
- Intuitive mobile interface for all features

### Technical Performance
- Real-time synchronization latency < 500ms
- Zero data loss during network interruptions
- Proper error handling with user-friendly messages
- Clean tournament completion with winner persistence

## Project Scope

### In Scope
- Two-player collaborative movie selection
- Tournament-style voting with multiple rounds
- Real-time synchronization via Supabase Realtime
- Movie data from TMDB API
- User preference learning via ELO ratings
- Mobile-responsive UI design

### Out of Scope
- Multi-room management for single user
- Group sessions (>2 participants)
- Video streaming integration
- Advanced recommendation algorithms beyond ELO
- Social features (friends, sharing, etc.)

## Key Constraints

### Technical Constraints
- Next.js 15 with App Router architecture
- Supabase as Backend-as-a-Service
- TypeScript for type safety
- Drizzle ORM for database operations
- Client-side state management with Zustand

### Business Constraints
- Free-tier Supabase usage limits
- TMDB API rate limiting
- Development timeline focused on core features
- Simple, focused user experience

## Risk Assessment

### High Risk
- Real-time synchronization complexity and race conditions
- Tournament state management across multiple components
- Network connectivity issues affecting user experience

### Medium Risk
- TMDB API integration and rate limiting
- Mobile performance on slower devices
- User authentication edge cases

### Low Risk
- Basic CRUD operations for movies and users
- Static UI components and styling
- Database schema design

## Success Metrics

### Technical Metrics
- 99.9% uptime for core features
- <500ms average response time for API endpoints
- Zero data corruption incidents
- Successful tournament completion rate >95%

### User Experience Metrics
- Tournament completion rate per session
- Average session duration
- User return rate for multiple sessions
- Error rate during room joining/creation

This project brief serves as the foundation for all development decisions and architectural choices within the Decided application. 