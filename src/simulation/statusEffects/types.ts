import type { StatusEffect } from '../../models/types';

export interface StatusEffectHandler {
  /** Per-tick side effect (DoT, HoT, etc.). Mutate hp[team] directly. */
  tick?(effect: StatusEffect, hp: Record<'A' | 'B', number>, team: 'A' | 'B', delta: number): void;
  /** Multiplicative contribution to the ball's speed multiplier. */
  speedMult?(effect: StatusEffect): number;
  /** Multiplicative contribution to the ball's outgoing damage multiplier. */
  outDmgMult?(effect: StatusEffect): number;
  /** Multiplicative contribution to the ball's incoming damage multiplier. */
  inDmgMult?(effect: StatusEffect): number;
}
