import { describe, it, expect } from 'vitest';
import { isAbilityBerserk } from '../ability';
import type { BallAbility } from '../../models/types';

const BERSERK: BallAbility = {
  id: 'test', name: 'Test', description: '',
  trigger: 'onLowHP',
  params: { threshold: 0.3 },
};

describe('isAbilityBerserk()', () => {
  it('returns false when ability is undefined', () => {
    expect(isAbilityBerserk(undefined, 0.1)).toBe(false);
  });

  it('returns false for a passive trigger', () => {
    const passive: BallAbility = { id: 'p', name: 'P', description: '', trigger: 'passive', params: {} };
    expect(isAbilityBerserk(passive, 0.1)).toBe(false);
  });

  it('returns false for an onHitDealt trigger', () => {
    const onHit: BallAbility = { id: 'h', name: 'H', description: '', trigger: 'onHitDealt', params: {} };
    expect(isAbilityBerserk(onHit, 0.1)).toBe(false);
  });

  it('returns false when hpFrac equals the threshold (strict less-than)', () => {
    expect(isAbilityBerserk(BERSERK, 0.3)).toBe(false);
  });

  it('returns false when hpFrac is above the threshold', () => {
    expect(isAbilityBerserk(BERSERK, 0.31)).toBe(false);
  });

  it('returns true when hpFrac is below the threshold', () => {
    expect(isAbilityBerserk(BERSERK, 0.29)).toBe(true);
  });

  it('returns true at near-zero HP', () => {
    expect(isAbilityBerserk(BERSERK, 0.0)).toBe(true);
  });
});
