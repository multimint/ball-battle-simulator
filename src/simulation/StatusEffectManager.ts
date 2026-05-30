import type { StatusEffect, StatusEffectType } from '../models/types';

export class StatusEffectManager {
  private effectsA: StatusEffect[] = [];
  private effectsB: StatusEffect[] = [];

  apply(
    team: 'A' | 'B',
    type: StatusEffectType,
    durationMs: number,
    magnitude: number,
    stackBehavior: StatusEffect['stackBehavior'],
    maxStacks: number,
    color: string,
    icon: string,
    simTime = 0,
  ): void {
    const effects = team === 'A' ? this.effectsA : this.effectsB;
    const existing = effects.find((e) => e.type === type);
    if (existing) {
      if (stackBehavior === 'refresh') {
        existing.remainingMs = durationMs;
      } else if (stackBehavior === 'stack' && existing.stacks < existing.maxStacks) {
        existing.stacks++;
        existing.remainingMs = durationMs;
      }
      return;
    }
    effects.push({
      id: `${type}-${team}-${simTime}`,
      type,
      remainingMs: durationMs,
      magnitude,
      stackBehavior,
      stacks: 1,
      maxStacks,
      color,
      icon,
    });
  }

  /** Advance status effects by `delta` ms, applying DoT to `hp`. */
  tick(delta: number, hp: { A: number; B: number }): void {
    for (const team of ['A', 'B'] as const) {
      const effects = team === 'A' ? this.effectsA : this.effectsB;
      const alive: StatusEffect[] = [];
      for (const effect of effects) {
        if (effect.stackBehavior !== 'stack') {
          effect.remainingMs -= delta;
        }
        if (effect.type === 'burn') {
          hp[team] = Math.max(0, hp[team] - (effect.magnitude * effect.stacks / 1000) * delta);
        } else if (effect.type === 'poison') {
          hp[team] = Math.max(0, hp[team] - (effect.magnitude / 1000) * delta);
        }
        if (effect.stackBehavior === 'stack' || effect.remainingMs > 0) alive.push(effect);
      }
      if (team === 'A') this.effectsA = alive;
      else this.effectsB = alive;
    }
  }

  getEffects(team: 'A' | 'B'): StatusEffect[] {
    return team === 'A' ? this.effectsA : this.effectsB;
  }

  hasEffect(team: 'A' | 'B', type: StatusEffectType): boolean {
    return (team === 'A' ? this.effectsA : this.effectsB).some((e) => e.type === type);
  }

  getSpeedMultiplier(team: 'A' | 'B'): number {
    const effects = team === 'A' ? this.effectsA : this.effectsB;
    let mult = 1.0;
    for (const e of effects) {
      if (e.type === 'freeze') mult *= (1 - e.magnitude * e.stacks);
      if (e.type === 'speedBoost') {
        const bonus = e.magnitude * e.stacks + (e.stacks > 3 ? e.magnitude * (e.stacks - 3) : 0);
        mult *= (1 + bonus);
      }
    }
    return Math.max(0.1, mult);
  }

  getOutgoingDamageMultiplier(team: 'A' | 'B'): number {
    const effects = team === 'A' ? this.effectsA : this.effectsB;
    let mult = 1.0;
    for (const e of effects) {
      if (e.type === 'rage') mult *= (1 + e.magnitude);
      if (e.type === 'weaken') mult *= (1 - e.magnitude);
    }
    return Math.max(0.1, mult);
  }

  getIncomingDamageMultiplier(team: 'A' | 'B'): number {
    const effects = team === 'A' ? this.effectsA : this.effectsB;
    let mult = 1.0;
    for (const e of effects) {
      if (e.type === 'harden') mult *= (1 - e.magnitude);
    }
    return Math.max(0.1, mult);
  }

  consumeShield(team: 'A' | 'B', rawDamage: number): number {
    const effects = team === 'A' ? this.effectsA : this.effectsB;
    const shieldIdx = effects.findIndex((e) => e.type === 'shield');
    if (shieldIdx === -1) return rawDamage;
    const shield = effects[shieldIdx];
    const absorbed = Math.min(shield.magnitude, rawDamage);
    shield.magnitude -= absorbed;
    if (shield.magnitude <= 0) effects.splice(shieldIdx, 1);
    return rawDamage - absorbed;
  }
}
