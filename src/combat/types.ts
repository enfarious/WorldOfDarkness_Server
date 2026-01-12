import type { DamageType, TargetType } from '@/game/abilities/AbilityTypes';

export type CombatEventType =
  | 'combat_start'
  | 'combat_action'
  | 'combat_hit'
  | 'combat_miss'
  | 'combat_effect'
  | 'combat_death'
  | 'combat_end'
  | 'combat_error';

export interface CombatAbilityDefinition {
  id: string;
  name: string;
  description?: string;
  targetType: TargetType;
  range: number; // meters
  cooldown: number; // seconds
  atbCost: number;
  isBuilder?: boolean;
  isFree?: boolean;
  staminaCost?: number;
  manaCost?: number;
  healthCost?: number;
  castTime?: number; // seconds
  aoeRadius?: number; // meters
  damage?: {
    type: DamageType;
    amount: number;
    scalingStat?: 'strength' | 'dexterity' | 'agility' | 'intelligence' | 'wisdom';
    scalingMultiplier?: number;
  };
  healing?: {
    amount: number;
    scalingStat?: 'wisdom' | 'intelligence';
    scalingMultiplier?: number;
  };
}

export interface CombatantState {
  entityId: string;
  atbGauge: number;
  lastHostileAt: number;
  inCombat: boolean;
  cooldowns: Map<string, number>;
}

export interface CombatStats {
  attackRating: number;
  defenseRating: number;
  physicalAccuracy: number;
  evasion: number;
  damageAbsorption: number;
  glancingBlowChance: number;
  magicAttack: number;
  magicDefense: number;
  magicAccuracy: number;
  magicEvasion: number;
  magicAbsorption: number;
  criticalHitChance: number;
  penetratingBlowChance: number;
  deflectedBlowChance: number;
}

export interface DamageResult {
  hit: boolean;
  outcome: 'hit' | 'crit' | 'glance' | 'penetrating' | 'deflected' | 'miss';
  amount: number;
  baseDamage: number;
  mitigatedDamage: number;
}
