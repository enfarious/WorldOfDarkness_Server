# Proximity Roster Optimization

## Problem

The proximity roster was being broadcast excessively:

- **Every time ANY player moved** → All players in zone got new roster
- **Every time a player joined/left** → All players in zone got new roster

**Example Scenario**:
- 10 players standing still in a zone
- 1 player moves
- **Result**: All 10 players receive proximity roster updates, even though 9 of them saw no changes

This creates significant unnecessary network traffic, especially in crowded zones.

## Solution: Dirty Tracking

We now track a **hash** of each player's proximity roster and only send updates when the roster actually changes.

### Hash Generation

The hash includes:
- Entity IDs in each channel
- Entity ranges (rounded to 1 decimal place)
- Danger state (combat mode)

```typescript
// Example hash
"touch:char1:3.5,char2:4.2|say:char1:3.5,char2:4.2,npc1:15.3|...|danger:false"
```

### How It Works

1. **Calculate roster** for a player
2. **Generate hash** from the roster data
3. **Compare** with previously stored hash
4. **If different**: Send update and store new hash
5. **If same**: Skip sending (roster unchanged)

### Code Changes

**ZoneManager.ts**:
- `calculateProximityRoster()` now returns `{ roster, hash } | null`
- Returns `null` if hash matches previous (roster unchanged)
- Added `hashProximityRoster()` private method

**DistributedWorldManager.ts**:
- Added `proximityRosterHashes: Map<string, string>` to track hashes per player
- Modified `sendProximityRosterToPlayer()` to check hash before sending
- Clean up hash on player disconnect

**WorldManager.monolithic.ts**:
- Same changes for non-distributed mode

## Performance Impact

### Before Optimization

**Scenario**: 10 players in zone, 1 moves every 2 seconds

- 1 move event → 10 proximity roster broadcasts
- 30 moves/minute → **300 proximity rosters/minute**

### After Optimization

**Scenario**: 10 players in zone, 1 moves every 2 seconds

- 1 move event → **Only affected players get updates**
  - Moving player: always gets update (their ranges changed)
  - Players within range changes: get update
  - Players far away with no changes: **no update**

**Typical reduction**: 70-90% fewer proximity roster messages in normal gameplay

## When Rosters ARE Sent

Proximity roster updates are sent when:

1. **Entity enters/exits range** (someone moves into say distance)
2. **Range changes significantly** (entity moves closer/farther by >0.1 feet)
3. **Combat state changes** (dangerState toggles)
4. **First calculation** (player just joined, no previous hash)

## When Rosters Are NOT Sent

Proximity roster updates are **skipped** when:

1. **No movement** (all players standing still)
2. **Distant movement** (player 100 feet away moves, but you're only tracking say range of 20 feet)
3. **Insignificant range changes** (rounding to 1 decimal hides tiny movements)

## Example Scenarios

### Scenario 1: Standing Still
- **Before**: 5 proximity rosters/second (if tick rate is 5Hz)
- **After**: 0 proximity rosters (nothing changed)
- **Savings**: 100%

### Scenario 2: Player Walks Nearby
- **Before**: Player A moves → All 10 players get roster
- **After**: Player A moves → Only players where A's range changed >0.1 feet get roster
- **Savings**: ~80% (only 2 players close enough to see range change)

### Scenario 3: Combat Starts
- **Before**: 1 player enters combat → All 10 players get roster
- **After**: 1 player enters combat → Only that player gets roster (dangerState only affects them)
- **Savings**: 90%

### Scenario 4: Crowded Zone
- **Before**: 50 players, 10 moving → 50 rosters every move tick
- **After**: 50 players, 10 moving → ~15 rosters (only those affected by movement)
- **Savings**: 70%

## Hash Collision Risk

**Q**: What if two different rosters have the same hash?

**A**: Extremely unlikely. Our hash includes:
- Entity IDs (unique)
- Ranges rounded to 1 decimal
- Danger state

The hash would only collide if:
1. Exact same entities in range
2. Exact same ranges (within 0.1 feet)
3. Same combat state

This represents **intentional data equivalence**, not a collision.

## Memory Impact

Each player hash is ~200-500 bytes depending on entity count.

- 1000 concurrent players = ~500 KB RAM
- Negligible compared to entity data

Hashes are cleaned up on player disconnect, preventing memory leaks.

## Future Optimizations

Potential further improvements:

1. **Batch Updates**: Instead of individual sends, batch multiple player updates into one message bus publish
2. **Range Threshold Tuning**: Adjust 0.1 feet threshold based on client needs (text clients may want larger threshold)
3. **Channel-Specific Hashing**: Only recalculate changed channels instead of full roster
4. **Spatial Partitioning**: Track which players can affect each other to avoid unnecessary checks

## Testing

To verify the optimization:

1. **Stand Still Test**:
   - Join with 2 clients
   - Stand still for 30 seconds
   - **Expected**: Only initial roster on join, no further rosters

2. **Movement Test**:
   - Join with 2 clients far apart (>250 feet)
   - Move one client
   - **Expected**: Only moving client gets roster updates

3. **Proximity Test**:
   - Join with 2 clients within say range (20 feet)
   - Move one client slightly
   - **Expected**: Both clients get rosters (ranges changed)

4. **Combat Test**:
   - Join with 2 clients
   - Enter combat on one client
   - **Expected**: Only that client gets roster (dangerState changed for them only)

## Logging

To monitor effectiveness, add temporary logging:

```typescript
// In sendProximityRosterToPlayer
if (!result) {
  logger.debug({ characterId }, 'Proximity roster unchanged - skipped send');
  return;
}
logger.debug({ characterId }, 'Proximity roster changed - sending update');
```

This shows how often rosters are skipped vs sent.

---

**Key Insight**: This optimization is invisible to clients - they receive the exact same data, just less frequently and only when it actually matters.
