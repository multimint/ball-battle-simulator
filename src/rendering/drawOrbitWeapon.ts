import type { WeaponStats } from '../models/types';
import { WEAPON_ORBIT_GAP } from '../constants/gameConstants';
import type { Ctx2D } from './ctx';
import { getWeaponShape } from './weaponShapes';

// ── Hitbox radius per weapon category ────────────────────────────────────────
// These define both hit-detection radius AND the visual size of the drawn shape.
const HITBOX_BY_CATEGORY: Record<string, number> = {
  melee:      26,   // was 13 — wider swing, hits up to ~94px between centres
  shield:     24,   // was 17 — broad deflection coverage
  projectile: 17,   // was  9 — spinning blade feel
  aoe:        24,   // was 15 — large shockwave presence
  utility:    18,   // was 11 — magnet / repulsor field
};

export function getWeaponHitboxRadius(weapon: WeaponStats, rangeMult = 1): number {
  return (HITBOX_BY_CATEGORY[weapon.attacks[0].type] ?? 10) * rangeMult;
}

/** Compute the weapon's world position from the ball center + orbit angle. */
export function getOrbitPosition(
  ballX: number,
  ballY: number,
  ballRadius: number,
  angle: number,
  weaponHitboxR: number
): { x: number; y: number } {
  const orbitR = ballRadius + WEAPON_ORBIT_GAP + weaponHitboxR;
  return {
    x: ballX + Math.cos(angle) * orbitR,
    y: ballY + Math.sin(angle) * orbitR,
  };
}

/**
 * Draw the orbiting weapon at its current orbit position.
 * Weapon shapes are drawn with their "business end" in the +X direction
 * in local space, then rotated to match the orbit angle so they always
 * point radially outward from the ball.
 */
export function drawOrbitWeapon(
  ctx: Ctx2D,
  ballX: number,
  ballY: number,
  ballRadius: number,
  angle: number,
  weapon: WeaponStats,
  team: 'A' | 'B',
  rangeMult = 1,
): void {
  const baseHitboxR = getWeaponHitboxRadius(weapon);          // orbit distance never scales
  const hitboxR     = getWeaponHitboxRadius(weapon, rangeMult); // shape scales with stacks
  const pos = getOrbitPosition(ballX, ballY, ballRadius, angle, baseHitboxR);
  const color = weapon.color ?? (team === 'A' ? '#E47D79' : '#4A90E2');

  ctx.save();
  ctx.translate(pos.x, pos.y);
  // Rotate so the weapon's local +X axis points radially outward
  ctx.rotate(angle);

  switch (weapon.attacks[0].type) {
    case 'melee':
      drawMeleeShape(ctx, weapon, color, hitboxR);
      break;
    case 'shield':
      drawShieldShape(ctx, color, hitboxR);
      break;
    case 'projectile':
      drawProjectileShape(ctx, weapon, color, hitboxR);
      break;
    case 'aoe':
      drawAoeShape(ctx, color, hitboxR);
      break;
    case 'utility':
      drawUtilityShape(ctx, weapon, color, hitboxR);
      break;
  }

  ctx.restore();
}

// ── Shape drawers (all local coords, business-end at +X) ─────────────────────

function drawMeleeShape(ctx: Ctx2D, weapon: WeaponStats, color: string, r: number): void {
  const shape = getWeaponShape(weapon.name);
  if (shape) { shape(ctx, color, r); return; }
  // Generic sword fallback — narrow blade, tip at +X
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 1.1, 0);
  ctx.lineTo(r * 0.15, r * 0.22);
  ctx.lineTo(-r * 0.7, r * 0.13);
  ctx.lineTo(-r * 0.7, -r * 0.13);
  ctx.lineTo(r * 0.15, -r * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFFAA';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.15, -r * 0.5);
  ctx.lineTo(r * 0.15, r * 0.5);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawShieldShape(
  ctx: Ctx2D,
  color: string,
  r: number
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  // Shield faces outward (+X direction): convex curve on the +X side
  ctx.fillStyle = color + 'AA';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 1.1);
  ctx.lineTo(r * 0.8, -r * 0.6);
  ctx.quadraticCurveTo(r * 1.3, 0, r * 0.8, r * 0.6);
  ctx.lineTo(-r * 0.4, r * 1.1);
  ctx.lineTo(-r * 0.6, r * 0.6);
  ctx.quadraticCurveTo(-r * 0.4, 0, -r * 0.6, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Emblem cross
  ctx.strokeStyle = '#FFFFFF88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.lineTo(0, r * 0.5);
  ctx.moveTo(-r * 0.3, 0);
  ctx.lineTo(r * 0.4, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawProjectileShape(ctx: Ctx2D, weapon: WeaponStats, color: string, r: number): void {
  const shape = getWeaponShape(weapon.name);
  if (shape) { shape(ctx, color, r); return; }
  // Generic projectile fallback — glowing diamond/bullet, tip at +X
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 1.1, 0);
  ctx.lineTo(r * 0.2, r * 0.5);
  ctx.lineTo(-r * 0.6, 0);
  ctx.lineTo(r * 0.2, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF88';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawAoeShape(
  ctx: Ctx2D,
  color: string,
  r: number
): void {
  // Symmetric shockwave burst — no orientation needed
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const rays = 8;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = color + 'CC';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawUtilityShape(ctx: Ctx2D, weapon: WeaponStats, color: string, r: number): void {
  const shape = getWeaponShape(weapon.name);
  if (shape) { shape(ctx, color, r); return; }
  // Generic utility fallback — gear/repulsor shape
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  const teeth = 6;
  ctx.fillStyle = color + 'AA';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * 0.65;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}
