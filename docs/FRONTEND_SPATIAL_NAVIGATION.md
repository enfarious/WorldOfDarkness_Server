# Frontend Guide: Spatial Navigation & Proximity Roster

**For**: Text clients, LLM agents, 2D/3D/VR clients, Discord bots

This guide explains how to use the proximity roster's spatial navigation data for combat targeting, movement, and social awareness.

## Quick Start

Every proximity roster message includes **two separate data streams**:

1. **`entities`** array - ALWAYS present, for **combat/movement/positioning**
2. **`sample`** array - Only if ≤3 entities, for **social chat context**

```typescript
interface ProximityChannel {
  count: number;              // Total entities in range
  entities: ProximityEntity[]; // ALWAYS present - use for targeting/movement
  sample?: string[];          // Only if ≤3 - use for LLM chat context
  lastSpeaker?: string;       // Only if ≤3 - use for conversation flow
}

interface ProximityEntity {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'companion';
  bearing: number;     // 0-360° (0=N, 90=E, 180=S, 270=W)
  elevation: number;   // -90 to 90° (negative=below, positive=above)
  range: number;       // Distance in feet
}
```

## Use Cases by Client Type

### Text Clients

**Display nearby entities with navigation hints:**

```typescript
function displayProximity(roster: ProximityRosterMessage['payload']) {
  const nearby = roster.channels.say.entities;

  console.log("Nearby (within 20 feet):");
  nearby.forEach(entity => {
    const dir = bearingToCompass(entity.bearing);
    const elev = describeElevation(entity.elevation);
    console.log(`  - ${entity.name}: ${dir}, ${entity.range}ft away${elev}`);
  });
}

// Output:
// Nearby (within 20 feet):
//   - Old Merchant: S, 15.2ft away
//   - Giant Ant Worker: NE, 8.3ft away
//   - Giant Ant Warrior: E, 12.1ft away, below
```

**Implement "move to" commands:**

```typescript
function handleMoveToCommand(targetName: string, roster: ProximityRosterMessage['payload']) {
  // Search all proximity channels for the target
  const allEntities = [
    ...roster.channels.say.entities,
    ...roster.channels.shout.entities,
    ...roster.channels.see.entities,
  ];

  const target = allEntities.find(e =>
    e.name.toLowerCase().includes(targetName.toLowerCase())
  );

  if (!target) {
    console.log(`Cannot find "${targetName}" nearby.`);
    return;
  }

  // Move toward the target's bearing
  socket.emit('move', {
    method: 'heading',
    heading: target.bearing,
    speed: 'walk',
    timestamp: Date.now(),
  });

  console.log(`Moving ${bearingToCompass(target.bearing)} toward ${target.name}...`);
}

// User: "move to merchant"
// → Moving S toward Old Merchant...
```

**Combat targeting:**

```typescript
function handleAttackCommand(targetName: string, roster: ProximityRosterMessage['payload']) {
  // Find attackable entities in say/see range
  const targets = roster.channels.say.entities.filter(e =>
    e.name.toLowerCase().includes(targetName.toLowerCase())
  );

  if (targets.length === 0) {
    console.log(`No ${targetName} in range.`);
    return;
  }

  if (targets.length > 1) {
    // Multiple matches - show options
    console.log(`Multiple targets found:`);
    targets.forEach((t, i) => {
      const dir = bearingToCompass(t.bearing);
      console.log(`  ${i + 1}. ${t.name} - ${dir}, ${t.range}ft`);
    });
    console.log(`Use "attack <number>" or be more specific.`);
    return;
  }

  // Single target - attack it
  const target = targets[0];
  socket.emit('combat_action', {
    abilityId: 'basic-attack',
    targetId: target.id,
    timestamp: Date.now(),
  });
}

// User: "attack ant"
// Multiple targets found:
//   1. Giant Ant Worker - NE, 8.3ft
//   2. Giant Ant Warrior - E, 12.1ft
//   3. Giant Ant Warrior - SE, 15.7ft
```

### LLM Agents / AI Clients

**Use spatial data for natural language navigation:**

```typescript
async function llmNavigate(instruction: string, roster: ProximityRosterMessage['payload']) {
  // LLM understands the spatial context
  const prompt = `
You are navigating a 3D space. Current nearby entities:

${roster.channels.say.entities.map(e =>
  `- ${e.name} (${e.type}): ${bearingToCompass(e.bearing)}, ${e.range}ft away, elevation ${e.elevation}°`
).join('\n')}

Instruction: "${instruction}"

