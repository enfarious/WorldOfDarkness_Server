# Proximity Roster Delta Updates

## Overview

Delta updates send **only what changed** instead of the full proximity roster, dramatically reducing network traffic and CPU overhead for clients.

## How It Works

### Before (Hash-Based Dirty Tracking)

✅ **What we had**: Skip sending if nothing changed
❌ **Problem**: Still sent **full roster** when something did change

```typescript
// Player A moves
// Hash changes
// Send FULL roster: { channels: { say: { entities: [...100 entities...] } } }
```

### After (Delta Updates)

✅ **What we have now**: Send **only the changes**

```typescript
// Player A moves
// Calculate delta
// Send ONLY: { channels: { say: { updated: [{ id: "A", range: 15.3 }] } } }
```

## Protocol

### Full Roster (First Time Only)

Sent on initial connection or when client requests full sync:

```json
{
  "type": "proximity_roster_delta",
  "timestamp": 1704859200000,
  "payload": {
    "channels": {
      "say": {
        "added": [
          { "id": "char1", "name": "Alice", "type": "player", "bearing": 45, "elevation": 0, "range": 15.2 },
          { "id": "char2", "name": "Bob", "type": "player", "bearing": 180, "elevation": 0, "range": 8.5 }
        ],
        "count": 2,
        "sample": ["Alice", "Bob"]
      }
    },
    "dangerState": false
  }
}
```

### Delta Update (Subsequent Changes)

Only what changed:

```json
{
  "type": "proximity_roster_delta",
  "timestamp": 1704859205000,
  "payload": {
    "channels": {
      "say": {
        "updated": [
          { "id": "char1", "range": 12.8 }
        ]
      }
    }
  }
}
```

### Delta Message Structure

```typescript
interface ProximityRosterDeltaMessage {
  type: 'proximity_roster_delta';
  payload: {
    channels?: {
      touch?: ProximityChannelDelta;
      say?: ProximityChannelDelta;
      shout?: ProximityChannelDelta;
      emote?: ProximityChannelDelta;
      see?: ProximityChannelDelta;
      hear?: ProximityChannelDelta;
      cfh?: ProximityChannelDelta;
    };
    dangerState?: boolean;  // Only present if changed
  };
  timestamp: number;
}

interface ProximityChannelDelta {
  added?: ProximityEntity[];        // Entities that entered range
  removed?: string[];               // Entity IDs that left range
  updated?: ProximityEntityDelta[]; // Position changes
  count?: number;                   // New count (if changed)
  sample?: string[];                // New sample array (if changed)
  lastSpeaker?: string | null;      // New lastSpeaker (null = cleared)
}

interface ProximityEntityDelta {
  id: string;
  bearing?: number;     // Only present if changed
  elevation?: number;   // Only present if changed
  range?: number;       // Only present if changed
}
```

## Client Implementation

Clients must maintain a **cached roster** and apply deltas:

```typescript
class ProximityRosterCache {
  private roster: ProximityRosterMessage['payload'] = {
    channels: {
      touch: { count: 0, entities: [] },
      say: { count: 0, entities: [] },
      shout: { count: 0, entities: [] },
      emote: { count: 0, entities: [] },
      see: { count: 0, entities: [] },
      hear: { count: 0, entities: [] },
      cfh: { count: 0, entities: [] },
    },
    dangerState: false,
  };

  applyDelta(delta: ProximityRosterDeltaMessage['payload']): void {
    // Apply danger state change
    if (delta.dangerState !== undefined) {
      this.roster.dangerState = delta.dangerState;
    }

    // Apply channel deltas
    if (delta.channels) {
      for (const [channelName, channelDelta] of Object.entries(delta.channels)) {
        if (!channelDelta) continue;

        const channel = this.roster.channels[channelName as keyof typeof this.roster.channels];
        this.applyChannelDelta(channel, channelDelta);
      }
    }
  }

  private applyChannelDelta(
    channel: ProximityChannel,
    delta: ProximityChannelDelta
  ): void {
    // Add new entities
    if (delta.added) {
      for (const entity of delta.added) {
        // Remove if already exists (shouldn't happen, but defensive)
        channel.entities = channel.entities.filter(e => e.id !== entity.id);
        channel.entities.push(entity);
      }
    }

    // Remove entities
    if (delta.removed) {
      for (const entityId of delta.removed) {
        channel.entities = channel.entities.filter(e => e.id !== entityId);
      }
    }

    // Update entity positions
    if (delta.updated) {
      for (const update of delta.updated) {
        const entity = channel.entities.find(e => e.id === update.id);
        if (entity) {
          if (update.bearing !== undefined) entity.bearing = update.bearing;
          if (update.elevation !== undefined) entity.elevation = update.elevation;
          if (update.range !== undefined) entity.range = update.range;
        }
      }
    }

    // Update metadata
    if (delta.count !== undefined) channel.count = delta.count;
    if (delta.sample !== undefined) channel.sample = delta.sample;
    if (delta.lastSpeaker !== undefined) {
      channel.lastSpeaker = delta.lastSpeaker || undefined;
    }
  }

  getRoster(): ProximityRosterMessage['payload'] {
    return this.roster;
  }
}
```

## Example Scenarios

### Scenario 1: Player Enters Say Range

