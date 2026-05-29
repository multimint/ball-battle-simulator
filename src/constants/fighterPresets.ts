import type { BallStats, WeaponStats } from '../models/types';

// ─── Fighter Preset ──────────────────────────────────────────────────────────
// Each fighter bundles a ball body (physics stats) with its weapon.
// Choosing a weapon automatically determines the ball's stats.

export interface FighterPreset {
  id: string;           // unique key
  name: string;         // display name  e.g. "Iron Fortress"
  lore: string;         // one-liner flavour text
  icon: string;         // emoji
  ball: BallStats;
  weapon: WeaponStats;
}

// ── Shared physics baseline (all fighters equal size & speed) ────────────────
const BALL_RADIUS  = 24;   // px  — same for every fighter
const BALL_SPEED   = 5.5;  // units — same for every fighter

export const FIGHTER_PRESETS: FighterPreset[] = [
  // ── Chain Flail → Quickstrike body ───────────────────────────────────────
  {
    id: 'quick-flail',
    name: 'Quick Flail',
    lore: 'Lands dozens of rapid blows — each hit feeds its momentum, turning speed into unstoppable fury.',
    icon: '⚡',
    ball: {
      name: 'Quickstrike',
      radius: BALL_RADIUS, mass: 2.8, maxSpeed: 5.5,
      friction: 0.1, restitution: 0.5, spinSpeed: 4.5,
      durability: 250, attackPower: 10, knockbackPower: 35,
      color: '#44CC22', icon: '⚡',
      ability: {
        id: 'quickstrike-momentum',
        name: 'Momentum',
        description: 'Each landed hit boosts speed by 50% for 0.8s — keep hitting to maintain the rush.',
        trigger: 'onHitDealt',
        params: {
          statusEffect: 'speedBoost',
          statusTarget: 'self',
          statusDuration: 999999999,
          statusMagnitude: 0.3,
          stackBehavior: 'stack',
          maxStacks: 5,
          statusColor: '#44FF44',
          statusIcon: '⚡',
          hitFlash: true,
          hitFlashColor: '#44FF22',
          hitFlashTarget: 'self',
        },
      },
    },
    weapon: {
      name: 'Long Sword',
      category: 'melee', damage: 50, knockback: 40,
      range: 1.5, speed: 6.75, cooldown: 0.7,
      trigger: 'onCollision',
      description: 'Long blade that orbits fast — land enough hits and momentum takes over.',
      color: '#33BB55',
    },
  },
  // ── Energy Laser → Marksman body ─────────────────────────────────────────
  {
    id: 'hawkeye',
    name: 'Hawkeye',
    lore: 'A precision strike unit built for calculated repositioning and surgical laser fire.',
    icon: '🎯',
    ball: {
      name: 'Marksman',
      radius: BALL_RADIUS, mass: 3.0, maxSpeed: 5.0,
      friction: 0.12, restitution: 0.45, spinSpeed: 3.5,
      durability: 300, attackPower: 55, knockbackPower: 50,
      color: '#4488CC', icon: '🎯',
      ability: {
        id: 'marksman-target-lock',
        name: 'Target Lock',
        description: 'Charges over 10s, then bursts away from the opponent at +80% speed — creates distance for the rapid laser.',
        trigger: 'passive',
        params: {
          chargeRate: 0.01,
          burstMagnitude: 0.8,
          burstDuration: 1200,
          burstColor: '#66AAFF',
          burstIcon: '🎯',
        },
      },
    },
    weapon: {
      name: 'Energy Laser',
      category: 'projectile', damage: 30, knockback: 50,
      range: 10.0, speed: 4.0, cooldown: 1.5,
      trigger: 'onTimer',
      description: 'Long-range energy beam that fires every 3 seconds with surgical precision.',
      color: '#4488CC',
      aimAtEnemy: true,
    },
  },
  // ── War Axe → Bloodrage body ──────────────────────────────────────────────
  {
    id: 'blood-axe',
    name: 'Blood Axe',
    lore: 'The more it bleeds, the harder it hits.',
    icon: '🔥',
    ball: {
      name: 'Bloodrage',
      radius: BALL_RADIUS, mass: 3.0, maxSpeed: BALL_SPEED,
      friction: 0.15, restitution: 0.4, spinSpeed: 2.5,
      durability: 350, attackPower: 65, knockbackPower: 60,
      color: '#CC2200', icon: '🔥',
      ability: {
        id: 'bloodrage-fury',
        name: 'Bloodrage',
        description: 'Goes berserk below 30% HP — +50% damage and +40% speed.',
        trigger: 'onLowHP',
        params: {
          threshold: 0.3,
          statusEffect: 'rage',
          statusTarget: 'self',
          statusDuration: 3000,
          statusMagnitude: 0.5,
          stackBehavior: 'refresh',
          maxStacks: 1,
          statusColor: '#FF4400',
          statusIcon: '💢',
          speedBoostDuration: 3000,
          speedBoostMagnitude: 0.7,
          speedBoostColor: '#FF8800',
          speedBoostIcon: '⚡',
          hitFlash: true,
          hitFlashColor: '#CC0000',
          hitFlashTarget: 'self',
        },
      },
    },
    weapon: {
      name: 'War Axe',
      category: 'melee', damage: 45, knockback: 55,
      range: 1.0, speed: 4.0, cooldown: 0.8,
      trigger: 'onCollision',
      description: 'Slow, devastating swing. Each hit lands with crushing force.',
      color: '#884400',
    },
  },
];
