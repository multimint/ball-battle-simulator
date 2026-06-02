import { describe, it, expect } from 'vitest';
import {
  computeFunScore,
  computeFunComponents,
  funScoreFromComponents,
  FUN_COMPONENT_KEYS,
  type FunScoreInput,
  type FunComponents,
  type GameEvent,
} from '../funScore';

/** A neutral decisive A-win, ~35s, even damage, no snapshots/events. Override per test. */
function input(overrides: Partial<FunScoreInput> = {}): FunScoreInput {
  return {
    snapshots: [],
    winner: 'A',
    hpA: 30,
    hpB: 0,
    maxHpA: 60,
    maxHpB: 60,
    damageA: 60,
    damageB: 60,
    simTimeMs: 35_000,
    gameEvents: [],
    ...overrides,
  };
}

function events(count: number, timeMs: number): GameEvent[] {
  return Array.from({ length: count }, () => ({ timeMs, type: 'hit' as const, team: 'A' as const }));
}

describe('computeFunScore()', () => {
  it('returns an integer in [0, 100]', () => {
    const score = computeFunScore(input());
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // ── Closeness ──────────────────────────────────────────────────────────────
  it('a narrow win scores higher than a blowout', () => {
    const narrow  = computeFunScore(input({ hpA: 1 }));   // winner almost dead
    const blowout = computeFunScore(input({ hpA: 59 }));  // winner barely scratched
    expect(narrow).toBeGreaterThan(blowout);
  });

  it('a draw gets full closeness, beating a blowout', () => {
    const draw    = computeFunScore(input({ winner: 'draw', hpA: 0, hpB: 0 }));
    const blowout = computeFunScore(input({ hpA: 59 }));
    expect(draw).toBeGreaterThan(blowout);
  });

  // ── Damage symmetry ──────────────────────────────────────────────────────────
  it('symmetric damage scores higher than one-sided damage', () => {
    const symmetric = computeFunScore(input({ damageA: 60, damageB: 60 }));
    const oneSided  = computeFunScore(input({ damageA: 60, damageB: 5 }));
    expect(symmetric).toBeGreaterThan(oneSided);
  });

  // ── Duration ──────────────────────────────────────────────────────────────
  it('a fight in the ideal duration band beats a too-short one', () => {
    const ideal = computeFunScore(input({ simTimeMs: 35_000 }));
    const short = computeFunScore(input({ simTimeMs: 3_000 }));
    expect(ideal).toBeGreaterThan(short);
  });

  // ── Momentum (#1: by HP fraction, not absolute HP) ───────────────────────────
  it('detects lead changes by HP fraction even when absolute HP never crosses', () => {
    // maxHpA=300, maxHpB=100. Absolute HP keeps A ahead the whole time, but the
    // fraction lead flips A→B→A. A's min fraction is identical in both inputs,
    // so only momentum differs.
    const base = { maxHpA: 300, maxHpB: 100, hpA: 270, hpB: 0 };
    const fracCrossings = computeFunScore(input({
      ...base,
      snapshots: [
        { hpA: 300, hpB: 90 }, // A 1.00 > B 0.90 → A leads
        { hpA: 240, hpB: 95 }, // A 0.80 < B 0.95 → B leads (absolute: 240 > 95, no cross)
        { hpA: 270, hpB: 80 }, // A 0.90 > B 0.80 → A leads
      ],
    }));
    const noCrossings = computeFunScore(input({
      ...base,
      snapshots: [
        { hpA: 300, hpB: 90 },
        { hpA: 240, hpB: 80 }, // A 0.80 == B 0.80 (no lead)
        { hpA: 270, hpB: 70 },
      ],
    }));
    expect(fracCrossings).toBeGreaterThan(noCrossings);
  });

  // ── Comeback (#2) ──────────────────────────────────────────────────────────
  it('a winner who nearly died scores higher than a wire-to-wire winner', () => {
    // B held low in both so A always leads (momentum equal); only A's min differs.
    const comeback = computeFunScore(input({
      snapshots: [{ hpA: 60, hpB: 5 }, { hpA: 6, hpB: 5 }, { hpA: 30, hpB: 5 }],
    }));
    const wireToWire = computeFunScore(input({
      snapshots: [{ hpA: 60, hpB: 5 }, { hpA: 55, hpB: 5 }, { hpA: 50, hpB: 5 }],
    }));
    expect(comeback).toBeGreaterThan(wireToWire);
  });

  // ── Opening hook ──────────────────────────────────────────────────────────
  it('more action in the opening window scores higher', () => {
    const busy = computeFunScore(input({ gameEvents: events(8, 1_000) }));
    const dead = computeFunScore(input({ gameEvents: events(1, 1_000) }));
    expect(busy).toBeGreaterThan(dead);
  });

  it('actions after the opening window do not count toward the hook', () => {
    const lateAction = computeFunScore(input({ gameEvents: events(10, 10_000) }));
    const noAction   = computeFunScore(input({ gameEvents: [] }));
    expect(lateAction).toBe(noAction);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  it('handles empty snapshots and events without crashing', () => {
    const score = computeFunScore(input({ snapshots: [], gameEvents: [] }));
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('does not produce NaN when maxHp is zero', () => {
    const score = computeFunScore(input({
      maxHpA: 0,
      hpA: 0,
      snapshots: [{ hpA: 0, hpB: 30 }],
    }));
    expect(Number.isFinite(score)).toBe(true);
  });

  it('an unresolved (null) winner does not throw and stays in range', () => {
    const score = computeFunScore(input({ winner: null }));
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('computeFunComponents()', () => {
  it('returns all six factors in [0, 1]', () => {
    const c = computeFunComponents(input({
      snapshots: [{ hpA: 60, hpB: 50 }, { hpA: 20, hpB: 30 }],
      gameEvents: events(5, 1_000),
    }));
    for (const k of FUN_COMPONENT_KEYS) {
      expect(c[k]).toBeGreaterThanOrEqual(0);
      expect(c[k]).toBeLessThanOrEqual(1);
    }
  });

  it('exposes exactly the keys listed in FUN_COMPONENT_KEYS', () => {
    const c = computeFunComponents(input());
    expect(Object.keys(c).sort()).toEqual([...FUN_COMPONENT_KEYS].sort());
  });

  it('computeFunScore equals the averaged components', () => {
    const i = input({
      snapshots: [{ hpA: 60, hpB: 40 }, { hpA: 10, hpB: 40 }],
      gameEvents: events(6, 800),
    });
    expect(computeFunScore(i)).toBe(funScoreFromComponents(computeFunComponents(i)));
  });
});

describe('funScoreFromComponents()', () => {
  const uniform = (v: number): FunComponents => ({
    closeness: v, dmgSymmetry: v, duration: v, momentum: v, hook: v, comeback: v,
  });

  it('all-max components give 100', () => {
    expect(funScoreFromComponents(uniform(1))).toBe(100);
  });

  it('all-zero components give 0', () => {
    expect(funScoreFromComponents(uniform(0))).toBe(0);
  });

  it('weights the six factors equally', () => {
    // three 1s and three 0s → mean 0.5 → 50
    expect(funScoreFromComponents({
      closeness: 1, dmgSymmetry: 1, duration: 1, momentum: 0, hook: 0, comeback: 0,
    })).toBe(50);
  });
});