**Delta Sent**:
```json
{
  "channels": {
    "say": {
      "added": [
        { "id": "char3", "name": "Charlie", "type": "player", "bearing": 90, "elevation": 0, "range": 18.5 }
      ],
      "count": 3,
      "sample": ["Alice", "Bob", "Charlie"]
    }
  }
}
```

**Bytes**: ~150 bytes
**vs Full Roster**: ~600 bytes (3 entities, all channels)
**Savings**: 75%

### Scenario 2: Player Moves Slightly

**Delta Sent**:
```json
{
  "channels": {
    "say": {
      "updated": [
        { "id": "char1", "bearing": 47, "range": 12.3 }
      ]
    }
  }
}
```

**Bytes**: ~60 bytes
**vs Full Roster**: ~600 bytes
**Savings**: 90%

### Scenario 3: Player Leaves Range

**Delta Sent**:
```json
{
  "channels": {
    "say": {
      "removed": ["char2"],
      "count": 2,
      "sample": ["Alice", "Charlie"]
    }
  }
}
```

**Bytes**: ~80 bytes
**vs Full Roster**: ~400 bytes (2 entities remaining)
**Savings**: 80%

### Scenario 4: Combat Starts

**Delta Sent**:
```json
{
  "dangerState": true
}
```

**Bytes**: ~30 bytes
**vs Full Roster**: ~600 bytes
**Savings**: 95%

### Scenario 5: No Changes

**Delta Sent**: *Nothing* (skipped entirely)

**Bytes**: 0 bytes
**vs Full Roster**: ~600 bytes
**Savings**: 100%

## Performance Impact

### Network Traffic Reduction

| Scenario | Before (Full) | After (Delta) | Savings |
|----------|---------------|---------------|---------|
| Player stands still | 0 bytes (skipped) | 0 bytes (skipped) | 0% |
| Player moves slightly | 600 bytes | 60 bytes | **90%** |
| Player enters range | 600 bytes | 150 bytes | **75%** |
| Player leaves range | 600 bytes | 80 bytes | **87%** |
| Combat state change | 600 bytes | 30 bytes | **95%** |
| Crowded zone (50 entities) | 15,000 bytes | 60 bytes (position update) | **99.6%** |

### CPU Savings (Client-Side)

**Before**: Parse and replace entire roster (all 7 channels, all entities)
**After**: Apply delta (only changed fields)

- **JSON parsing**: 90% smaller payload
- **Memory allocation**: Reuse existing entities, only update changed fields
- **UI updates**: Only re-render affected entities

## Migration Strategy

### Phase 1: Server Supports Both (Current)

- Server sends `proximity_roster_delta`
- Old clients ignore it (not listening)
- Server can add backwards-compatible full roster fallback if needed

### Phase 2: Clients Implement Delta Handling

- Clients add cache + delta application logic
- Listen for `proximity_roster_delta` instead of `proximity_roster`
- Graceful degradation if server doesn't support deltas

### Phase 3: Remove Full Roster (Future)

- Once all clients updated, remove legacy `proximity_roster` message
- Cleaner protocol, no duplication

## Backwards Compatibility

For now, clients not expecting deltas will simply not receive any updates (they're listening for `proximity_roster`, not `proximity_roster_delta`).

To support old clients, add this to DistributedWorldManager:

```typescript
// Check client capabilities
const clientSupportsDeltas = this.clientCapabilities.get(characterId)?.supportsDeltas;

if (clientSupportsDeltas) {
  // Send delta
  await this.sendProximityRosterDelta(characterId);
} else {
  // Send full roster (legacy)
  await this.sendProximityRosterFull(characterId);
}
```

## Testing

### Unit Tests

```typescript
describe('ProximityRosterCache', () => {
  it('should add entities', () => {
    const cache = new ProximityRosterCache();
    cache.applyDelta({
      channels: {
        say: {
          added: [{ id: 'char1', name: 'Alice', type: 'player', bearing: 45, elevation: 0, range: 10 }],
          count: 1,
        },
      },
    });

    const roster = cache.getRoster();
    expect(roster.channels.say.entities).toHaveLength(1);
    expect(roster.channels.say.entities[0].name).toBe('Alice');
  });

  it('should update entity positions', () => {
    // ... test position updates
  });

  it('should remove entities', () => {
    // ... test removal
  });
});
```

### Integration Tests

1. **Stand Still Test**: No deltas sent
2. **Movement Test**: Only `updated` delta sent
3. **Enter Range Test**: `added` delta sent, count/sample updated
4. **Leave Range Test**: `removed` delta sent, count/sample updated
5. **Combat Test**: Only `dangerState` delta sent

## Future Optimizations

1. **Compression**: gzip/brotli on delta payloads (already small, but can go further)
2. **Batching**: Combine multiple deltas into one message if many changes in short time
3. **Predictive Caching**: Client predicts movement and pre-caches expected deltas
4. **Channel-Specific Subscriptions**: Client only subscribes to channels it cares about

## Key Insights

- **First send is full roster** (as delta with all entities in `added`)
- **Subsequent sends are deltas** (only changes)
- **No send if nothing changed** (still skipped via dirty tracking)
- **Client maintains cache** (server is stateless except for previousRoster)
- **95%+ traffic reduction** in typical gameplay scenarios

---

**Bottom Line**: Clients receive the exact same data, just incrementally instead of all at once. Massive bandwidth savings with minimal client complexity.
