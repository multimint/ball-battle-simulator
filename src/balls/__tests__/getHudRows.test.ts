import { describe, it, expect } from 'vitest';
import { quickFlail } from '../quickflail';
import { bloodAxe } from '../bloodaxe';
import { hawkeye } from '../hawkeye';
import type { StatusEffect } from '../../models/types';

function makeSpeedBoostEffect(stacks: number): StatusEffect {
  return {
    id: 'speedBoost-A-0',
    type: 'speedBoost',
    remainingMs: 999999,
    magnitude: 0.3,
    stackBehavior: 'stack',
    stacks,
    maxStacks: 6,
    color: '#44FF44',
    icon: 'lightning',
  };
}

// ─── Quick Flail — Momentum ───────────────────────────────────────────────────

describe('quickFlail.ball.ability.getHudRows', () => {
  const getHudRows = quickFlail.ball.ability!.getHudRows!;

  it('shows ×1.0 with no stacks', () => {
    const rows = getHudRows([], 1.0);
    expect(rows).toEqual([{ label: 'momentum', value: '×1.0' }]);
  });

  it('shows ×1.9 with 3 stacks', () => {
    const rows = getHudRows([makeSpeedBoostEffect(3)], 1.0);
    expect(rows).toEqual([{ label: 'momentum', value: '×1.9' }]);
  });

  it('shows ×2.8 at max stacks (6)', () => {
    const rows = getHudRows([makeSpeedBoostEffect(6)], 1.0);
    expect(rows).toEqual([{ label: 'momentum', value: '×2.8' }]);
  });

  it('ignores hpFrac — always returns one row', () => {
    expect(getHudRows([], 0.1)).toHaveLength(1);
    expect(getHudRows([], 0.9)).toHaveLength(1);
  });
});

// ─── Blood Axe — Bloodrage ────────────────────────────────────────────────────

describe('bloodAxe.ball.ability.getHudRows', () => {
  const getHudRows = bloodAxe.ball.ability!.getHudRows!;

  it('shows "off" above threshold', () => {
    expect(getHudRows([], 0.5)).toEqual([{ label: 'berserk', value: 'off' }]);
    expect(getHudRows([], 0.31)).toEqual([{ label: 'berserk', value: 'off' }]);
  });

  it('shows "on" at threshold boundary (< 0.3)', () => {
    expect(getHudRows([], 0.29)).toEqual([{ label: 'berserk', value: 'on' }]);
    expect(getHudRows([], 0.0)).toEqual([{ label: 'berserk', value: 'on' }]);
  });

  it('ignores effects array', () => {
    expect(getHudRows([makeSpeedBoostEffect(3)], 0.2)).toEqual([{ label: 'berserk', value: 'on' }]);
  });
});

// ─── Hawkeye — Permafrost ─────────────────────────────────────────────────────

describe('hawkeye.ball.ability.getHudRows', () => {
  const getHudRows = hawkeye.ball.ability!.getHudRows!;

  it('always returns empty array', () => {
    expect(getHudRows([], 1.0)).toEqual([]);
    expect(getHudRows([], 0.1)).toEqual([]);
    expect(getHudRows([makeSpeedBoostEffect(3)], 0.5)).toEqual([]);
  });
});
