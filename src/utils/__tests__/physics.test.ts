import { describe, it, expect, vi } from 'vitest';
import Matter from 'matter-js';
import { directionBetween, distanceBetween, randomVelocity } from '../physics';
import { PHYSICS_SPEED_SCALE } from '../../constants/gameConstants';

function makeBody(x: number, y: number): Matter.Body {
  return Matter.Bodies.circle(x, y, 10);
}

describe('directionBetween()', () => {
  it('returns a unit vector', () => {
    const dir = directionBetween(makeBody(0, 0), makeBody(3, 4));
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1.0);
  });

  it('points from A toward B along the x-axis', () => {
    const dir = directionBetween(makeBody(0, 0), makeBody(100, 0));
    expect(dir.x).toBeCloseTo(1.0);
    expect(dir.y).toBeCloseTo(0.0);
  });

  it('points in the correct diagonal direction', () => {
    const dir = directionBetween(makeBody(0, 0), makeBody(3, 4));
    expect(dir.x).toBeCloseTo(0.6);
    expect(dir.y).toBeCloseTo(0.8);
  });

  it('handles coincident bodies without NaN', () => {
    const dir = directionBetween(makeBody(100, 100), makeBody(100, 100));
    expect(Number.isNaN(dir.x)).toBe(false);
    expect(Number.isNaN(dir.y)).toBe(false);
  });
});

describe('distanceBetween()', () => {
  it('returns the correct Euclidean distance', () => {
    expect(distanceBetween(makeBody(0, 0), makeBody(3, 4))).toBeCloseTo(5.0);
  });

  it('returns 0 for coincident bodies', () => {
    expect(distanceBetween(makeBody(50, 50), makeBody(50, 50))).toBe(0);
  });

  it('is symmetric', () => {
    const a = makeBody(10, 20);
    const b = makeBody(40, 60);
    expect(distanceBetween(a, b)).toBeCloseTo(distanceBetween(b, a));
  });
});

describe('randomVelocity()', () => {
  it('speed is within [0.95, 1.10] × maxSpeed × PHYSICS_SPEED_SCALE', () => {
    const maxSpeed = 5;
    const scaled = maxSpeed * PHYSICS_SPEED_SCALE;
    for (let i = 0; i < 20; i++) {
      const v = randomVelocity(maxSpeed, 0);
      const speed = Math.hypot(v.x, v.y);
      expect(speed).toBeGreaterThanOrEqual(scaled * 0.95 - 1e-9);
      expect(speed).toBeLessThanOrEqual(scaled * 1.10 + 1e-9);
    }
  });

  it('angle stays within ±63° of baseAngle', () => {
    const maxAngleDiff = Math.PI * 0.35 + 1e-9; // half of 0.7π spread
    for (let i = 0; i < 20; i++) {
      const v = randomVelocity(5, 0);
      const angle = Math.atan2(v.y, v.x);
      expect(Math.abs(angle)).toBeLessThanOrEqual(maxAngleDiff);
    }
  });

  it('leftward base angle (π) produces a leftward velocity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // neutral random → exact base angle
    const v = randomVelocity(5, Math.PI);
    expect(v.x).toBeLessThan(0); // moving left
    vi.restoreAllMocks();
  });

  it('rightward base angle (0) produces a rightward velocity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // neutral random → exact base angle
    const v = randomVelocity(5, 0);
    expect(v.x).toBeGreaterThan(0); // moving right
    vi.restoreAllMocks();
  });

  it('does not produce NaN', () => {
    for (let i = 0; i < 20; i++) {
      const v = randomVelocity(5, 0);
      expect(Number.isNaN(v.x)).toBe(false);
      expect(Number.isNaN(v.y)).toBe(false);
    }
  });
});
