import { describe, it, expect } from 'vitest';
import { StatusEffectManager } from '../StatusEffectManager';

function makeManager() {
  return new StatusEffectManager();
}

const BASE = {
  durationMs: 2000,
  magnitude: 0.3,
  stackBehavior: 'refresh' as const,
  maxStacks: 1,
  color: '#FF0000',
  icon: 'flame' as const,
};

describe('StatusEffectManager', () => {
  describe('apply()', () => {
    it('adds a new effect', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'burn', ...BASE });
      expect(mgr.hasEffect('A', 'burn')).toBe(true);
      expect(mgr.hasEffect('B', 'burn')).toBe(false);
    });

    it('does not add duplicate effect types', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'burn', durationMs: BASE.durationMs, magnitude: BASE.magnitude, stackBehavior: 'refresh', maxStacks: 1, color: '#F00', icon: 'flame' });
      mgr.apply({ team: 'A', type: 'burn', durationMs: BASE.durationMs, magnitude: BASE.magnitude, stackBehavior: 'refresh', maxStacks: 1, color: '#F00', icon: 'flame' });
      expect(mgr.getEffects('A').length).toBe(1);
    });

    it('refreshes duration on stack-behavior=refresh', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 1000, magnitude: 0.3, stackBehavior: 'refresh', maxStacks: 3, color: '#0F0', icon: 'lightning' });
      const effect = mgr.getEffects('A')[0];
      effect.remainingMs = 100;
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 1000, magnitude: 0.3, stackBehavior: 'refresh', maxStacks: 3, color: '#0F0', icon: 'lightning' });
      expect(mgr.getEffects('A')[0].remainingMs).toBe(1000);
    });

    it('increments stacks on stack-behavior=stack up to maxStacks', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' });
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' });
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' });
      expect(mgr.getEffects('A')[0].stacks).toBe(3);
    });

    it('does not exceed maxStacks', () => {
      const mgr = makeManager();
      for (let i = 0; i < 10; i++) {
        mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' });
      }
      expect(mgr.getEffects('A')[0].stacks).toBe(5);
    });

    it('ignores re-application on stack-behavior=ignore', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'freeze', durationMs: 5000, magnitude: 0.5, stackBehavior: 'ignore', maxStacks: 1, color: '#00F', icon: 'dot-yellow' });
      const before = mgr.getEffects('A')[0].remainingMs;
      mgr.apply({ team: 'A', type: 'freeze', durationMs: 9999, magnitude: 0.9, stackBehavior: 'ignore', maxStacks: 1, color: '#00F', icon: 'dot-yellow' });
      expect(mgr.getEffects('A')[0].remainingMs).toBe(before);
    });
  });

  describe('tick()', () => {
    it('decrements remainingMs for non-stack effects', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'freeze', durationMs: 1000, magnitude: 0.5, stackBehavior: 'refresh', maxStacks: 1, color: '#00F', icon: 'dot-yellow' });
      const hp = { A: 100, B: 100 };
      mgr.tick(200, hp);
      expect(mgr.getEffects('A')[0].remainingMs).toBe(800);
    });

    it('removes expired effects', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'freeze', durationMs: 100, magnitude: 0.5, stackBehavior: 'refresh', maxStacks: 1, color: '#00F', icon: 'dot-yellow' });
      const hp = { A: 100, B: 100 };
      mgr.tick(200, hp);
      expect(mgr.hasEffect('A', 'freeze')).toBe(false);
    });

    it('never expires stack-behavior=stack effects', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' });
      const hp = { A: 100, B: 100 };
      mgr.tick(1_000_000, hp);
      expect(mgr.hasEffect('A', 'speedBoost')).toBe(true);
    });

    it('applies burn DoT per tick', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'burn', durationMs: 5000, magnitude: 10, stackBehavior: 'refresh', maxStacks: 1, color: '#F00', icon: 'flame' });
      const hp = { A: 100, B: 100 };
      mgr.tick(1000, hp); // 1 second → 10 damage
      expect(hp.A).toBeCloseTo(90, 1);
    });

    it('applies poison DoT per tick', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'B', type: 'poison', durationMs: 5000, magnitude: 5, stackBehavior: 'refresh', maxStacks: 1, color: '#0F0', icon: 'dot-green' });
      const hp = { A: 100, B: 100 };
      mgr.tick(1000, hp); // 1 second → 5 damage
      expect(hp.B).toBeCloseTo(95, 1);
    });

    it('does not reduce HP below 0 from DoT', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'burn', durationMs: 5000, magnitude: 1000, stackBehavior: 'refresh', maxStacks: 1, color: '#F00', icon: 'flame' });
      const hp = { A: 10, B: 100 };
      mgr.tick(1000, hp);
      expect(hp.A).toBe(0);
    });
  });

  describe('getSpeedMultiplier()', () => {
    it('returns 1.0 with no effects', () => {
      const mgr = makeManager();
      expect(mgr.getSpeedMultiplier('A')).toBe(1.0);
    });

    it('freeze reduces speed', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'freeze', durationMs: 5000, magnitude: 0.5, stackBehavior: 'refresh', maxStacks: 1, color: '#00F', icon: 'dot-yellow' });
      expect(mgr.getSpeedMultiplier('A')).toBeCloseTo(0.5);
    });

    it('speedBoost increases speed proportionally to stacks', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' });
      mgr.apply({ team: 'A', type: 'speedBoost', durationMs: 999_999, magnitude: 0.3, stackBehavior: 'stack', maxStacks: 5, color: '#0F0', icon: 'lightning' }); // stacks=2
      // bonus = 0.3 * 2 = 0.6 → mult = 1.6
      expect(mgr.getSpeedMultiplier('A')).toBeCloseTo(1.6);
    });

    it('clamps minimum speed multiplier to 0.1', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'freeze', durationMs: 5000, magnitude: 2.0, stackBehavior: 'refresh', maxStacks: 1, color: '#00F', icon: 'dot-yellow' });
      expect(mgr.getSpeedMultiplier('A')).toBe(0.1);
    });
  });

  describe('getOutgoingDamageMultiplier()', () => {
    it('rage increases outgoing damage', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'rage', durationMs: 5000, magnitude: 0.5, stackBehavior: 'refresh', maxStacks: 1, color: '#F00', icon: 'burst' });
      expect(mgr.getOutgoingDamageMultiplier('A')).toBeCloseTo(1.5);
    });

    it('weaken reduces outgoing damage', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'weaken', durationMs: 5000, magnitude: 0.4, stackBehavior: 'refresh', maxStacks: 1, color: '#888', icon: 'burst' });
      expect(mgr.getOutgoingDamageMultiplier('A')).toBeCloseTo(0.6);
    });
  });

  describe('getIncomingDamageMultiplier()', () => {
    it('harden reduces incoming damage', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'harden', durationMs: 5000, magnitude: 0.25, stackBehavior: 'refresh', maxStacks: 1, color: '#888', icon: 'scales' });
      expect(mgr.getIncomingDamageMultiplier('A')).toBeCloseTo(0.75);
    });
  });

  describe('consumeShield()', () => {
    it('returns raw damage when no shield', () => {
      const mgr = makeManager();
      expect(mgr.consumeShield('A', 50)).toBe(50);
    });

    it('absorbs damage up to shield magnitude', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'shield', durationMs: 999_999, magnitude: 30, stackBehavior: 'refresh', maxStacks: 1, color: '#FFF', icon: 'scales' });
      expect(mgr.consumeShield('A', 20)).toBe(0);
      expect(mgr.getEffects('A')[0].magnitude).toBe(10);
    });

    it('removes shield when fully depleted', () => {
      const mgr = makeManager();
      mgr.apply({ team: 'A', type: 'shield', durationMs: 999_999, magnitude: 10, stackBehavior: 'refresh', maxStacks: 1, color: '#FFF', icon: 'scales' });
      const remaining = mgr.consumeShield('A', 50);
      expect(remaining).toBe(40);
      expect(mgr.hasEffect('A', 'shield')).toBe(false);
    });
  });
});