Respond with JSON: { "action": "move", "heading": <0-360>, "reason": "..." }
or { "action": "none", "reason": "..." }
  `;

  const response = await callLLM(prompt);

  if (response.action === 'move') {
    socket.emit('move', {
      method: 'heading',
      heading: response.heading,
      speed: 'walk',
      timestamp: Date.now(),
    });
  }
}

// User: "Walk toward the merchant"
// LLM sees: Old Merchant (companion): S, 15.2ft away, elevation 0°
// LLM outputs: { action: "move", heading: 180, reason: "Moving south toward Old Merchant" }
```

**Combat decision-making:**

```typescript
async function llmCombat(roster: ProximityRosterMessage['payload']) {
  const enemies = roster.channels.say.entities.filter(e =>
    e.type === 'npc' && e.name.includes('Ant')
  );

  const prompt = `
You are in combat. Enemies in range:

${enemies.map(e =>
  `- ${e.name}: ${bearingToCompass(e.bearing)}, ${e.range}ft, ${describeElevation(e.elevation)}`
).join('\n')}

Tactical note: Warriors have high armor, workers are weak but numerous, queen is priority.

Choose a target. Respond with JSON: { "targetId": "...", "reason": "..." }
  `;

  const response = await callLLM(prompt);

  socket.emit('combat_action', {
    abilityId: 'fireball',
    targetId: response.targetId,
    timestamp: Date.now(),
  });
}
```

**Social awareness (use `sample` array):**

```typescript
async function llmChat(message: string, roster: ProximityRosterMessage['payload']) {
  const socialContext = roster.channels.say.sample
    ? `You are chatting with: ${roster.channels.say.sample.join(', ')}.`
    : `You are in a crowd of ${roster.channels.say.count} people. Use general address.`;

  const prompt = `
${socialContext}
${roster.channels.say.lastSpeaker ? `${roster.channels.say.lastSpeaker} just spoke.` : ''}

Recent message: "${message}"

Respond naturally (1-2 sentences).
  `;

  const response = await callLLM(prompt);

  socket.emit('chat', {
    channel: 'say',
    message: response,
    timestamp: Date.now(),
  });
}
```

### 2D/3D Clients

**Render entity positions:**

```typescript
function renderEntities(roster: ProximityRosterMessage['payload'], playerPos: Vector3) {
  roster.channels.see.entities.forEach(entity => {
    // Convert bearing + range to world position
    const worldPos = bearingToWorldPosition(
      playerPos,
      entity.bearing,
      entity.range,
      entity.elevation
    );

    // Render entity at world position
    scene.addEntity(entity.id, {
      name: entity.name,
      type: entity.type,
      position: worldPos,
    });
  });
}

function bearingToWorldPosition(
  origin: Vector3,
  bearing: number,
  range: number,
  elevation: number
): Vector3 {
  // Convert bearing (degrees) to radians
  const bearingRad = (bearing * Math.PI) / 180;

  // Calculate horizontal offset
  const dx = Math.sin(bearingRad) * range * Math.cos((elevation * Math.PI) / 180);
  const dy = Math.cos(bearingRad) * range * Math.cos((elevation * Math.PI) / 180);

  // Calculate vertical offset
  const dz = Math.sin((elevation * Math.PI) / 180) * range;

  return {
    x: origin.x + dx,
    y: origin.y + dy,
    z: origin.z + dz,
  };
}
```

**Click-to-target:**

```typescript
function onEntityClick(entityId: string, roster: ProximityRosterMessage['payload']) {
  // Find entity in proximity roster
  const allEntities = Object.values(roster.channels).flatMap(ch => ch.entities);
  const entity = allEntities.find(e => e.id === entityId);

  if (!entity) return;

  // Show context menu
  showContextMenu(entity, [
    { label: 'Talk to', action: () => startConversation(entity.id) },
    { label: 'Attack', action: () => attackTarget(entity.id) },
    { label: 'Move to', action: () => moveToEntity(entity) },
    { label: 'Examine', action: () => examineEntity(entity.id) },
  ]);
}

function moveToEntity(entity: ProximityEntity) {
  socket.emit('move', {
    method: 'heading',
    heading: entity.bearing,
    speed: 'jog',
    timestamp: Date.now(),
  });
}
```

### VR Clients

**Spatial audio positioning:**

