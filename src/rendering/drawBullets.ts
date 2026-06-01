import type { Bullet } from '../models/GameState';
import type { Ctx2D } from './ctx';

export function drawBullets(ctx: Ctx2D, bullets: Bullet[]): void {
  for (const b of bullets) {
    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = b.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = '#FFFFFF';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
