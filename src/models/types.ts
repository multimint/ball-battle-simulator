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
  ability?: BallAbility; // optional passive ability
}

// ─── Weapon Configuration ─────────────────────────────────────────────────────

export type TriggerType =
  | 'onCollision'
  | 'onEdge'
  | 'onTimer'
  | 'onSpeed'
  | 'onLowHP'
  | 'none';

/** A single attack mode — a weapon can have one or more of these. */
export interface AttackConfig {
  type: 'melee' | 'projectile' | 'aoe' | 'shield' | 'utility';
  cooldown: number;     // seconds between uses
  damage: number;       // damage dealt on hit
  knockback: number;    // knockback force
  aimAtEnemy?: boolean;   // fire projectile toward enemy instead of orbit melee
  hitscan?: boolean;      // instant-hit (no bullet travel); applies damage directly
  bulletCount?: number;   // bullets fired per use (default 1); spread evenly when > 1
  bulletSpread?: number;  // radians between bullets (default 0.40)
  bulletInterval?: number;// seconds between each bullet in a burst; omit = fire all at once
  bulletSpeed?: number;   // travel speed multiplier (default 2.0; lower = slower)
}

export interface WeaponStats {
  name: string;
  description: string;
  color?: string;
  range: number;        // orbit distance (ball radii)
  speed: number;        // orbit angular speed
  trigger: TriggerType;
  attacks: AttackConfig[];
  kbMult?: number;      // knockback multiplier override (default 1.0)
  dmgMult?: number;     // damage multiplier override (default 1.0)
  effectLabel?: string; // melee hit animation: 'hammer'|'sword'|'spear'|'flail'
  hitEffect?: 'explosion' | 'laser'; // projectile visual on impact
  hitEffectRadius?: number;          // radius for explosion effects (px)
  utilityBehavior?: 'pull' | 'push-both'; // utility weapon mode
  selfKnockbackFrac?: number;        // recoil fraction for push-both (default 0.4)
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

// ─── Ball Ability ─────────────────────────────────────────────────────────────

export type BallAbilityType =
  | 'trail'
  | 'onBounce'
  | 'onHitDealt'
  | 'onHitReceived'
  | 'onLowHP'
  | 'passive'
  | 'spawnUnit';

export interface BallAbility {
  id: string;
  name: string;
  description: string;
  trigger: BallAbilityType;
  params: Record<string, number | string | boolean>;
}

// ─── Status Effects ───────────────────────────────────────────────────────────

export type StatusEffectType =
  | 'burn'       // damage over time (stacks intensity)
  | 'poison'     // slower damage over time (no stack)
  | 'freeze'     // reduce ball speed
  | 'rage'       // increase own outgoing damage
  | 'harden'     // reduce incoming damage
  | 'speedBoost' // increase own speed
  | 'weaken'     // reduce target outgoing damage
  | 'lifesteal'  // restore HP on each weapon hit
  | 'shield';    // absorb flat incoming damage

export interface StatusEffect {
  id: string;
  type: StatusEffectType;
  remainingMs: number;
  magnitude: number;         // strength: multiplier or HP/s depending on type
  stackBehavior: 'refresh' | 'stack' | 'ignore';
  stacks: number;
  maxStacks: number;
  color: string;             // ring color for visual indicator
  icon: string;              // emoji shown above ball
}
