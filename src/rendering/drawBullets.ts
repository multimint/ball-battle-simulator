import type { Bullet } from '../models/GameState';
import type { Ctx2D } from './ctx';

// ── Per-spriteKey bullet painters ─────────────────────────────────────────────
// Each painter receives the full Bullet object and the canvas context already
// saved. New projectile styles: add an entry here keyed by projectileIcon.

type BulletPainter = (ctx: Ctx2D, b: Bullet) => void;
const BULLET_PAINTERS: Record<string, BulletPainter> = {};

export function registerBulletPainter(spriteKey: string, fn: BulletPainter): void {
  BULLET_PAINTERS[spriteKey] = fn;
}

function drawShurikenShape(
  ctx: Ctx2D,
  x: number,
  y: number,
  outerR: number,
  rotation: number,
  color: string,
): void {
  const innerR = outerR * 0.28;
  const spikes = 4;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Blade fill
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  // Dark center rivet
  ctx.fillStyle = 'rgba(10, 10, 40, 0.65)';
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // White glint on one blade tip
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(outerR * 0.62, 0, outerR * 0.18, outerR * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

registerBulletPainter('proj-shuriken', (ctx, b) => {
  const startTtl = b.attack.bulletTtl ?? 2000;
  const elapsed  = startTtl - b.ttl;
  const spin     = elapsed * (6 * Math.PI / 1000); // 3 full rotations per second
  ctx.shadowColor = b.color;
  ctx.shadowBlur  = 16;
  ctx.globalAlpha = 0.96;
  drawShurikenShape(ctx, b.x, b.y, b.radius * 2.4, spin, b.color);
});

export function drawBullets(ctx: Ctx2D, bullets: Bullet[]): void {
  for (const b of bullets) {
    ctx.save();
    const painter = b.spriteKey ? BULLET_PAINTERS[b.spriteKey] : undefined;
    if (painter) {
      painter(ctx, b);
    } else {
      // Default: colored glow circle (other balls' projectiles)
      ctx.shadowColor = b.color;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = b.color;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#FFFFFF';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
