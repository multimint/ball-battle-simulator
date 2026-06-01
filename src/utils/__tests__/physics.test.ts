import { describe, it, expect } from 'vitest';
import Matter from 'matter-js';
import { directionBetween, distanceBetween } from '../physics';

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
