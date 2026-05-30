import { describe, it, expect } from 'vitest';
import { getHitMultipliers, getMeleeEffectLabel } from '../WeaponHitProcessor';
import { WEAPON_PRESETS } from '../../constants/weaponPresets';
import type { AttackConfig } from '../../models/types';

const meleeAttack: AttackConfig = { type: 'melee', cooldown: 1.0, damage: 10, knockback: 50 };
const projectileAttack: AttackConfig = { type: 'projectile', cooldown: 2.0, damage: 12, knockback: 40, aimAtEnemy: true };

function preset(name: string) {
  const w = WEAPON_PRESETS.find((p) => p.name === name);
  if (!w) throw new Error(`Preset not found: ${name}`);
  return w;
}

describe('getHitMultipliers()', () => {
  it('returns 1.0/1.0 for weapons with no overrides', () => {
    const result = getHitMultipliers(preset('Swift Sword'), meleeAttack);
    expect(result.kbMult).toBe(1.0);
    expect(result.dmgMult).toBe(1.0);
  });

  it('Heavy Hammer: kbMult=1.6, dmgMult=1.2', () => {
    const result = getHitMultipliers(preset('Heavy Hammer'), meleeAttack);
    expect(result.kbMult).toBeCloseTo(1.6);
    expect(result.dmgMult).toBeCloseTo(1.2);
  });

  it('Long Spear: kbMult=0.9, dmgMult=1.0', () => {
    const result = getHitMultipliers(preset('Long Spear'), meleeAttack);
    expect(result.kbMult).toBeCloseTo(0.9);
    expect(result.dmgMult).toBe(1.0);
  });

  it('Chain Flail: kbMult=0.7, dmgMult=0.8', () => {
    const result = getHitMultipliers(preset('Chain Flail'), meleeAttack);
    expect(result.kbMult).toBeCloseTo(0.7);
    expect(result.dmgMult).toBeCloseTo(0.8);
  });

  it('Grenade Bomb: dmgMult=1.3, kbMult=1.2', () => {
    const result = getHitMultipliers(preset('Grenade Bomb'), projectileAttack);
    expect(result.dmgMult).toBeCloseTo(1.3);
    expect(result.kbMult).toBeCloseTo(1.2);
  });

  it('Power Cannon: dmgMult=1.1, kbMult=1.5', () => {
    const result = getHitMultipliers(preset('Power Cannon'), projectileAttack);
    expect(result.dmgMult).toBeCloseTo(1.1);
    expect(result.kbMult).toBeCloseTo(1.5);
  });
});

describe('getMeleeEffectLabel()', () => {
  it('Heavy Hammer → hammer', () => expect(getMeleeEffectLabel(preset('Heavy Hammer'))).toBe('hammer'));
  it('Long Spear → spear', () => expect(getMeleeEffectLabel(preset('Long Spear'))).toBe('spear'));
  it('Chain Flail → flail', () => expect(getMeleeEffectLabel(preset('Chain Flail'))).toBe('flail'));
  it('Swift Sword → sword (default, no effectLabel)', () => expect(getMeleeEffectLabel(preset('Swift Sword'))).toBe('sword'));
  it('Boomerang → sword (default, no effectLabel)', () => expect(getMeleeEffectLabel(preset('Boomerang'))).toBe('sword'));
});
