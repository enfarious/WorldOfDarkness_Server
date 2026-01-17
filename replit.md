# Ash & Aether: Life at the Shatterline

## Overview
MMO game server for "Ash & Aether: Life at the Shatterline" - a tactical supernatural combat and wildlife simulation game.

## Recent Changes
- **2026-01-17**: Added Replit Auth integration for user authentication
  - Added Session model to Prisma schema
  - Extended Account model with Replit Auth fields (replitId, profileImageUrl, firstName, lastName)
  - Created auth module at `src/auth/` with OpenID Connect integration

## Project Architecture

### Tech Stack
- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Framework**: Express.js + Socket.IO
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Replit Auth (OpenID Connect)

### Directory Structure
```
src/
├── auth/           # Replit Auth integration
├── ai/             # NPC AI and LLM services
├── combat/         # Combat system and damage calculation
├── commands/       # Game commands (movement, combat, social, etc.)
├── database/       # Prisma database services
├── game/           # Game mechanics (stats, abilities)
├── gateway/        # Gateway server for distributed architecture
├── messaging/      # Message bus and zone registry
├── network/        # GameServer, connection management
├── utils/          # Logging and utilities
├── wildlife/       # Wildlife and flora simulation
├── world/          # Zone and world management
└── zoneserver/     # Zone server for distributed architecture
```

### Auth Routes
- `GET /api/login` - Begin login flow (redirects to Replit)
- `GET /api/auth/callback` - OAuth callback
- `GET /api/logout` - Logout and redirect to home
- `GET /api/auth/user` - Get current authenticated user

### Key Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
```

## User Preferences
(To be updated based on user feedback)
