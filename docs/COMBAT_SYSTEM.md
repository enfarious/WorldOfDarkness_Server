# Combat System (ATB)

This document defines the Active Time Battle (ATB) combat loop for the World of Darkness server.
It focuses on server-authoritative rules, event flow, and the minimal data model needed to implement.
Characters do auto-attack on a timer, this timer can be affected by slowing or hasting effects. Auto-attacks operate outside of global CD and do not rely on ATB. They just happen and build ATB. For some this is faster than ATB over time, for others (mages and the like) ATB fills fast enough to warrant staying out of the melee.

## Goals

- Real-time ATB (no turns, no pauses).
- Server-authoritative validation and resolution.
- Supports text, 2D, 3D, and VR clients.
- Uses existing stats (core + derived) and proximity roster spatial data.
- Clear hooks for NPC AI and LLM airlock control.

## Core Concepts

### Combat State

- An entity is "in combat" if it has a recent hostile action or was targeted by one.
- Combat state is per-entity and per-encounter (zone-level grouping for now).
- Combat state sets `dangerState = true` in proximity roster for that entity.
- Combat auto-exits after inactivity timeout.

### ATB Gauge

- Each entity has an ATB gauge from 0 to 100.
- Gauge fills continuously: `fillRate = derivedStats.attackSpeedBonus + baseRate`.
- When gauge reaches 100, the entity can execute an action.
- Using an action consumes 0..100, depending on ability used. This does not allow more than a single action at a time, but, it does allow for more actions over time if that's your jam.
- Some actions can actually build you to > 100 ATB charge, which can allow for more than a single action. These are called 'builders' and typically have long cooldowns. 
- Some actions are 'free' and have only a CD, the CD doesn't start until the effect of the ability has worn off. For instance /rage for wolves has no ATB cost but has a 120 second CD that doesn't start to tick until Rage wears off (30s base). These "free" abilities can be used in addition to actual consumers. 
- Ults consume 100 ATB AND have monster CDs 900+ seconds. They can change the tides of battle though.

### Action Queue

- Client sends /spell|ability when ready and the server enqueues it.
- Server validates action: cooldowns, range, resources, target visibility.
- On validation success, resolve immediately (no delay) or after cast time.

### Targeting

- Single target: requires target within range and in same zone.
- AoE target: validate radius and affected entities.
- Line or cone: validate geometry using bearing and range.

### Range Units

- Proximity roster uses feet.
- World positions are meters.
- Convert: `feet * 0.3048 = meters`.

## Combat Flow (Server Side)

1) Detect hostile action -> mark combat start.
2) For each combat tick:
   - Update ATB gauge for all combatants.
   - Process any queued actions that are ready.
   - Apply ongoing effects (DoT, HoT, buffs).
3) Broadcast combat events.
4) Exit combat after inactivity timeout.

## Event Types (to clients)

- `combat_start`
- `combat_action`
- `combat_hit`
- `combat_miss`
- `combat_effect`
- `combat_death`
- `combat_end`

## Action Types

- Basic attack (melee/ranged)
- Ability cast (resource cost, cooldown, range)
- Defensive (guard, evade, block)
- Utility (taunt, heal, buff, debuff)

## Damage Model (Initial Pass)

### Physical

- Base: `attackRating` vs `defenseRating`
- Accuracy: `physicalAccuracy` vs `evasion`
- Absorption: `damageAbsorption`
- Critical Hits: `criticalHitChance`
- Glancing blows: `glancingBlowChance`
- Penetrating blows: `penetratingBlowChance`
- Deflected blows: `deflectedBlowChance`

### Magic

- Base: `magicAttack` vs `magicDefense`
- Accuracy: `magicAccuracy` vs `magicEvasion`
- Absorption: `magicAbsorption`

### Output

- `combat_hit` with amount, type, and mitigation breakdown.
- `combat_miss` when accuracy roll fails.

## Status Effects

- Buffs: increase stats or grant shields.
- Debuffs: reduce stats, apply DoT, slow, stun.
- Duration in seconds, ticks at COMBAT_TICK_RATE.
- Stack rules: replace, refresh, or stack (per effect definition).

## Engagement Rules

- Combat starts when a hostile action lands or is attempted on a valid target.
- Combat ends after `COMBAT_TIMEOUT_MS` with no hostile actions.
- Leaving range does not end combat immediately; it may trigger disengage timers.

## Commands Integration

Slash commands are first class scripts and should generate combat events:

- `/attack <target>` -> basic melee
- `/<ability> <target>` -> ability cast
- `/<spell> <target>` -> ability cast
- `/flee` -> escape attempt
- `/guard <target>` -> damage reduction on ally

These commands route through the command system and publish combat actions into the zone input channel.

## AI Integration

- NPC AI uses the same proximity roster for target selection.
- LLM-driven NPCs can request actions via airlock, but server validates the same rules.

## Data Structures (Proposed)

### Combatant State

- entityId
- zoneId
- inCombat
- atbGauge
- cooldowns
- activeEffects
- lastHostileAt

### Combat Action

- actionId
- sourceId
- targetId
- abilityId
- timestamp
- castTime
- cost

## Tuning Defaults (Proposed)

- `COMBAT_TICK_RATE = 20`
- `ATB_BASE_RATE = 10` gauge per second
- `COMBAT_TIMEOUT_MS = 15000`

## Open Questions

- How do we group encounters: per-zone or per-target cluster?
- How do we handle line-of-sight for ranged attacks?
- How do we resolve interrupts and counter-attacks?
- How do we cap multi-target damage in large fights?

## Next Implementation Steps

1) Create `CombatManager` with tick loop and combatant tracking.
2) Implement `AbilitySystem` with cooldown and resource validation.
3) Implement `DamageCalculator`.
4) Emit combat events and integrate with proximity roster `dangerState`.
