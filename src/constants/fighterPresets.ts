import type { BallStats, WeaponStats } from '../models/types';
import { ABILITY_PRESETS } from './abilityPresets';

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
      durability: 50, attackPower: 2, knockbackPower: 35,
      color: '#44CC22', icon: '⚡',
      ability: ABILITY_PRESETS['quickstrike-momentum'],
    },
    weapon: {
      name: 'Long Sword',
      range: 1.5, speed: 6.75, trigger: 'onCollision',
      description: 'Long blade that orbits fast — land enough hits and momentum takes over.',
      color: '#33BB55',
      effectLabel: 'spear',
      attacks: [{ type: 'melee', cooldown: 0.7, damage: 10, knockback: 40 }],
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
      durability: 60, attackPower: 11, knockbackPower: 50,
      color: '#4488CC', icon: '🎯',
    },
    weapon: {
      name: 'Energy Laser',
      range: 10.0, speed: 4.0, trigger: 'onTimer',
      description: 'Fires 3-way split bullets every 1.5s; charges a full-power laser beam every 10s.',
      color: '#4488CC',
      hitEffect: 'laser',
      attacks: [
        { type: 'projectile', cooldown: 3,  damage: 3,  knockback: 20, aimAtEnemy: true, bulletCount: 3, bulletSpeed: 1.0 },
        { type: 'projectile', cooldown: 10.0, damage: 15, knockback: 65, aimAtEnemy: true, hitscan: true },
      ],
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
      durability: 70, attackPower: 13, knockbackPower: 60,
      color: '#CC2200', icon: '🔥',
      ability: ABILITY_PRESETS['bloodrage-fury'],
    },
    weapon: {
      name: 'War Axe',
      range: 1.0, speed: 4.0, trigger: 'onCollision',
      description: 'Slow, devastating swing. Each hit lands with crushing force.',
      color: '#884400',
      attacks: [{ type: 'melee', cooldown: 0.8, damage: 9, knockback: 55 }],
    },
  },
];
