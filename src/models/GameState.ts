import type { Body } from 'matter-js';

// ─── Particle System ──────────────────────────────────────────────────────────

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;      // remaining frames
  maxLife: number;   // total frames alive
  radius: number;
  color: string;
}

// ─── Projectile ───────────────────────────────────────────────────────────────

export interface ProjectileState {
  body: Body;
  ownerId: 'A' | 'B';
  weaponName: string;
  spawnTime: number;      // timestamp (ms)
  isBoomerang?: boolean;  // for curved returning behavior
  hasReturned?: boolean;  // boomerang: has it flipped direction?
  ttl?: number;           // time-to-live in ms (e.g. grenade fuse)
}

// ─── Weapon Visual Effect ─────────────────────────────────────────────────────

export interface WeaponEffect {
  id: string;            // unique id for removal
  type: string;          // 'laser' | 'shield' | 'sword' | 'explosion' | 'hammer' | 'spear'
  x: number;
  y: number;
  x2?: number;           // for line effects (laser endpoint)
  y2?: number;
  angle: number;         // radians
  progress: number;      // 0→1 animation progress
  maxProgress: number;   // when to remove
  color: string;
  radius?: number;       // for explosion / shockwave
}

// ─── Floating Damage Numbers ──────────────────────────────────────────────────

export interface FloatingDamage {
  id: string;
  text: string;
  x: number;
  y: number;
  alpha: number;   // 0→1, fades to 0
  color: string;
}

// ─── Screen Shake ─────────────────────────────────────────────────────────────

export interface ScreenShake {
  magnitude: number;
  ttl: number;      // frames remaining
}

// ─── Stuck Detection ──────────────────────────────────────────────────────────

export interface StuckState {
  lastX: number;
  lastY: number;
  stuckFrames: number;
}
