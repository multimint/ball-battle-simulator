import type { Ctx2D } from './ctx';

type DrawFn = (ctx: Ctx2D, color: string, r: number) => void;

const registry: Record<string, DrawFn> = {};

export function getWeaponShape(name: string): DrawFn | undefined {
  return registry[name];
}

export function registerWeaponShape(name: string, fn: DrawFn): void {
  registry[name] = fn;
}

// ── Projectile icon shapes ────────────────────────────────────────────────────
// Keyed by weapon.icon (SpriteKey string). Looked up by drawOrbitWeapon when
// weapon.projectileOrbitFixed is true — the caller cancels the orbit rotation
// before invoking the shape so it renders in a fixed world orientation.

const iconRegistry: Record<string, DrawFn> = {};

export function getProjectileIconShape(icon: string): DrawFn | undefined {
  return iconRegistry[icon];
}

export function registerProjectileIconShape(icon: string, fn: DrawFn): void {
  iconRegistry[icon] = fn;
}

registerProjectileIconShape('weapon-shuriken', (ctx, color, r) => {
  const outerR = r * 0.85;
  const innerR = r * 0.28;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a   = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? outerR : innerR;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else         ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
});

// ── Active fighter weapons ────────────────────────────────────────────────────

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
