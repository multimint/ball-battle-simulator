import { describe, it, expect } from 'vitest';
import { burnHandler }       from '../burn';
import { poisonHandler }     from '../poison';
import { freezeHandler }     from '../freeze';
import { speedBoostHandler } from '../speedBoost';
import { rageHandler }       from '../rage';
import { weakenHandler }     from '../weaken';
import { hardenHandler }     from '../harden';
import type { StatusEffect } from '../../../models/types';

function makeEffect(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id:            overrides.id            ?? 'test',
    type:          overrides.type          ?? 'burn',
    remainingMs:   overrides.remainingMs   ?? 5000,
    magnitude:     overrides.magnitude     ?? 1.0,
    stackBehavior: overrides.stackBehavior ?? 'refresh',
    stacks:        overrides.stacks        ?? 1,
    maxStacks:     overrides.maxStacks     ?? 1,
    color:         overrides.color         ?? '#FF0000',
    icon:          overrides.icon          ?? 'burst',
  };
}

// ─── burn ─────────────────────────────────────────────────────────────────────

describe('burnHandler.tick()', () => {
  const tick = burnHandler.tick;
  if (!tick) throw new Error('burnHandler.tick not defined');

  it('reduces HP by magnitude × stacks / 1000 × delta', () => {
    const hp = { A: 100, B: 100 };
    tick(makeEffect({ magnitude: 10, stacks: 1 }), hp, 'A', 1000);
    expect(hp.A).toBeCloseTo(90);
  });

  it('stacks amplify damage', () => {
    const hp = { A: 100, B: 100 };
    tick(makeEffect({ magnitude: 10, stacks: 2 }), hp, 'A', 1000);
    expect(hp.A).toBeCloseTo(80);
  });

  it('floors HP at 0', () => {
    const hp = { A: 5, B: 100 };
    tick(makeEffect({ magnitude: 1000, stacks: 1 }), hp, 'A', 1000);
    expect(hp.A).toBe(0);
  });
});

// ─── poison ───────────────────────────────────────────────────────────────────

describe('poisonHandler.tick()', () => {
  const tick = poisonHandler.tick;
  if (!tick) throw new Error('poisonHandler.tick not defined');

  it('reduces HP by magnitude / 1000 × delta', () => {
    const hp = { A: 100, B: 100 };
    tick(makeEffect({ type: 'poison', magnitude: 5, stacks: 1 }), hp, 'B', 1000);
    expect(hp.B).toBeCloseTo(95);
  });

  it('is independent of stacks', () => {
    const hp1 = { A: 100, B: 100 };
    const hp2 = { A: 100, B: 100 };
    tick(makeEffect({ type: 'poison', magnitude: 5, stacks: 1 }), hp1, 'A', 1000);
    tick(makeEffect({ type: 'poison', magnitude: 5, stacks: 5 }), hp2, 'A', 1000);
    expect(hp1.A).toBeCloseTo(hp2.A);
  });

  it('floors HP at 0', () => {
    const hp = { A: 1, B: 100 };
    tick(makeEffect({ type: 'poison', magnitude: 1000, stacks: 1 }), hp, 'A', 1000);
    expect(hp.A).toBe(0);
  });
});

// ─── freeze ───────────────────────────────────────────────────────────────────

describe('freezeHandler.speedMult()', () => {
  const speedMult = freezeHandler.speedMult;
  if (!speedMult) throw new Error('freezeHandler.speedMult not defined');

  it('returns 1 − magnitude × stacks', () => {
    expect(speedMult(makeEffect({ type: 'freeze', magnitude: 0.5, stacks: 1 }))).toBeCloseTo(0.5);
  });

  it('scales with stacks', () => {
    expect(speedMult(makeEffect({ type: 'freeze', magnitude: 0.3, stacks: 2 }))).toBeCloseTo(0.4);
  });
});

// ─── speedBoost ───────────────────────────────────────────────────────────────

describe('speedBoostHandler.speedMult()', () => {
  const speedMult = speedBoostHandler.speedMult;
  if (!speedMult) throw new Error('speedBoostHandler.speedMult not defined');

  it('returns 1 + magnitude × stacks for stacks ≤ 3', () => {
    expect(speedMult(makeEffect({ type: 'speedBoost', magnitude: 0.3, stacks: 1 }))).toBeCloseTo(1.3);
    expect(speedMult(makeEffect({ type: 'speedBoost', magnitude: 0.3, stacks: 3 }))).toBeCloseTo(1.9);
  });

  it('applies extra bonus for stacks > 3', () => {
    // stacks=4: bonus = 0.3*4 + 0.3*(4-3) = 1.2 + 0.3 = 1.5 → mult = 2.5
    expect(speedMult(makeEffect({ type: 'speedBoost', magnitude: 0.3, stacks: 4 }))).toBeCloseTo(2.5);
  });

  it('Quick Flail max-stack invariant: 6 stacks × 0.3 magnitude', () => {
    // bonus = 0.3*6 + 0.3*(6-3) = 1.8 + 0.9 = 2.7 → mult = 3.7
    expect(speedMult(makeEffect({ type: 'speedBoost', magnitude: 0.3, stacks: 6 }))).toBeCloseTo(3.7);
  });
});

// ─── rage ─────────────────────────────────────────────────────────────────────

describe('rageHandler.outDmgMult()', () => {
  const outDmgMult = rageHandler.outDmgMult;
  if (!outDmgMult) throw new Error('rageHandler.outDmgMult not defined');

  it('returns 1 + magnitude', () => {
    expect(outDmgMult(makeEffect({ type: 'rage', magnitude: 0.5 }))).toBeCloseTo(1.5);
  });
});

// ─── weaken ───────────────────────────────────────────────────────────────────

describe('weakenHandler.outDmgMult()', () => {
  const outDmgMult = weakenHandler.outDmgMult;
  if (!outDmgMult) throw new Error('weakenHandler.outDmgMult not defined');

  it('returns 1 − magnitude', () => {
    expect(outDmgMult(makeEffect({ type: 'weaken', magnitude: 0.4 }))).toBeCloseTo(0.6);
  });
});

// ─── harden ───────────────────────────────────────────────────────────────────

describe('hardenHandler.inDmgMult()', () => {
  const inDmgMult = hardenHandler.inDmgMult;
  if (!inDmgMult) throw new Error('hardenHandler.inDmgMult not defined');

  it('returns 1 − magnitude', () => {
    expect(inDmgMult(makeEffect({ type: 'harden', magnitude: 0.25 }))).toBeCloseTo(0.75);
  });
});
