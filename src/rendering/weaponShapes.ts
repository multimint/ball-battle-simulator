import type { Ctx2D } from './ctx';

type DrawFn = (ctx: Ctx2D, color: string, r: number) => void;

const registry: Record<string, DrawFn> = {};

export function getWeaponShape(name: string): DrawFn | undefined {
  return registry[name];
}

// ── Melee ─────────────────────────────────────────────────────────────────────

registry['Heavy Hammer'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 5;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.rect(r * 0.2, -r * 0.75, r * 0.8, r * 1.5);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r * 0.2, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;
};

registry['Long Spear'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 5;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, 0);
  ctx.lineTo(r * 0.7, 0);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.5);
  ctx.lineTo(r * 1.4, 0);
  ctx.lineTo(r * 0.7,  r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
};

registry['Chain Flail'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 5;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    ctx.lineTo(Math.cos(a) * r,        Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
};

registry['Long Sword'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 5;
  ctx.strokeStyle = '#7A5C2E';
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, 0);
  ctx.lineTo(r * 0.05, 0);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(r * 0.05, -r * 0.55);
  ctx.lineTo(r * 0.05,  r * 0.55);
  ctx.stroke();
  ctx.fillStyle  = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(r * 0.05,  r * 0.14);
  ctx.lineTo(r * 0.05, -r * 0.14);
  ctx.lineTo(r * 1.8,   0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF55';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;
};

registry['War Axe'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 5;
  ctx.strokeStyle = '#7A5C2E';
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, 0);
  ctx.lineTo(r * 0.2,  0);
  ctx.stroke();
  ctx.fillStyle  = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(r * 0.1,  -r * 0.8);
  ctx.lineTo(r * 0.85, -r * 1.1);
  ctx.quadraticCurveTo(r * 1.5, 0, r * 0.85, r * 1.1);
  ctx.lineTo(r * 0.1,   r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF44';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
};

// ── Projectile ────────────────────────────────────────────────────────────────

registry['Boomerang'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.8, Math.PI * 0.8);
  ctx.stroke();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = color + '88';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, -Math.PI * 0.8, Math.PI * 0.8);
  ctx.stroke();
  ctx.shadowBlur = 0;
};

registry['Grenade Bomb'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFAA22';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.quadraticCurveTo(r * 0.4, -r * 1.1, r * 0.2, -r * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#FFEE44';
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 1.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
};

// ── Utility ───────────────────────────────────────────────────────────────────

registry['Magnet Beam'] = (ctx, color, r) => {
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.8);
  ctx.lineTo(r * 0.7,  -r * 0.8);
  ctx.arc(r * 0.7, 0, r * 0.8, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-r * 0.4, r * 0.8);
  ctx.stroke();
  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(-r * 0.4, -r * 0.8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4444FF';
  ctx.beginPath();
  ctx.arc(-r * 0.4, r * 0.8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
};
