import { describe, it, expect } from 'vitest';
import { getHitMultipliers, getMeleeEffectLabel } from '../WeaponHitProcessor';
import type { WeaponStats, AttackConfig } from '../../models/types';

const meleeAttack: AttackConfig = {
  type: 'melee',
  cooldown: 1.0,
  damage: 10,
  knockback: 50,
};

function weapon(overrides: Partial<WeaponStats>): WeaponStats {
  return {
    name: 'Test',
    description: '',
    range: 1,
    speed: 5,
    trigger: 'onCollision',
    attacks: [meleeAttack],
    ...overrides,
  };
}

describe('getHitMultipliers()', () => {
  it('returns 1.0/1.0 for weapons with no overrides', () => {
    const result = getHitMultipliers(weapon({}), meleeAttack);
    expect(result.kbMult).toBe(1.0);
    expect(result.dmgMult).toBe(1.0);
  });

  it('kbMult=1.6, dmgMult=1.2 (Heavy Hammer config)', () => {
    const result = getHitMultipliers(
      weapon({ kbMult: 1.6, dmgMult: 1.2 }),
      meleeAttack,
    );
    expect(result.kbMult).toBeCloseTo(1.6);
    expect(result.dmgMult).toBeCloseTo(1.2);
  });

  it('kbMult=0.9, dmgMult=1.0 (Long Spear config)', () => {
    const result = getHitMultipliers(weapon({ kbMult: 0.9 }), meleeAttack);
    expect(result.kbMult).toBeCloseTo(0.9);
    expect(result.dmgMult).toBe(1.0);
  });

  it('kbMult=0.7, dmgMult=0.8 (Chain Flail config)', () => {
    const result = getHitMultipliers(
      weapon({ kbMult: 0.7, dmgMult: 0.8 }),
      meleeAttack,
    );
    expect(result.kbMult).toBeCloseTo(0.7);
    expect(result.dmgMult).toBeCloseTo(0.8);
  });
});

describe('getMeleeEffectLabel()', () => {
  it('effectLabel=hammer → hammer', () =>
    expect(getMeleeEffectLabel(weapon({ effectLabel: 'hammer' }))).toBe(
      'hammer',
    ));
  it('effectLabel=spear → spear', () =>
    expect(getMeleeEffectLabel(weapon({ effectLabel: 'spear' }))).toBe(
      'spear',
    ));
  it('effectLabel=flail → flail', () =>
    expect(getMeleeEffectLabel(weapon({ effectLabel: 'flail' }))).toBe(
      'flail',
    ));
  it('no effectLabel → sword', () =>
    expect(getMeleeEffectLabel(weapon({}))).toBe('sword'));
});
