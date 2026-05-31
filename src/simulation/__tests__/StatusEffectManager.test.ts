import { describe, it, expect, beforeEach } from 'vitest';
import { StatusEffectManager } from '../StatusEffectManager';
import type { SpriteKey } from '../../sprites/SpriteKey';

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
      mgr.apply('A', 'burn', ...Object.values(BASE) as [number, number, 'refresh', number, string, SpriteKey]);
      expect(mgr.hasEffect('A', 'burn')).toBe(true);
      expect(mgr.hasEffect('B', 'burn')).toBe(false);
    });

    it('does not add duplicate effect types', () => {
      const mgr = makeManager();
      mgr.apply('A', 'burn', BASE.durationMs, BASE.magnitude, 'refresh', 1, '#F00', 'flame');
      mgr.apply('A', 'burn', BASE.durationMs, BASE.magnitude, 'refresh', 1, '#F00', 'flame');
      expect(mgr.getEffects('A').length).toBe(1);
    });

    it('refreshes duration on stack-behavior=refresh', () => {
      const mgr = makeManager();
      mgr.apply('A', 'speedBoost', 1000, 0.3, 'refresh', 3, '#0F0', 'lightning');
      const effect = mgr.getEffects('A')[0];
      effect.remainingMs = 100;
      mgr.apply('A', 'speedBoost', 1000, 0.3, 'refresh', 3, '#0F0', 'lightning');
      expect(mgr.getEffects('A')[0].remainingMs).toBe(1000);
    });

    it('increments stacks on stack-behavior=stack up to maxStacks', () => {
      const mgr = makeManager();
      mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning');
      mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning');
      mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning');
      expect(mgr.getEffects('A')[0].stacks).toBe(3);
    });

    it('does not exceed maxStacks', () => {
      const mgr = makeManager();
      for (let i = 0; i < 10; i++) {
        mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning');
      }
      expect(mgr.getEffects('A')[0].stacks).toBe(5);
    });

    it('ignores re-application on stack-behavior=ignore', () => {
      const mgr = makeManager();
      mgr.apply('A', 'freeze', 5000, 0.5, 'ignore', 1, '#00F', 'dot-yellow');
      const before = mgr.getEffects('A')[0].remainingMs;
      mgr.apply('A', 'freeze', 9999, 0.9, 'ignore', 1, '#00F', 'dot-yellow');
      expect(mgr.getEffects('A')[0].remainingMs).toBe(before);
    });
  });

  describe('tick()', () => {
    it('decrements remainingMs for non-stack effects', () => {
      const mgr = makeManager();
      mgr.apply('A', 'freeze', 1000, 0.5, 'refresh', 1, '#00F', 'dot-yellow');
      const hp = { A: 100, B: 100 };
      mgr.tick(200, hp);
      expect(mgr.getEffects('A')[0].remainingMs).toBe(800);
    });

    it('removes expired effects', () => {
      const mgr = makeManager();
      mgr.apply('A', 'freeze', 100, 0.5, 'refresh', 1, '#00F', 'dot-yellow');
      const hp = { A: 100, B: 100 };
      mgr.tick(200, hp);
      expect(mgr.hasEffect('A', 'freeze')).toBe(false);
    });

    it('never expires stack-behavior=stack effects', () => {
      const mgr = makeManager();
      mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning');
      const hp = { A: 100, B: 100 };
      mgr.tick(1_000_000, hp);
      expect(mgr.hasEffect('A', 'speedBoost')).toBe(true);
    });

    it('applies burn DoT per tick', () => {
      const mgr = makeManager();
      // burn: magnitude per second per stack
      mgr.apply('A', 'burn', 5000, 10, 'refresh', 1, '#F00', 'flame');
      const hp = { A: 100, B: 100 };
      mgr.tick(1000, hp); // 1 second → 10 damage
      expect(hp.A).toBeCloseTo(90, 1);
    });

    it('applies poison DoT per tick', () => {
      const mgr = makeManager();
      mgr.apply('B', 'poison', 5000, 5, 'refresh', 1, '#0F0', 'dot-green');
      const hp = { A: 100, B: 100 };
      mgr.tick(1000, hp); // 1 second → 5 damage
      expect(hp.B).toBeCloseTo(95, 1);
    });

    it('does not reduce HP below 0 from DoT', () => {
      const mgr = makeManager();
      mgr.apply('A', 'burn', 5000, 1000, 'refresh', 1, '#F00', 'flame');
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
      mgr.apply('A', 'freeze', 5000, 0.5, 'refresh', 1, '#00F', 'dot-yellow');
      expect(mgr.getSpeedMultiplier('A')).toBeCloseTo(0.5);
    });

    it('speedBoost increases speed proportionally to stacks', () => {
      const mgr = makeManager();
      mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning');
      mgr.apply('A', 'speedBoost', 999_999, 0.3, 'stack', 5, '#0F0', 'lightning'); // stacks=2
      // bonus = 0.3 * 2 = 0.6 → mult = 1.6
      expect(mgr.getSpeedMultiplier('A')).toBeCloseTo(1.6);
    });

    it('clamps minimum speed multiplier to 0.1', () => {
      const mgr = makeManager();
      mgr.apply('A', 'freeze', 5000, 2.0, 'refresh', 1, '#00F', 'dot-yellow');
      expect(mgr.getSpeedMultiplier('A')).toBe(0.1);
    });
  });

  describe('getOutgoingDamageMultiplier()', () => {
    it('rage increases outgoing damage', () => {
      const mgr = makeManager();
      mgr.apply('A', 'rage', 5000, 0.5, 'refresh', 1, '#F00', 'burst');
      expect(mgr.getOutgoingDamageMultiplier('A')).toBeCloseTo(1.5);
    });

    it('weaken reduces outgoing damage', () => {
      const mgr = makeManager();
      mgr.apply('A', 'weaken', 5000, 0.4, 'refresh', 1, '#888', 'burst');
      expect(mgr.getOutgoingDamageMultiplier('A')).toBeCloseTo(0.6);
    });
  });

  describe('getIncomingDamageMultiplier()', () => {
    it('harden reduces incoming damage', () => {
      const mgr = makeManager();
      mgr.apply('A', 'harden', 5000, 0.25, 'refresh', 1, '#888', 'scales');
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
      mgr.apply('A', 'shield', 999_999, 30, 'refresh', 1, '#FFF', 'scales');
      expect(mgr.consumeShield('A', 20)).toBe(0);
      expect(mgr.getEffects('A')[0].magnitude).toBe(10);
    });

    it('removes shield when fully depleted', () => {
      const mgr = makeManager();
      mgr.apply('A', 'shield', 999_999, 10, 'refresh', 1, '#FFF', 'scales');
      const remaining = mgr.consumeShield('A', 50);
      expect(remaining).toBe(40);
      expect(mgr.hasEffect('A', 'shield')).toBe(false);
    });
  });
});
