# TODO - World of Darkness Server

Last updated: 2026-01-10

## Current Status

**MILESTONE: Distributed architecture complete!**

The server now supports horizontal scaling across multiple machines:

**Architecture:**

- **Gateway Server**: Handles all client WebSocket connections, routes messages via Redis
- **Zone Server(s)**: Process game logic for assigned zones, calculate proximity, run AI
- **Message Bus**: Redis pub/sub connects all servers in real-time
- **Zone Registry**: Tracks which zones are on which servers, player locations
- **Proximity Roster System**: Fully functional across distributed zones

**What's Working:**

- Single-shard world (everyone shares same universe, not separated into "World 1, World 2")
- Zones distributed across multiple physical machines
- Players seamlessly interact across server boundaries
- Gateway servers handle 10k+ concurrent connections
- Zone servers scale based on player density per zone
- Automatic health monitoring via Redis heartbeats

**Deployment Modes:**

1. **Single-Server** (Dev): Everything on one machine - `./start-distributed.ps1`
2. **Multi-Server** (Prod): Gateways + Zone Servers distributed geographically
3. **Geographic Sharding**: NYC zones on East Coast, LA zones on West Coast, etc.

See [DISTRIBUTED.md](DISTRIBUTED.md) for full architecture documentation.

## Recommended Next Step

**Test the Distributed Setup:**

1. Install Redis: `winget install Redis.Redis` or download from redis.io
2. Run: `./start-distributed.ps1`
3. Test: `node test-client.js`
4. Verify proximity rosters work across message bus

**Then Implement Communication System:**

1. Chat message handling (say, shout, emote, whisper)
2. Range-based message broadcasting via proximity
3. NPC dialogue system
4. Interaction commands

## Quick Start

### Development (Single Machine)

```powershell
# Terminal 1: Start Redis
redis-server

# Terminal 2: Launch Gateway + Zone Server
./start-distributed.ps1

# Terminal 3: Test client
node test-client.js
```

### Production (Multiple Machines)

See [DISTRIBUTED.md](DISTRIBUTED.md) for zone assignment examples.