```typescript
function updateSpatialAudio(roster: ProximityRosterMessage['payload']) {
  roster.channels.hear.entities.forEach(entity => {
    const audioSource = audioManager.get(entity.id);

    // Convert bearing + elevation to 3D audio position
    audioSource.setPosition({
      bearing: entity.bearing,
      elevation: entity.elevation,
      distance: entity.range,
    });

    // Adjust volume based on distance
    const volume = Math.max(0, 1 - (entity.range / 150)); // 150ft = hear range
    audioSource.setVolume(volume);
  });
}
```

**Hand gesture targeting:**

```typescript
function onHandPointGesture(handRayDirection: Vector3, roster: ProximityRosterMessage['payload']) {
  const playerHeading = getCurrentHeading();
  const rayBearing = vectorToBearing(handRayDirection);
  const rayElevation = vectorToElevation(handRayDirection);

  // Find entities within gesture cone (±15° bearing, ±10° elevation)
  const targets = roster.channels.see.entities.filter(entity => {
    const bearingDiff = Math.abs(angleDifference(rayBearing, entity.bearing));
    const elevDiff = Math.abs(rayElevation - entity.elevation);

    return bearingDiff <= 15 && elevDiff <= 10;
  });

  if (targets.length === 0) {
    showHint("No target in that direction");
    return;
  }

  // Select closest target
  const target = targets.reduce((closest, t) =>
    t.range < closest.range ? t : closest
  );

  highlightEntity(target.id);
  showTargetInfo(target);
}
```

### Discord Bots

**Text-based proximity display:**

```typescript
function formatProximityEmbed(roster: ProximityRosterMessage['payload']): MessageEmbed {
  const embed = new MessageEmbed()
    .setTitle('📍 Nearby Entities')
    .setColor(roster.dangerState ? '#FF0000' : '#00FF00');

  // Group by channel
  const channels = [
    { name: 'Touch (5ft)', data: roster.channels.touch },
    { name: 'Say (20ft)', data: roster.channels.say },
    { name: 'Shout (150ft)', data: roster.channels.shout },
  ];

  channels.forEach(({ name, data }) => {
    if (data.count === 0) return;

    const entities = data.entities.slice(0, 5); // Limit to 5 for Discord
    const text = entities.map(e =>
      `${getTypeEmoji(e.type)} **${e.name}** - ${bearingToCompass(e.bearing)}, ${e.range}ft`
    ).join('\n');

    const more = data.count > 5 ? `\n_...and ${data.count - 5} more_` : '';

    embed.addField(name, text + more, false);
  });

  if (roster.dangerState) {
    embed.setFooter('⚔️ IN COMBAT');
  }

  return embed;
}

function getTypeEmoji(type: string): string {
  return type === 'player' ? '👤' : type === 'npc' ? '⚔️' : '🤖';
}
```

## Helper Functions

### Bearing Conversion

```typescript
// Bearing to compass direction (8-way)
function bearingToCompass(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

// Bearing to compass direction (16-way, more precise)
function bearingToCompass16(bearing: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

// Compass to bearing
const COMPASS_TO_BEARING = {
  'N': 0, 'NE': 45, 'E': 90, 'SE': 135,
  'S': 180, 'SW': 225, 'W': 270, 'NW': 315,
};
```

### Elevation Description

```typescript
function describeElevation(elevation: number): string {
  if (elevation < -10) return ', far below';
  if (elevation < -2) return ', below';
  if (elevation > 10) return ', far above';
  if (elevation > 2) return ', above';
  return ''; // Same level, no description needed
}

function getElevationEmoji(elevation: number): string {
  if (elevation < -2) return '⬇️';
  if (elevation > 2) return '⬆️';
  return '➡️';
}
```

### Range Utilities

```typescript
// Group entities by distance ranges
function groupByRange(entities: ProximityEntity[]): {
  melee: ProximityEntity[];   // 0-5ft
  close: ProximityEntity[];   // 5-20ft
  medium: ProximityEntity[];  // 20-50ft
  far: ProximityEntity[];     // 50ft+
} {
  return {
    melee: entities.filter(e => e.range <= 5),
    close: entities.filter(e => e.range > 5 && e.range <= 20),
    medium: entities.filter(e => e.range > 20 && e.range <= 50),
    far: entities.filter(e => e.range > 50),
  };
}

// Find nearest entity matching criteria
function findNearest(
  entities: ProximityEntity[],
  filter?: (e: ProximityEntity) => boolean
): ProximityEntity | null {
  const filtered = filter ? entities.filter(filter) : entities;
  if (filtered.length === 0) return null;

  return filtered.reduce((nearest, e) =>
    e.range < nearest.range ? e : nearest
  );
}
```

