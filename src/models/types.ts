import type { SpriteKey } from '../sprites/SpriteKey';
import type { AudioProfile } from '../audio/types';

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
  color: string;         // CSS color
  icon?: SpriteKey;      // optional sprite icon
  ability?: BallAbility; // optional passive ability
}

// ─── Weapon Configuration ─────────────────────────────────────────────────────

/** Controls when a weapon is allowed to fire. Checked before cooldown/range logic. */
export type TriggerType =
  | 'onCollision' // standard orbit melee — fires when hitbox overlaps enemy
  | 'onTimer'     // standard cooldown — fires on schedule regardless of position
  | 'onSpeed'     // fires only when ball speed ≥ WEAPON_SPEED_TRIGGER_FRAC × maxSpeed
  | 'onLowHP'     // fires only when own HP ≤ LOW_HP_THRESHOLD
  | 'onEdge'      // fires only when ball is within WEAPON_EDGE_THRESHOLD_PX of any wall
  | 'none';       // never fires (cosmetic / passive slot)

/** A single attack mode — a weapon can have one or more of these. */
export interface AttackConfig {
  type: 'melee' | 'projectile' | 'aoe' | 'shield' | 'utility' | 'summon';
  cooldown: number;     // seconds between uses
  damage: number;       // damage dealt on hit
  knockback: number;    // knockback force
  aimAtEnemy?: boolean;   // fire projectile toward enemy instead of orbit melee
  hitscan?: boolean;      // instant-hit (no bullet travel); applies damage directly
  bulletCount?: number;   // bullets fired per use (default 1); spread evenly when > 1
  bulletSpread?: number;  // radians between bullets (default 0.40)
  bulletInterval?: number;// seconds between each bullet in a burst; omit = fire all at once
  bulletSpeed?: number;   // travel speed multiplier (default 2.0; lower = slower)
  audioHint?: 'laser';    // triggers weapon-specific audio instead of the ball's default hit sound
  hitStatusEffect?: StatusEffectType; // status effect applied to target on hit
  hitStatusDuration?: number;         // ms
  hitStatusMagnitude?: number;        // strength (0–1)
  hitStatusColor?: string;            // ring/icon tint
  hitStatusIcon?: SpriteKey;          // sprite shown above target when effect is applied
  // Summon attack fields (type: 'summon' only) — spawns a unit at the weapon tip
  summonHp?: number;              // unit starting HP (default 30)
  summonRadius?: number;          // unit radius in px (default 10)
  summonSpeed?: number;           // unit initial speed on spawn (default 3.5)
  summonMaxCount?: number;        // max units alive per team (default 3)
  summonMass?: number;            // unit physics mass (default 0.8)
  summonNormalColor?: string;     // unit normal-state fill color
  summonContactDamage?: number;   // damage dealt on enemy contact in normal state (default 4)
  summonContactCooldownMs?: number; // ms between contact hits in normal state (default 600)
  summonChargedColor?: string;    // unit charged-state fill color
  summonChargedSpeed?: number;    // unit speed when launched in charged state (default summonSpeed × 4)
  summonChargedDamage?: number;   // damage dealt on enemy contact in charged state (default 10)
  // Status effects applied on drone hit (same field naming as hitStatus* on regular attacks)
  summonContactStatusEffect?: StatusEffectType;  // applied on normal-state contact hit
  summonContactStatusDuration?: number;          // ms (default 2000)
  summonContactStatusMagnitude?: number;         // strength 0–1 (default 0.3)
  summonContactStatusColor?: string;             // ring tint
  summonContactStatusIcon?: SpriteKey;
  summonChargedStatusEffect?: StatusEffectType;  // applied on charged-state hit
  summonChargedStatusDuration?: number;
  summonChargedStatusMagnitude?: number;
  summonChargedStatusColor?: string;
  summonChargedStatusIcon?: SpriteKey;
}

