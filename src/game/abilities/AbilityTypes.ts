/**
 * Ability System Types - Defines abilities, passives, and specials
 */

export type AbilityType = 'active' | 'passive' | 'special';
export type AbilityCategory = 'melee' | 'ranged' | 'magic' | 'support' | 'utility' | 'defensive';
export type TargetType = 'self' | 'enemy' | 'ally' | 'ground' | 'aoe';
export type DamageType = 'physical' | 'magic' | 'fire' | 'ice' | 'lightning' | 'poison' | 'holy' | 'dark';

// ========== Ability Definition ==========

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  category: AbilityCategory;

  // Requirements
  requiredLevel: number;
  requiredAbilityPoints: number;
  prerequisiteAbilities?: string[];  // Must have these unlocked first

  // For special abilities: equipment requirements
  requiredEquipment?: {
    weaponType?: string;
    armorSet?: string;
    itemId?: string;
  };

  // Icon/visual
  iconUrl?: string;
  animationId?: string;
}

// ========== Active Ability ==========

export interface ActiveAbility extends AbilityDefinition {
  type: 'active';

  // Targeting
  targetType: TargetType;
  range: number;  // meters
  aoeRadius?: number;  // For AoE abilities

  // Cost & Cooldown
  staminaCost?: number;
  manaCost?: number;
  healthCost?: number;  // For blood magic, etc.
  cooldown: number;  // seconds

  // Effects
  damage?: {
    type: DamageType;
    amount: number;
    scaling?: {
      stat: 'strength' | 'dexterity' | 'agility' | 'intelligence' | 'wisdom';
      multiplier: number;
    };
  };

  healing?: {
    amount: number;
    scaling?: {
      stat: 'wisdom' | 'intelligence';
      multiplier: number;
    };
  };

  statusEffects?: StatusEffectApplication[];

  // Cast time
  castTime?: number;  // seconds, 0 for instant
  channeled?: boolean;  // Must channel for duration
}

// ========== Passive Ability ==========

export interface PassiveAbility extends AbilityDefinition {
  type: 'passive';

  // Stat bonuses
  statBonuses?: {
    strength?: number;
    vitality?: number;
    dexterity?: number;
    agility?: number;
    intelligence?: number;
    wisdom?: number;
    maxHp?: number;
    maxStamina?: number;
    maxMana?: number;
    attackRating?: number;
    defenseRating?: number;
    // ... can add any derived stat
  };

  // Conditional effects
  triggers?: PassiveTrigger[];

  // Resource regeneration
  regeneration?: {
    hp?: number;  // per second
    stamina?: number;
    mana?: number;
  };

  // Resistance bonuses
  resistances?: {
    physical?: number;  // percentage
    magic?: number;
    fire?: number;
    ice?: number;
    poison?: number;
    // ...
  };
}

// ========== Special Ability (Equipment-Linked) ==========

export interface SpecialAbility extends AbilityDefinition {
  type: 'special';
  targetType: TargetType;
  range: number;

  // Long cooldown, high impact
  cooldown: number;  // Usually 60+ seconds

  // Equipment requirement (mandatory for specials)
  requiredEquipment: {
    weaponType?: string;
    armorSet?: string;
    itemId?: string;
  };

  // Effects (similar to active but more powerful)
  damage?: {
    type: DamageType;
    amount: number;
    scaling?: {
      stat: 'strength' | 'dexterity' | 'agility' | 'intelligence' | 'wisdom';
      multiplier: number;
    };
  };

  statusEffects?: StatusEffectApplication[];

  // Special abilities can have unique mechanics
  specialMechanics?: {
    invulnerability?: number;  // seconds
    teleport?: boolean;
    summon?: string;  // summon entity ID
    transform?: string;  // transform into entity type
    // ... custom mechanics
  };
}

// ========== Status Effects ==========

export interface StatusEffectApplication {
  effectId: string;
  duration: number;  // seconds
  potency: number;  // effectiveness (damage per tick, stat reduction %, etc.)
  stackable?: boolean;
  maxStacks?: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  type: 'buff' | 'debuff';
  category: 'physical' | 'magical' | 'supernatural';

  // Visual
  iconUrl?: string;
  particleEffect?: string;

  // Effects (at least one must be present)
  damageOverTime?: {
    type: DamageType;
    amount: number;  // per tick
    tickRate: number;  // seconds between ticks
  };

  healingOverTime?: {
    amount: number;
    tickRate: number;
  };

  statModifiers?: {
    [stat: string]: number;  // Can modify any stat, positive or negative
  };

  disables?: {
    movement?: boolean;
    abilities?: boolean;
    items?: boolean;
  };

  resistChance?: number;  // Chance to resist this effect (modified by stats)
}

// ========== Passive Triggers ==========

export interface PassiveTrigger {
  condition: TriggerCondition;
  effect: PassiveTriggerEffect;
  cooldown?: number;  // seconds between triggers
  procChance?: number;  // percentage (1-100), 100 = always
}

export type TriggerCondition =
  | { type: 'on_hit' }
  | { type: 'on_crit' }
  | { type: 'on_dodge' }
  | { type: 'on_parry' }
  | { type: 'on_kill' }
  | { type: 'on_damaged'; threshold?: number }  // When taking damage (optionally above threshold)
  | { type: 'on_heal' }
  | { type: 'on_ability_use'; abilityCategory?: AbilityCategory }
  | { type: 'health_below'; percentage: number }  // When HP drops below X%
  | { type: 'mana_below'; percentage: number };

export interface PassiveTriggerEffect {
  // Can trigger an ability
  abilityId?: string;

  // Or apply direct effects
  damage?: {
    type: DamageType;
    amount: number;
  };

  healing?: number;

  statusEffect?: StatusEffectApplication;

  buffSelf?: {
    duration: number;
    statBonuses: Record<string, number>;
  };
}

// ========== Ability Trees ==========

export interface AbilityTree {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'magic' | 'supernatural' | 'cybernetics' | 'crafting';

  // Tree structure
  tiers: AbilityTreeTier[];

  // Visual
  iconUrl?: string;
  backgroundUrl?: string;
}

export interface AbilityTreeTier {
  tier: number;  // 1, 2, 3, etc.
  requiredPointsInTree: number;  // Must have spent X points in this tree to unlock
  abilities: string[];  // Array of ability IDs in this tier
}

// ========== Weapon Scaling ==========

export type ScalingRank = 'S' | 'A' | 'B' | 'C' | 'D';

export interface WeaponScaling {
  primary: {
    stat: 'strength' | 'dexterity' | 'agility' | 'intelligence' | 'wisdom';
    rank: ScalingRank;
  };
  secondary?: {
    stat: 'strength' | 'dexterity' | 'agility' | 'intelligence' | 'wisdom';
    rank: ScalingRank;
  };
}

// ========== Feat Definitions ==========

export interface FeatDefinition {
  id: string;
  name: string;
  description: string;

  requirement: {
    stat: 'strength' | 'vitality' | 'dexterity' | 'agility' | 'intelligence' | 'wisdom';
    level: number;  // Required stat level
  };

  // Feat effects (similar to passives)
  statBonuses?: Record<string, number>;
  specialMechanics?: string;  // Custom mechanics (titans_grip, phoenix_rebirth, etc.)

  // Icon
  iconUrl?: string;
}

// ========== Equipment Abilities ==========

export interface EquipmentAbilitySlot {
  slotType: 'special';  // Equipment only grants specials
  slotNumber: 1 | 2 | 3 | 4;  // Which of the 4 special slots
  abilityId: string;  // The special ability granted
}
