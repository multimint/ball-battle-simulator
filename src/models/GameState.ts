import type { Body } from 'matter-js';
import type { AttackConfig } from './types';

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

// ─── Screen Flash ─────────────────────────────────────────────────────────────

export interface ScreenFlash {
  alpha: number;    // current opacity 0–1 (decays each frame)
  color: string;    // fill color
  ttl: number;      // frames remaining
}

// ─── Ball Hit Flash ───────────────────────────────────────────────────────────

export interface HitFlash {
  alpha: number;    // current opacity 0–1 (decays each frame)
  color: string;    // overlay color on the struck ball
  ttl: number;      // frames remaining
}

// ─── Stuck Detection ──────────────────────────────────────────────────────────

export interface StuckState {
  lastX: number;
  lastY: number;
  stuckFrames: number;
}

// ─── Bullets ─────────────────────────────────────────────────────────────────

export interface Bullet {
  x: number;
  y: number;
  vx: number;  // px per ms
  vy: number;  // px per ms
  owner: 'A' | 'B';
  radius: number;
  color: string;
  ttl: number;         // ms remaining
  attack: AttackConfig; // which attack config fired this bullet
}

// ─── Ability Trail Segments ───────────────────────────────────────────────────

export interface TrailSegment {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  ttl: number;    // frames remaining
  maxTtl: number; // total frames
}
