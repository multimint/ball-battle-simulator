import type { WeaponEffect } from '../models/GameState';

export function drawWeaponEffects(ctx: CanvasRenderingContext2D, effects: WeaponEffect[]): void {
  for (const e of effects) {
    const alpha = 1 - e.progress / e.maxProgress;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    switch (e.type) {
      case 'hammer':
        drawHammerEffect(ctx, e);
        break;
      case 'sword':
        drawSwordEffect(ctx, e);
        break;
      case 'spear':
        drawSpearEffect(ctx, e);
        break;
      case 'laser':
        drawLaserEffect(ctx, e);
        break;
      case 'cannon':
        drawCannonEffect(ctx, e);
        break;
      case 'explosion':
        drawExplosionEffect(ctx, e);
        break;
      case 'shield':
        drawShieldEffect(ctx, e);
        break;
      case 'shockwave':
        drawShockwaveEffect(ctx, e);
        break;
      case 'flail':
        drawFlailEffect(ctx, e);
        break;
      default:
        break;
    }

    ctx.restore();
  }
}

function drawHammerEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  const len = 30 + (1 - e.progress / e.maxProgress) * 20;
  ctx.fillStyle = e.color;
  ctx.fillRect(-8, -len, 16, len);
  ctx.fillRect(-20, -len - 10, 40, 14);
  ctx.restore();
}

function drawSwordEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -35);
  ctx.stroke();
  // Slash arc
  ctx.beginPath();
  ctx.arc(0, 0, 25, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.strokeStyle = `${e.color}88`;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawSpearEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -50);
  ctx.stroke();
  // Tip
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.moveTo(0, -55);
  ctx.lineTo(-6, -40);
  ctx.lineTo(6, -40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLaserEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  if (e.x2 === undefined || e.y2 === undefined) return;
  const t = 1 - e.progress / e.maxProgress;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 3 * t;
  ctx.lineCap = 'round';
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(e.x2, e.y2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawCannonEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  ctx.fillStyle = e.color;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 8 * (1 - e.progress / e.maxProgress * 0.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawExplosionEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  const progress = e.progress / e.maxProgress;
  const r = (e.radius ?? 60) * progress;
  const alpha = 1 - progress;
  const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
  grad.addColorStop(0, `rgba(255,200,50,${alpha * 0.8})`);
  grad.addColorStop(0.5, `rgba(255,80,20,${alpha * 0.5})`);
  grad.addColorStop(1, `rgba(255,50,0,0)`);
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawShieldEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  const r = (e.radius ?? 40);
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, -Math.PI * 0.8, Math.PI * 0.8);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawShockwaveEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  const progress = e.progress / e.maxProgress;
  const r = (e.radius ?? 80) * progress;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 6 * (1 - progress);
  ctx.stroke();
}

function drawFlailEffect(ctx: CanvasRenderingContext2D, e: WeaponEffect): void {
  ctx.beginPath();
  ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = e.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function stepWeaponEffects(effects: WeaponEffect[]): WeaponEffect[] {
  const alive: WeaponEffect[] = [];
  for (const e of effects) {
    e.progress += 1;
    if (e.progress < e.maxProgress) alive.push(e);
  }
  return alive;
}

let effectId = 0;
export function createWeaponEffect(
  type: string,
  x: number,
  y: number,
  angle: number,
  color: string,
  maxProgress = 15,
  options?: Partial<WeaponEffect>
): WeaponEffect {
  return {
    id: String(effectId++),
    type,
    x,
    y,
    angle,
    progress: 0,
    maxProgress,
    color,
    ...options,
  };
}
