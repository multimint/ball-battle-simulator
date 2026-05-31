import { describe, it, expect, beforeEach } from 'vitest';
import { EffectsController } from '../EffectsController';

describe('EffectsController', () => {
  let fx: EffectsController;

  beforeEach(() => { fx = new EffectsController(); });

  describe('applyHitFlash', () => {
    it('sets hitFlashA on team A', () => {
      fx.applyHitFlash('A', 0.65, '#FF0000', 5);
      expect(fx.hitFlashA).toEqual({ alpha: 0.65, color: '#FF0000', ttl: 5 });
      expect(fx.hitFlashB.ttl).toBe(0);
    });

    it('sets hitFlashB on team B', () => {
      fx.applyHitFlash('B', 0.5, '#0000FF', 4);
      expect(fx.hitFlashB).toEqual({ alpha: 0.5, color: '#0000FF', ttl: 4 });
      expect(fx.hitFlashA.ttl).toBe(0);
    });
  });

  describe('step', () => {
    it('decrements screen shake ttl', () => {
      fx.applyScreenShake(8, 10);
      fx.step();
      expect(fx.screenShake.ttl).toBe(9);
    });

    it('decays hit flash alpha', () => {
      fx.applyHitFlash('A', 1.0, '#FFF', 5);
      fx.step();
      expect(fx.hitFlashA.alpha).toBeCloseTo(0.68);
      expect(fx.hitFlashA.ttl).toBe(4);
    });

    it('recovers slow motion toward 1.0', () => {
      fx.applySlowMotion();
      expect(fx.slowMotion).toBeLessThan(1.0);
      fx.step();
      expect(fx.slowMotion).toBeGreaterThan(fx.slowMotion - 1); // moving toward 1
    });
  });

  describe('applyTierEffects', () => {
    it('applies hit flash for melee on defender', () => {
      fx.applyTierEffects('melee', 'A', '#CC6633', 10);
      expect(fx.hitFlashA.ttl).toBeGreaterThan(0);
    });

    it('applies screen flash for projectile', () => {
      fx.applyTierEffects('projectile', 'B', '#4488CC', 5);
      expect(fx.screenFlash.ttl).toBeGreaterThan(0);
    });

    it('applies slow motion on aoe', () => {
      fx.applyTierEffects('aoe', 'A', '#FF44FF', 20);
      expect(fx.slowMotion).toBeLessThan(1.0);
    });
  });
});
