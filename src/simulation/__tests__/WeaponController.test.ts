import { describe, it, expect } from 'vitest';
import Matter from 'matter-js';
import { shouldWeaponFire } from '../WeaponController';
import {
  LOW_HP_THRESHOLD, ARENA_SIZE,
  WEAPON_SPEED_TRIGGER_FRAC, WEAPON_EDGE_THRESHOLD_PX,
} from '../../constants/gameConstants';

function makeBody(x = 240, y = 240, vx = 0, vy = 0): Matter.Body {
  const b = Matter.Bodies.circle(x, y, 20);
  Matter.Body.setVelocity(b, { x: vx, y: vy });
  return b;
}

const MAX_SPEED = 100;

describe('shouldWeaponFire()', () => {
  it('none always returns false', () => {
    expect(shouldWeaponFire('none', makeBody(), 1.0, MAX_SPEED)).toBe(false);
  });

  it('onCollision always returns true', () => {
    expect(shouldWeaponFire('onCollision', makeBody(), 1.0, MAX_SPEED)).toBe(true);
  });

  it('onTimer always returns true', () => {
    expect(shouldWeaponFire('onTimer', makeBody(), 0.1, MAX_SPEED)).toBe(true);
  });

  describe('onLowHP', () => {
    it('returns true at the threshold', () => {
      expect(shouldWeaponFire('onLowHP', makeBody(), LOW_HP_THRESHOLD, MAX_SPEED)).toBe(true);
    });

    it('returns true below the threshold', () => {
      expect(shouldWeaponFire('onLowHP', makeBody(), LOW_HP_THRESHOLD - 0.01, MAX_SPEED)).toBe(true);
    });

    it('returns false above the threshold', () => {
      expect(shouldWeaponFire('onLowHP', makeBody(), LOW_HP_THRESHOLD + 0.01, MAX_SPEED)).toBe(false);
    });
  });

  describe('onSpeed', () => {
    it('returns true when speed meets the threshold fraction of maxSpeed', () => {
      const speed = MAX_SPEED * WEAPON_SPEED_TRIGGER_FRAC;
      expect(shouldWeaponFire('onSpeed', makeBody(240, 240, speed, 0), 1.0, MAX_SPEED)).toBe(true);
    });

    it('returns true above the threshold', () => {
      const speed = MAX_SPEED * WEAPON_SPEED_TRIGGER_FRAC + 1;
      expect(shouldWeaponFire('onSpeed', makeBody(240, 240, speed, 0), 1.0, MAX_SPEED)).toBe(true);
    });

    it('returns false below the threshold', () => {
      const speed = MAX_SPEED * WEAPON_SPEED_TRIGGER_FRAC - 1;
      expect(shouldWeaponFire('onSpeed', makeBody(240, 240, speed, 0), 1.0, MAX_SPEED)).toBe(false);
    });

    it('considers both velocity components', () => {
      // 45° angle: vx = vy = speed/√2
      const component = (MAX_SPEED * WEAPON_SPEED_TRIGGER_FRAC) / Math.SQRT2;
      expect(shouldWeaponFire('onSpeed', makeBody(240, 240, component, component), 1.0, MAX_SPEED)).toBe(true);
    });
  });

  describe('onEdge', () => {
    it('returns false when in the center', () => {
      expect(shouldWeaponFire('onEdge', makeBody(240, 240), 1.0, MAX_SPEED)).toBe(false);
    });

    it('returns true near the left wall', () => {
      expect(shouldWeaponFire('onEdge', makeBody(WEAPON_EDGE_THRESHOLD_PX - 1, 240), 1.0, MAX_SPEED)).toBe(true);
    });

    it('returns true near the right wall', () => {
      expect(shouldWeaponFire('onEdge', makeBody(ARENA_SIZE - WEAPON_EDGE_THRESHOLD_PX + 1, 240), 1.0, MAX_SPEED)).toBe(true);
    });

    it('returns true near the top wall', () => {
      expect(shouldWeaponFire('onEdge', makeBody(240, WEAPON_EDGE_THRESHOLD_PX - 1), 1.0, MAX_SPEED)).toBe(true);
    });

    it('returns true near the bottom wall', () => {
      expect(shouldWeaponFire('onEdge', makeBody(240, ARENA_SIZE - WEAPON_EDGE_THRESHOLD_PX + 1), 1.0, MAX_SPEED)).toBe(true);
    });

    it('returns false just outside the threshold on all sides', () => {
      expect(shouldWeaponFire('onEdge', makeBody(WEAPON_EDGE_THRESHOLD_PX, 240), 1.0, MAX_SPEED)).toBe(false);
      expect(shouldWeaponFire('onEdge', makeBody(ARENA_SIZE - WEAPON_EDGE_THRESHOLD_PX, 240), 1.0, MAX_SPEED)).toBe(false);
      expect(shouldWeaponFire('onEdge', makeBody(240, WEAPON_EDGE_THRESHOLD_PX), 1.0, MAX_SPEED)).toBe(false);
      expect(shouldWeaponFire('onEdge', makeBody(240, ARENA_SIZE - WEAPON_EDGE_THRESHOLD_PX), 1.0, MAX_SPEED)).toBe(false);
    });
  });
});
