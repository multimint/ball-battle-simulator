// ─── Ball Configuration ───────────────────────────────────────────────────────

export interface BallStats {
  name: string;
  radius: number;        // collision radius (px)
  mass: number;          // mass (kg-equivalent)
  maxSpeed: number;      // max linear speed (px/s)
  friction: number;      // surface friction (0–1)
  restitution: number;   // bounce (0–1)
  spinSpeed: number;     // base angular velocity (rad/s)
  durability: number;    // hit points (HP)
  attackPower: number;   // base damage multiplier
  knockbackPower: number;// base knockback multiplier
  color: string;         // CSS color
  icon?: string;         // optional icon name/id
}

// ─── Weapon Configuration ─────────────────────────────────────────────────────

export type TriggerType =
  | 'onCollision'
  | 'onEdge'
  | 'onTimer'
  | 'onSpeed'
  | 'onLowHP'
  | 'none';

export interface WeaponStats {
  name: string;
  category: 'melee' | 'projectile' | 'aoe' | 'shield' | 'utility';
  damage: number;       // damage dealt on hit
  knockback: number;    // knockback force
  range: number;        // effective distance (ball radii)
  speed: number;        // swing or projectile speed (px/s)
  cooldown: number;     // time between uses (s)
  trigger: TriggerType;
  description: string;
  color?: string;
}

// ─── Fighter Preset (ball + weapon bundled) ───────────────────────────────────

export interface FighterPreset {
  id: string;
  name: string;
  lore: string;
  icon: string;
  ball: BallStats;
  weapon: WeaponStats;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export type TeamId = 'A' | 'B';

export interface TeamConfig {
  name: string;
  ball: BallStats;
  weapon: WeaponStats;
}

// ─── Game Phase ───────────────────────────────────────────────────────────────

export type GamePhase = 'setup' | 'simulating' | 'playing';
export type WinnerType = 'A' | 'B' | 'draw' | null;
