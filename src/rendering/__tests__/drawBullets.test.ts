import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerBulletPainter, drawBullets } from '../drawBullets';
import type { Bullet } from '../../models/GameState';
import type { AttackConfig } from '../../models/types';

function makeBullet(overrides: Partial<Bullet> = {}): Bullet {
  const attack: AttackConfig = { type: 'projectile', cooldown: 1, damage: 5, knockback: 10, bulletTtl: 2000 };
  return {
    x: 100, y: 100, vx: 1, vy: 0,
    owner: 'A', radius: 5, color: '#FF0000',
    ttl: 2000, attack,
    ...overrides,
  };
}

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), closePath: vi.fn(),
    arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(),
    fillRect: vi.fn(),
    shadowColor: '', shadowBlur: 0, fillStyle: '', globalAlpha: 1,
    strokeStyle: '', lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('registerBulletPainter', () => {
  it('registered painter is called for matching spriteKey', () => {
    const painter = vi.fn();
    registerBulletPainter('test-reg-bullet', painter);
    const ctx = makeCtx();
    const b = makeBullet({ spriteKey: 'test-reg-bullet' as never });
    drawBullets(ctx, [b]);
    expect(painter).toHaveBeenCalledWith(ctx, b);
  });

  it('registered painter is NOT called for a different spriteKey', () => {
    const painter = vi.fn();
    registerBulletPainter('test-other-bullet', painter);
    const ctx = makeCtx();
    const b = makeBullet({ spriteKey: 'different-key' as never });
    drawBullets(ctx, [b]);
    expect(painter).not.toHaveBeenCalled();
  });

  it('default circle path is used when no spriteKey is set', () => {
    const ctx = makeCtx();
    drawBullets(ctx, [makeBullet()]);
    expect(ctx.arc).toHaveBeenCalled(); // default circle fallback
  });

  it('proj-shuriken is pre-registered and painter is called for that key', () => {
    const ctx = makeCtx();
    // proj-shuriken painter calls drawShurikenShape which calls ctx.beginPath / ctx.fill
    const b = makeBullet({ spriteKey: 'proj-shuriken' as never });
    drawBullets(ctx, [b]);
    expect(ctx.fill).toHaveBeenCalled();
  });
});