export interface WeaponStats {
  name: string;
  description: string;
  color?: string;
  icon?: SpriteKey;            // orbit-weapon sprite
  projectileIcon?: SpriteKey;  // traveling bullet sprite (projectile weapons only)
  range: number;        // orbit distance (ball radii)
  speed: number;        // orbit angular speed
  trigger: TriggerType;
  attacks: AttackConfig[];
  kbMult?: number;      // knockback multiplier override (default 1.0)
  dmgMult?: number;     // damage multiplier override (default 1.0)
  hitReachMult?: number;// hit-detection radius multiplier — set to match blade tip (default 1.0)
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
  icon: SpriteKey;
  ball: BallStats;
  weapon: WeaponStats;
  audioProfile: AudioProfile;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export type TeamId = 'A' | 'B';

export interface TeamConfig {
  fighterId: string;
  name: string;
  ball: BallStats;
  weapon: WeaponStats;
  audioProfile: AudioProfile;
}

// ─── Game Phase ───────────────────────────────────────────────────────────────

export type GamePhase = 'setup' | 'simulating' | 'playing';
export type WinnerType = 'A' | 'B' | 'draw' | null;

// ─── Ball Ability ─────────────────────────────────────────────────────────────

export type BallAbilityType =
  | 'onHitDealt'
  | 'onLowHP'
  | 'passive'
  | 'onTimer';

// ─── HUD Status Row ───────────────────────────────────────────────────────────

/** A single label/value pair rendered in the info strip below the arena. */
export interface StatusRow {
  label: string;
  value: string;
}

// ─── Ability Params ───────────────────────────────────────────────────────────

/** Shared optional fields available to any ability trigger. */
export interface CommonAbilityParams {
  // Primary status effect applied on trigger
  statusEffect?: StatusEffectType;
  statusTarget?: 'self' | 'enemy';
  statusDuration?: number;        // ms
  statusMagnitude?: number;       // multiplier (0–2)
  stackBehavior?: StatusEffect['stackBehavior'];
  maxStacks?: number;
  statusColor?: string;
  statusIcon?: SpriteKey;

  // Second simultaneous status effect
  secondStatusEffect?: StatusEffectType;
  secondStatusTarget?: 'self' | 'enemy';
  secondStatusDuration?: number;
  secondStatusMagnitude?: number;
  secondStatusBehavior?: StatusEffect['stackBehavior'];
  secondStatusMaxStacks?: number;
  secondStatusColor?: string;
  secondStatusIcon?: SpriteKey;

  // Hit flash overlay on the ball
  hitFlash?: boolean;
  hitFlashColor?: string;
  hitFlashTarget?: 'self' | 'enemy';

  // Screen shake / flash / slow-motion on trigger
  hitShakeMagnitude?: number;
  hitSlowMo?: boolean;
  hitScreenFlash?: boolean;
  hitScreenFlashAlpha?: number;
  hitScreenFlashColor?: string;
  hitScreenFlashTtl?: number;

  // Trail burst spawned at ball position when ability fires
  trailOnTrigger?: boolean;
  trailColor?: string;
  trailRadiusFrac?: number;       // fraction of ball radius
  trailAlpha?: number;            // initial alpha (0–1)
  trailTtl?: number;              // frames
  trailCount?: number;            // trail segments per burst
  trailScatterFrac?: number;      // scatter radius fraction
  trailSpawnChance?: number;      // 0–1

  // Per-frame tick trail while ability condition is met
  tickTrailEnabled?: boolean;
  tickTrailConditionEffect?: StatusEffectType;
  tickTrailConditionMinStacks?: number;
  tickTrailSpawnChance?: number;
  tickTrailAtWeapon?: boolean;    // spawn at weapon position instead of ball
  tickTrailColor?: string;
  tickTrailRadiusFrac?: number;
  tickTrailAlpha?: number;
  tickTrailTtl?: number;

  // HUD bottom strip label
  hudLabel?: string;
}

/** Params for `onHitDealt` abilities (e.g. Quick Flail Momentum). */
export interface OnHitDealtParams extends CommonAbilityParams {
  rangePerStack?: number; // weapon range multiplier added per status stack
}

/** Params for `onLowHP` abilities (e.g. Blood Axe Bloodrage). */
export interface OnLowHPParams extends CommonAbilityParams {
  threshold: number;             // HP fraction (0–1) at which berserk activates
  berserkKnockbackBonus?: number; // extra knockback applied on every hit while berserk
}

export type PassiveParams = CommonAbilityParams;

/** Params for `onTimer` abilities (e.g. Revenant Soul Surge). */
export interface OnTimerParams extends CommonAbilityParams {
  intervalMs: number;  // ms between each Soul Surge launch
}

// ─── Drone (summoner sub-unit) ────────────────────────────────────────────────

/** State of a spawned unit. 'normal' = passive/wandering; 'charged' = launched toward enemy. */
export type UnitState = 'normal' | 'charged';

// ─── Ball Ability (discriminated union) ──────────────────────────────────────

type BallAbilityBase = {
  id: string;
  name: string;
  description: string;
  /** Returns HUD rows for this ability's live state. Return [] for no display. */
  getHudRows?: (effects: StatusEffect[], hpFrac: number, timerFrac?: number) => StatusRow[];
};

export type BallAbility =
  | (BallAbilityBase & { trigger: 'onHitDealt'; params: OnHitDealtParams })
  | (BallAbilityBase & { trigger: 'onLowHP';    params: OnLowHPParams })
  | (BallAbilityBase & { trigger: 'passive';    params: PassiveParams })
  | (BallAbilityBase & { trigger: 'onTimer';    params: OnTimerParams });

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
  icon: SpriteKey;           // sprite shown above ball
}
