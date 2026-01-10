# TODO - World of Darkness Server

Last updated: 2026-01-10

## Current Status

**MILESTONE: Proximity roster system complete!**

The social awareness system is now fully functional:

- ZoneManager tracks all entities (players, NPCs, companions) in each zone
- Proximity rosters calculate who can see/hear/interact with whom in real-time
- Movement updates trigger automatic roster broadcasts to nearby players
- All 7 communication channels implemented (touch, say, shout, emote, see, hear, cfh)
- Last speaker tracking for conversational context
- Test client enhanced with movement simulation

Players now receive proximity_roster messages when:

- They enter a zone
- They move
- Another player enters/exits/moves in their zone

## Recommended Next Step

**Implement Communication System** - Let players talk to each other.

The proximity system is ready. Now we need:

1. Chat message handling (say, shout, emote, whisper)
2. Range-based message broadcasting
3. NPC dialogue system
4. Interaction commands

See full TODO list in this file below.
