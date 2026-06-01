import type { StatusEffect, StatusEffectType } from '../models/types';
import type { SpriteKey } from '../sprites/SpriteKey';
import { STATUS_HANDLERS } from './statusEffects';

export interface ApplyEffectOptions {
  team: 'A' | 'B';
  type: StatusEffectType;
  durationMs: number;
  magnitude: number;
  stackBehavior: StatusEffect['stackBehavior'];
  maxStacks: number;
  color: string;
  icon: SpriteKey;
  simTime?: number;
}

export class StatusEffectManager {
  private effects: Record<'A' | 'B', StatusEffect[]> = { A: [], B: [] };

  apply({ team, type, durationMs, magnitude, stackBehavior, maxStacks, color, icon, simTime = 0 }: ApplyEffectOptions): void {
    const effects = this.effects[team];
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

  tick(delta: number, hp: { A: number; B: number }): void {
    for (const team of ['A', 'B'] as const) {
      const alive: StatusEffect[] = [];
      for (const effect of this.effects[team]) {
        if (effect.stackBehavior !== 'stack') {
          effect.remainingMs -= delta;
        }
        STATUS_HANDLERS[effect.type].tick?.(effect, hp, team, delta);
        if (effect.stackBehavior === 'stack' || effect.remainingMs > 0) alive.push(effect);
      }
      this.effects[team] = alive;
    }
  }

  getEffects(team: 'A' | 'B'): StatusEffect[] {
    return this.effects[team];
  }

  hasEffect(team: 'A' | 'B', type: StatusEffectType): boolean {
    return this.effects[team].some((e) => e.type === type);
  }

  getSpeedMultiplier(team: 'A' | 'B'): number {
    let mult = 1.0;
    for (const e of this.effects[team]) {
      const m = STATUS_HANDLERS[e.type].speedMult?.(e);
      if (m !== undefined) mult *= m;
    }
    return Math.max(0.1, mult);
  }

  getOutgoingDamageMultiplier(team: 'A' | 'B'): number {
    let mult = 1.0;
    for (const e of this.effects[team]) {
      const m = STATUS_HANDLERS[e.type].outDmgMult?.(e);
      if (m !== undefined) mult *= m;
    }
    return Math.max(0.1, mult);
  }

  getIncomingDamageMultiplier(team: 'A' | 'B'): number {
    let mult = 1.0;
    for (const e of this.effects[team]) {
      const m = STATUS_HANDLERS[e.type].inDmgMult?.(e);
      if (m !== undefined) mult *= m;
    }
    return Math.max(0.1, mult);
  }

  consumeShield(team: 'A' | 'B', rawDamage: number): number {
    const effects = this.effects[team];
    const shieldIdx = effects.findIndex((e) => e.type === 'shield');
    if (shieldIdx === -1) return rawDamage;
    const shield = effects[shieldIdx];
    const absorbed = Math.min(shield.magnitude, rawDamage);
    shield.magnitude -= absorbed;
    if (shield.magnitude <= 0) effects.splice(shieldIdx, 1);
    return rawDamage - absorbed;
  }
}