### Search & Filter

```typescript
// Find entity by name (fuzzy match)
function findByName(
  entities: ProximityEntity[],
  searchTerm: string
): ProximityEntity[] {
  const term = searchTerm.toLowerCase();
  return entities.filter(e =>
    e.name.toLowerCase().includes(term)
  );
}

// Find entities in a directional cone
function findInCone(
  entities: ProximityEntity[],
  centerBearing: number,
  coneWidth: number = 30
): ProximityEntity[] {
  return entities.filter(e => {
    const diff = Math.abs(angleDifference(centerBearing, e.bearing));
    return diff <= coneWidth / 2;
  });
}

// Angle difference (handles wraparound)
function angleDifference(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}
```

## Important Distinctions

### Social Context vs Spatial Data

| Field | Always Present? | Use For | Count Limit |
|-------|----------------|---------|-------------|
| `entities` | ✅ Yes | Combat targeting, movement, positioning | None - all entities included |
| `sample` | ❌ Only if ≤3 | LLM chat context, social interactions | Max 3 names |
| `lastSpeaker` | ❌ Only if ≤3 | Conversation flow, response targeting | One name |

### Combat Example (11 Giant Ants)

```typescript
// Proximity roster for combat:
{
  say: {
    count: 11,
    sample: undefined,  // Too many for social context
    entities: [
      { id: 'ant-1', name: 'Giant Ant Worker', bearing: 30, elevation: 0, range: 8.3 },
      { id: 'ant-2', name: 'Giant Ant Warrior', bearing: 90, elevation: -5, range: 12.1 },
      { id: 'ant-3', name: 'Giant Ant Worker', bearing: 120, elevation: 2, range: 7.9 },
      // ... all 11 ants with spatial data
    ]
  }
}

// ✅ Can target: "attack warrior at 12 feet east"
// ✅ Can navigate: "move away from nearest ant"
// ❌ LLM can't: "Hey Giant Ant Worker, why are you attacking me?"
//    (No names in sample - LLM sees count=11, uses generic "ants" in chat)
```

### Social Example (2 Players)

```typescript
// Proximity roster for conversation:
{
  say: {
    count: 2,
    sample: ['Alice', 'Bob'],  // Can use names in conversation
    entities: [
      { id: 'alice', name: 'Alice', bearing: 45, elevation: 0, range: 3.5 },
      { id: 'bob', name: 'Bob', bearing: 180, elevation: 0, range: 8.2 },
    ],
    lastSpeaker: 'Alice'
  }
}

// ✅ LLM can: "Hi Alice! What do you think, Bob?"
// ✅ Can navigate: "walk over to Bob"
// ✅ Can target: "trade with Alice"
```

## Performance Considerations

### Large Entity Counts

When many entities are nearby (combat scenarios, crowded areas), optimize rendering:

```typescript
function optimizedRender(roster: ProximityRosterMessage['payload']) {
  const visible = roster.channels.see.entities;

  // Prioritize nearby entities
  const priority = visible.sort((a, b) => a.range - b.range);

  // LOD based on distance
  priority.forEach(entity => {
    const detail = getDetailLevel(entity.range);
    renderEntity(entity, detail);
  });
}

function getDetailLevel(range: number): 'high' | 'medium' | 'low' {
  if (range < 20) return 'high';   // Full detail
  if (range < 50) return 'medium'; // Reduced poly count
  return 'low';                     // Billboard/sprite
}
```

### Update Throttling

The server sends proximity roster updates when entities enter/exit ranges. Throttle client-side processing:

```typescript
let lastUpdate = 0;
const MIN_UPDATE_INTERVAL = 100; // 100ms = 10 updates/sec

socket.on('proximity_roster', (data) => {
  const now = Date.now();
  if (now - lastUpdate < MIN_UPDATE_INTERVAL) {
    // Queue update for next frame
    queueProximityUpdate(data);
    return;
  }

  lastUpdate = now;
  processProximityRoster(data);
});
```

## Testing

Test with the included test client:

```bash
node test-client.js
```

The test client displays proximity rosters with spatial navigation data in the console.

---

**Questions?** Check the full protocol docs:
- [PROXIMITY_AND_PERCEPTION.md](./PROXIMITY_AND_PERCEPTION.md) - Detailed proximity system
- [PROTOCOL.md](./PROTOCOL.md) - Full protocol specification
- [CLIENT_DEV_SUMMARY.md](./CLIENT_DEV_SUMMARY.md) - Quick reference for client devs
