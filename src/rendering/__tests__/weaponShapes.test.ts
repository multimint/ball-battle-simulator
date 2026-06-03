import { describe, it, expect, vi } from 'vitest';
import {
  getProjectileIconShape,
  registerProjectileIconShape,
} from '../weaponShapes';

describe('projectile icon shape registry', () => {
  it('registerProjectileIconShape stores a shape retrievable by getProjectileIconShape', () => {
    const painter = vi.fn();
    registerProjectileIconShape('test-icon-shape', painter);
    expect(getProjectileIconShape('test-icon-shape')).toBe(painter);
  });

  it('returns undefined for an unregistered icon', () => {
    expect(getProjectileIconShape('no-such-icon-xyz')).toBeUndefined();
  });

  it('weapon-shuriken is pre-registered', () => {
    expect(getProjectileIconShape('weapon-shuriken')).toBeDefined();
  });

  it('calls the registered painter with ctx, color, and r', () => {
    const painter = vi.fn();
    registerProjectileIconShape('test-icon-call', painter);
    const shape = getProjectileIconShape('test-icon-call')!;
    const fakeCtx = {} as CanvasRenderingContext2D;
    shape(fakeCtx, '#FF0000', 20);
    expect(painter).toHaveBeenCalledWith(fakeCtx, '#FF0000', 20);
  });
});
