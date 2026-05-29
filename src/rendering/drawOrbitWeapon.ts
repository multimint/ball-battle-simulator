import type { WeaponStats } from '../models/types';
import { WEAPON_ORBIT_GAP } from '../constants/gameConstants';

// ── Hitbox radius per weapon category ────────────────────────────────────────
// These define both hit-detection radius AND the visual size of the drawn shape.
const HITBOX_BY_CATEGORY: Record<string, number> = {
  melee:      26,   // was 13 — wider swing, hits up to ~94px between centres
  shield:     24,   // was 17 — broad deflection coverage
  projectile: 17,   // was  9 — spinning blade feel
  aoe:        24,   // was 15 — large shockwave presence
  utility:    18,   // was 11 — magnet / repulsor field
};

export function getWeaponHitboxRadius(weapon: WeaponStats): number {
  return HITBOX_BY_CATEGORY[weapon.category] ?? 10;
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
  ctx: CanvasRenderingContext2D,
  ballX: number,
  ballY: number,
  ballRadius: number,
  angle: number,
  weapon: WeaponStats,
  team: 'A' | 'B'
): void {
  const hitboxR = getWeaponHitboxRadius(weapon);
  const pos = getOrbitPosition(ballX, ballY, ballRadius, angle, hitboxR);
  const color = weapon.color ?? (team === 'A' ? '#E47D79' : '#4A90E2');

  ctx.save();
  ctx.translate(pos.x, pos.y);
  // Rotate so the weapon's local +X axis points radially outward
  ctx.rotate(angle);

  switch (weapon.category) {
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

function drawMeleeShape(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponStats,
  color: string,
  r: number
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;

  if (weapon.name === 'Heavy Hammer') {
    // Head block at +X end
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(r * 0.2, -r * 0.75, r * 0.8, r * 1.5);
    ctx.fill();
    // Handle
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r * 0.2, 0);
    ctx.stroke();
  } else if (weapon.name === 'Long Spear') {
    // Shaft
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, 0);
    ctx.lineTo(r * 0.7, 0);
    ctx.stroke();
    // Triangular tip
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.5);
    ctx.lineTo(r * 1.4, 0);
    ctx.lineTo(r * 0.7, r * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (weapon.name === 'Chain Flail') {
    // Spiked ball (symmetric, looks good at any angle)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
  } else if (weapon.name === 'Long Sword') {
    // Handle
    ctx.strokeStyle = '#7A5C2E';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, 0);
    ctx.lineTo(r * 0.05, 0);
    ctx.stroke();
    // Guard cross piece
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.55);
    ctx.lineTo(r * 0.05, r * 0.55);
    ctx.stroke();
    // Long thin blade
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(r * 0.05, r * 0.14);
    ctx.lineTo(r * 0.05, -r * 0.14);
    ctx.lineTo(r * 1.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF55';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (weapon.name === 'War Axe') {
    // Wooden handle from -X to center
    ctx.strokeStyle = '#7A5C2E';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 1.0, 0);
    ctx.lineTo(r * 0.2, 0);
    ctx.stroke();
    // Broad crescent blade at +X
    ctx.fillStyle = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.8);
    ctx.lineTo(r * 0.85, -r * 1.1);
    ctx.quadraticCurveTo(r * 1.5, 0, r * 0.85, r * 1.1);
    ctx.lineTo(r * 0.1, r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF44';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Generic sword — narrow blade, tip at +X
    ctx.fillStyle = color;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(r * 1.1, 0);        // tip
    ctx.lineTo(r * 0.15, r * 0.22); // guard bottom
    ctx.lineTo(-r * 0.7, r * 0.13); // pommel bottom
    ctx.lineTo(-r * 0.7, -r * 0.13);// pommel top
    ctx.lineTo(r * 0.15, -r * 0.22);// guard top
    ctx.closePath();
    ctx.fill();
    // Guard cross piece
    ctx.strokeStyle = '#FFFFFFAA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.5);
    ctx.lineTo(r * 0.15, r * 0.5);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawShieldShape(
  ctx: CanvasRenderingContext2D,
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

function drawProjectileShape(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponStats,
  color: string,
  r: number
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  if (weapon.name === 'Boomerang') {
    // Boomerang arc
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.stroke();
    // Wing tips
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.strokeStyle = color + '88';
    ctx.stroke();
  } else if (weapon.name === 'Grenade Bomb') {
    // Round bomb body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    // Fuse spark
    ctx.strokeStyle = '#FFAA22';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.quadraticCurveTo(r * 0.4, -r * 1.1, r * 0.2, -r * 1.5);
    ctx.stroke();
    // Fuse tip glow
    ctx.fillStyle = '#FFEE44';
    ctx.beginPath();
    ctx.arc(r * 0.2, -r * 1.5, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Energy Laser / Power Cannon — glowing diamond/bullet, tip at +X
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
  }
  ctx.shadowBlur = 0;
}

function drawAoeShape(
  ctx: CanvasRenderingContext2D,
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

function drawUtilityShape(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponStats,
  color: string,
  r: number
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  if (weapon.name === 'Magnet Beam') {
    // U-shaped magnet (rotated to face +X)
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Left prong
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.8);
    ctx.lineTo(r * 0.7, -r * 0.8);
    ctx.arc(r * 0.7, 0, r * 0.8, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-r * 0.4, r * 0.8);
    ctx.stroke();
    // Pole tips colored (red/blue)
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(-r * 0.4, -r * 0.8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4444FF';
    ctx.beginPath();
    ctx.arc(-r * 0.4, r * 0.8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Repulsor — gear/gear shape (symmetric)
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
    // Center hole
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
