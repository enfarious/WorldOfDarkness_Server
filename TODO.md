# TODO - World of Darkness Server

Last updated: 2026-01-09

## Current Status

**MILESTONE**: First successful client connection achieved! 🎉

The server can now accept connections, authenticate guests, and send world state to text clients.

## Completed Systems

### Phase 1: Foundation ✅
- [x] Project structure and TypeScript setup
- [x] Complete architecture documentation
- [x] Comprehensive README and docs organization
- [x] Environment configuration (.env.example)
- [x] Database schema (Prisma) - complete with all models
  - [x] Account model with age verification
  - [x] Character model with full stat system
  - [x] Zone model with content ratings
  - [x] Inventory, items, factions, quests, combat logs
  - [x] AI companions and NPCs
- [x] Networking layer
  - [x] Socket.io WebSocket server
  - [x] Protocol version negotiation
  - [x] Client session management
  - [x] Connection manager with handshake flow
- [x] Client protocol complete
  - [x] Handshake → Auth → Character Select → World Entry flow
  - [x] Test client working (test-client.js)
  - [x] Event-per-type messaging (Socket.io idiomatic)

### Content Safety & Rating System ✅
- [x] ESRB-style content ratings (T/M/AO)
- [x] Zone-based content rating system
- [x] Age verification framework
- [x] Parental controls structure
- [x] LLM system prompt integration for content safety

### Movement System ✅
- [x] Unified 3D coordinate system
- [x] Heading-based navigation (0-360°)
- [x] Three movement methods:
  - [x] Heading method (universal)
  - [x] Compass method (text clients: N, NE, E, etc.)
  - [x] Position method (3D/VR direct)
- [x] Movement speed system (walk, jog, run, stop)
- [x] 3D → 2D → Text translation architecture

### RPG Systems ✅
- [x] Complete stat system
  - [x] 6 core stats (STR, VIT, DEX, AGI, IQ, WIS)
  - [x] Derived stats calculation (HP, stamina, mana, ATK, DEF, etc.)
  - [x] StatCalculator utility with all formulas
- [x] Progression system
  - [x] XP for character growth
  - [x] AP (Ability Points) for unlocking abilities
  - [x] Feat system unlocked at stat milestones (15, 25, 40)
- [x] Combat framework
  - [x] Active Time Battle (ATB) system design
  - [x] 8/8/4 loadout system (8 active, 8 passive, 4 special)
  - [x] Weapon scaling system (S/A/B/C/D ranks)
  - [x] Hit chance and damage formulas
  - [x] Status effects and passive triggers
- [x] Ability type system complete

### Social & Communication Systems ✅
- [x] Proximity roster system
  - [x] 7 communication channels (touch, say, shout, emote, see, hear, cfh)
  - [x] Social bandwidth encoding (1-3 = names, 4+ = crowd)
  - [x] lastSpeaker tracking for small groups
  - [x] dangerState gating for Call for Help
- [x] Player inspection (/look command)
  - [x] Privacy-preserving demographic data
  - [x] Age group (minor/adult) - never exact age
  - [x] Player-provided pronouns
- [x] Communication ranges
  - [x] Touch: 5 feet
  - [x] Say: 20 feet
  - [x] Shout: 150 feet
  - [x] Emote: 150 feet
  - [x] See/Hear: 150 feet
  - [x] Call for Help: 250 feet

## Current Phase: Implementation

### Immediate Priorities

1. **Database Integration** - Make it real
   - [ ] Run Prisma migrations (create actual database)
   - [ ] Create seed data (starter zone, test accounts)
   - [ ] Implement database service layer
   - [ ] Replace mock data in ClientSession with real DB queries

2. **World Manager** - Bring zones to life
   - [ ] ZoneManager class
   - [ ] Load zones from database
   - [ ] Track entities per zone (players, NPCs)
   - [ ] Calculate proximity roster in real-time
   - [ ] Send proximity updates to clients

3. **Movement Implementation** - Make characters move
   - [ ] Handle move messages from clients
   - [ ] Update character position in database
   - [ ] Broadcast position updates to nearby players
   - [ ] Navmesh validation (stay in bounds)
   - [ ] Collision detection (basic)

4. **Communication Implementation** - Make talking work
   - [ ] Handle chat messages (say, shout, emote, cfh)
   - [ ] Calculate who can hear based on range
   - [ ] Broadcast to listeners only
   - [ ] Implement player_peek (inspection) handler
   - [ ] Rate limiting and spam prevention

### Next Up After Implementation

5. **Authentication & Accounts** - Real user management
   - [ ] Email/password registration
   - [ ] JWT token generation and validation
   - [ ] Session persistence
   - [ ] Character creation flow
   - [ ] Account age verification system

6. **Combat System** - ATB implementation
   - [ ] Ability activation handler
   - [ ] Cooldown tracking
   - [ ] Damage calculation using StatCalculator
   - [ ] Status effect application
   - [ ] Combat state management
   - [ ] Victory/defeat resolution

7. **NPC & Companion AI** - LLM integration
   - [ ] Companion entity manager
   - [ ] Anthropic API integration
   - [ ] System prompt generation (zone context + proximity roster)
   - [ ] Airlock safety layer (pre/post validation)
   - [ ] Conversation history management
   - [ ] Action decision making

8. **Inventory & Items** - Loot and equipment
   - [ ] Item spawning
   - [ ] Inventory management
   - [ ] Equipment slots
   - [ ] Item use/consume
   - [ ] Trading between players

## Phase 3: Advanced Features (Future)

- [ ] Quest system implementation
- [ ] Faction reputation tracking
- [ ] Weather and time-of-day simulation
- [ ] Crafting system
- [ ] Player housing
- [ ] Guild/party system
- [ ] PvP combat zones
- [ ] Dungeon instances
- [ ] World events
- [ ] Achievement system

## Technical Debt / Polish

- [ ] Error handling improvements
- [ ] Comprehensive logging
- [ ] Performance monitoring
- [ ] Load testing
- [ ] API documentation (auto-generate from types?)
- [ ] Unit tests for core systems
- [ ] Integration tests for client flow
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Backup and recovery procedures

## Documentation Status

All documentation is in `docs/` directory:

- ✅ ARCHITECTURE.md - System design and tech stack
- ✅ PROTOCOL.md - Complete client-server protocol
- ✅ CLIENT_DEV_SUMMARY.md - Quick reference for client developers
- ✅ MOVEMENT_SYSTEM.md - Unified 3D movement architecture
- ✅ STAT_SYSTEM.md - Complete RPG stat and ability system
- ✅ CONTENT_SAFETY.md - Content rating and age verification
- ✅ COMMUNICATION_SYSTEM.md - Range-based social interaction
- ✅ PROXIMITY_AND_PERCEPTION.md - Social bandwidth mechanics
- ✅ QUICKSTART.md - Getting started guide
- ✅ CHANGELOG.md - Version history
- ✅ NOTES.md - Development notes and decisions

## Recommended Next Step

**Start with Database Integration** - Everything else depends on having real data.

1. Set up PostgreSQL database (local or cloud)
2. Run `npx prisma migrate dev` to create tables
3. Create seed script for starter zone
4. Implement database service layer
5. Update ClientSession to use real data

Once database is working, implement World Manager to calculate proximity rosters in real-time.

## Notes

- License: AGPL-3.0 (corrected in package.json)
- LLM Provider: Anthropic Claude API
- Combat: Active Time Battle (ATB) with cooldowns
- Protocol: Event-per-type (Socket.io idiomatic)
- Content Rating: Teen (13+) baseline
- Social Bandwidth: Names for 1-3 people, crowd mode for 4+
