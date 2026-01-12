import { CombatantState } from './types';

const DEFAULT_ATB_BASE_RATE = 10; // gauge per second
const DEFAULT_COMBAT_TIMEOUT_MS = 15000;

export class CombatManager {
  private combatants: Map<string, CombatantState> = new Map();
  private readonly baseRate: number;
  private readonly timeoutMs: number;

  constructor(options?: { baseRate?: number; timeoutMs?: number }) {
    this.baseRate = options?.baseRate ?? DEFAULT_ATB_BASE_RATE;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_COMBAT_TIMEOUT_MS;
  }

  ensureCombatant(entityId: string, now: number): CombatantState {
    let state = this.combatants.get(entityId);
    if (!state) {
      state = {
        entityId,
        atbGauge: 0,
        lastHostileAt: now,
        inCombat: false,
        cooldowns: new Map(),
      };
      this.combatants.set(entityId, state);
    }
    return state;
  }

  startCombat(entityId: string, now: number): boolean {
    const state = this.ensureCombatant(entityId, now);
    const wasInCombat = state.inCombat;
    state.inCombat = true;
    state.lastHostileAt = now;
    return !wasInCombat;
  }

  recordHostileAction(entityId: string, now: number): void {
    const state = this.ensureCombatant(entityId, now);
    state.lastHostileAt = now;
  }

  update(deltaTime: number, getAttackSpeedBonus: (entityId: string) => number): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const state of this.combatants.values()) {
      if (state.inCombat) {
        const bonus = getAttackSpeedBonus(state.entityId);
        const rate = this.baseRate + bonus;
        state.atbGauge = Math.min(200, state.atbGauge + rate * deltaTime);

        if (now - state.lastHostileAt >= this.timeoutMs) {
          state.inCombat = false;
          expired.push(state.entityId);
        }
      }
    }

    return expired;
  }

  canSpendAtb(entityId: string, cost: number): boolean {
    if (cost <= 0) return true;
    const state = this.ensureCombatant(entityId, Date.now());
    return state.atbGauge >= cost;
  }

  spendAtb(entityId: string, cost: number): void {
    if (cost <= 0) return;
    const state = this.ensureCombatant(entityId, Date.now());
    state.atbGauge = Math.max(0, state.atbGauge - cost);
  }

  addAtb(entityId: string, amount: number): void {
    const state = this.ensureCombatant(entityId, Date.now());
    state.atbGauge = Math.min(200, state.atbGauge + amount);
  }

  getCooldownRemaining(entityId: string, abilityId: string, now: number): number {
    const state = this.ensureCombatant(entityId, now);
    const expiresAt = state.cooldowns.get(abilityId);
    if (!expiresAt) return 0;
    return Math.max(0, expiresAt - now);
  }

  setCooldown(entityId: string, abilityId: string, cooldownMs: number, now: number): void {
    const state = this.ensureCombatant(entityId, now);
    if (cooldownMs <= 0) return;
    state.cooldowns.set(abilityId, now + cooldownMs);
  }
}
