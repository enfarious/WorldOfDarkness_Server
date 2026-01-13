# Perception and Interest System

This document consolidates spatial interest management, proximity roster behavior, and update efficiency in one place. It replaces the older proximity-only docs with a single reference.

## System Layers

1) Interest management (who should be known at all)
2) Proximity roster (what a client can perceive and interact with)
3) Delta updates and dirty tracking (how updates are transported efficiently)

## Interest Management (Planned)

### Goals

- Avoid spammy in/out changes at edges.
- Prioritize combat and group relevance first.
- Keep group allies visible across the entire zone.

### Priority Order (highest to lowest)

1. Engaged mobs (actively fighting the client).
2. Pets, companions, party members.
3. Alliance members.
4. Mobs (hostiles and neutrals).
5. Non-allied / non-partied PCs.
6. NPCs (non-combatant, ambient).
7. Environment / shrubbery.

### Spatial Grid Model

- Client-centered grid; the character is the origin of their own grid.
- Default cell size: **600 ft to edge** from center.
  - This implies a **cell width of 1200 ft**.
  - Cell size may scale down in high-density areas.
- Interest subscriptions are based on:
  - The cell containing the client.
  - Neighboring cells (start with 8 neighbors for a 3x3).

### Hysteresis Buffer

- Buffer thickness: **20 ft**.
- Entities crossing a cell edge do not trigger an interest change until they move past the buffer boundary.
- Applies to both entry and exit to reduce rapid subscribe/unsubscribe near edges.

### Group and Ally Rules

- Companions, pets, party, alliance, and temporary NPC allies are **range-exempt within a zone**.
- Cross-zone relevance is not required beyond knowing which zone they are in.

### Fast Movers and Teleports

- Outside of teleports, entities should not move fast enough to skip a tick.
- If an entity can cross multiple cells in a tick, flag it as:
  - Non-combatant
  - Non-entity (pass-through only)
- Teleports trigger an interest reset:
  - Clear old interest set.
  - Rebuild interest set atomically for the new position.

## Proximity Roster (Implemented)

The proximity roster provides social context and spatial navigation data per client. It does not decide who is relevant; it expresses what the client can perceive about entities it already knows.

### Channels

| Channel | Range | Purpose |
|---------|-------|---------|
| **touch** | ~5 feet | Physical interaction, trading, intimate conversation |
| **say** | 20 feet | Normal conversation, primary social channel |
| **shout** | 150 feet | Loud communication, announcements |
| **emote** | 150 feet | Actions, gestures (requires sight OR hearing) |
| **see** | 150 feet | Visual perception (affects emote interpretation) |
| **hear** | 150 feet | Auditory perception (affects all verbal channels) |
| **cfh** | 250 feet | Call for help - emergency only, danger-gated |

### Message Format

```typescript
interface ProximityRosterMessage {
  type: 'proximity_roster';
  timestamp: number;
  payload: {
    channels: {
      touch: ProximityChannel;
      say: ProximityChannel;
      shout: ProximityChannel;
      emote: ProximityChannel;
      see: ProximityChannel;
      hear: ProximityChannel;
      cfh: ProximityChannel;
    };
    dangerState: boolean;  // true if in combat/danger
  };
}

interface ProximityEntity {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'companion';
  bearing: number;     // 0-360 degrees (0=North, 90=East, 180=South, 270=West)
  elevation: number;   // -90 to 90 degrees (negative=down, positive=up)
  range: number;       // Distance in feet
}

interface ProximityChannel {
  count: number;               // Total entities in range
  sample?: string[];           // Present ONLY if count <= 3
  entities: ProximityEntity[]; // ALWAYS present - full list with spatial data
  lastSpeaker?: string;        // Present ONLY if count <= 3 and someone spoke recently
}
```

### Social Bandwidth Rules

- 0: silent (no speaking into the void)
- 1: personal (use name freely)
- 2-3: small group (use names, respond to last speaker)
- 4+: crowd (no names; use general address)

### Channel Gating

- `cfh` only when `dangerState` is true.
- Visual emotes require `see` > 0; audible emotes require `hear` > 0.

## Delta Updates (Implemented)

Delta updates send **only what changed**, reducing payload size and client work.

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
  added?: ProximityEntity[];
  removed?: string[];
  updated?: ProximityEntityDelta[];
  count?: number;
  sample?: string[];
  lastSpeaker?: string | null;
}

interface ProximityEntityDelta {
  id: string;
  bearing?: number;
  elevation?: number;
  range?: number;
}
```

### Client Cache (Required)

Clients maintain a cached roster and apply deltas.

## Dirty Tracking (Implemented)

Hash-based dirty tracking skips sending when nothing changed:

- Hash includes entity IDs, ranges (rounded to 0.1), and danger state.
- If hash matches, no roster or delta is sent.

## Tick and Bandwidth Notes

- Target tick rate: **30 TPS** (aspirational).
- Network sends: one packet per client per tick, if changes exist.
- Per-client byte budgets are a planned tuning item.

## Testing Checklist (Quick)

- Proximity counts update correctly as entities enter/leave range.
- Sample names appear only when count <= 3.
- Danger state toggles send deltas.
- No deltas are sent when nothing changed.
- Client cache applies deltas without losing entities.

