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
  // ── 1. Heavy Hammer → Heavy Tank body ────────────────────────────────────
  {
    id: 'iron-fortress',
    name: 'Iron Fortress',
    lore: 'Slow but unstoppable. One swing sends foes flying.',
    icon: '🛡️',
    ball: {
      name: 'Heavy Tank',
      radius: BALL_RADIUS, mass: 5.0, maxSpeed: BALL_SPEED,
      friction: 0.20, restitution: 0.3, spinSpeed: 1.0,
      durability: 150, attackPower: 80, knockbackPower: 100,
      color: '#EE8888', icon: '🛡️',
    },
    weapon: {
      name: 'Heavy Hammer',
      category: 'melee', damage: 80, knockback: 100,
      range: 1.0, speed: 3.0, cooldown: 2.0,
      trigger: 'onCollision',
      description: 'Slow swing; very high knockback on collision.',
      color: '#CC6633',
    },
  },

  // ── 2. Swift Sword → Flurry Blade body ───────────────────────────────────
  {
    id: 'flash-blade',
    name: 'Flash Blade',
    lore: 'Blink and you\'ll miss the slash that cuts you down.',
    icon: '⚡',
    ball: {
      name: 'Flurry Blade',
      radius: BALL_RADIUS, mass: 2.0, maxSpeed: BALL_SPEED,
      friction: 0.10, restitution: 0.5, spinSpeed: 4.5,
      durability: 70, attackPower: 60, knockbackPower: 50,
      color: '#9966FF', icon: '⚡',
    },
    weapon: {
      name: 'Swift Sword',
      category: 'melee', damage: 50, knockback: 40,
      range: 1.0, speed: 6.0, cooldown: 1.0,
      trigger: 'onSpeed',
      description: 'Fast slash at top speed; moderate knockback.',
      color: '#66AAFF',
    },
  },

  // ── 3. Long Spear → Berserker body ───────────────────────────────────────
  {
    id: 'lancer',
    name: 'Lancer',
    lore: 'Charges forward and skewers anything in its path.',
    icon: '🔥',
    ball: {
      name: 'Berserker',
      radius: BALL_RADIUS, mass: 3.5, maxSpeed: BALL_SPEED,
      friction: 0.20, restitution: 0.4, spinSpeed: 2.8,
      durability: 120, attackPower: 65, knockbackPower: 70,
      color: '#FF9966', icon: '🔥',
    },
    weapon: {
      name: 'Long Spear',
      category: 'melee', damage: 60, knockback: 30,
      range: 2.0, speed: 4.0, cooldown: 1.5,
      trigger: 'onCollision',
      description: 'Stab with extended reach.',
      color: '#996633',
    },
  },

  // ── 4. Chain Flail → Chaos Orb body ──────────────────────────────────────
  {
    id: 'chain-dancer',
    name: 'Chain Dancer',
    lore: 'Unpredictable. Erratic. Hits you when you least expect it.',
    icon: '🌀',
    ball: {
      name: 'Chaos Orb',
      radius: BALL_RADIUS, mass: 2.5, maxSpeed: BALL_SPEED,
      friction: 0.10, restitution: 0.5, spinSpeed: 3.5,
      durability: 80, attackPower: 70, knockbackPower: 40,
      color: '#EEEE88', icon: '🌀',
    },
    weapon: {
      name: 'Chain Flail',
      category: 'melee', damage: 40, knockback: 40,
      range: 2.0, speed: 5.0, cooldown: 0.5,
      trigger: 'onTimer',
      description: 'Spins unpredictably; spawns orbital hitbox every 0.5s.',
      color: '#888888',
    },
  },

  // ── 5. Defender Shield → Magnet Core body ────────────────────────────────
  {
    id: 'steel-guardian',
    name: 'Steel Guardian',
    lore: 'Every hit you land bounces back twice as hard.',
    icon: '🧲',
    ball: {
      name: 'Magnet Core',
      radius: BALL_RADIUS, mass: 2.8, maxSpeed: BALL_SPEED,
      friction: 0.10, restitution: 0.4, spinSpeed: 2.0,
      durability: 90, attackPower: 55, knockbackPower: 80,
      color: '#88EEEE', icon: '🧲',
    },
    weapon: {
      name: 'Defender Shield',
      category: 'shield', damage: 0, knockback: 100,
      range: 1.0, speed: 0, cooldown: 0,
      trigger: 'onCollision',
      description: 'No damage, but reflects enemy hit with 2× knockback.',
      color: '#AAAAFF',
    },
  },

  // ── 6. Energy Laser → Glass Cannon body ──────────────────────────────────
  {
    id: 'laser-phantom',
    name: 'Laser Phantom',
    lore: 'Fragile as glass, deadly as light. One beam can end it all.',
    icon: '💎',
    ball: {
      name: 'Glass Cannon',
      radius: BALL_RADIUS, mass: 1.0, maxSpeed: BALL_SPEED,
      friction: 0.05, restitution: 0.6, spinSpeed: 5.0,
      durability: 30, attackPower: 100, knockbackPower: 20,
      color: '#EE88EE', icon: '💎',
    },
    weapon: {
      name: 'Energy Laser',
      category: 'projectile', damage: 60, knockback: 50,
      range: 10.0, speed: 10.0, cooldown: 3.0,
      trigger: 'onTimer',
      description: 'Fires a fast beam toward the opponent every 3s.',
      color: '#FF4444',
    },
  },

  // ── 7. Power Cannon → Heavy Tank body ────────────────────────────────────
  {
    id: 'artillery',
    name: 'Artillery',
    lore: 'A walking fortress that fires devastating shells.',
    icon: '💣',
    ball: {
      name: 'Heavy Tank',
      radius: BALL_RADIUS, mass: 5.0, maxSpeed: BALL_SPEED,
      friction: 0.20, restitution: 0.3, spinSpeed: 1.0,
      durability: 150, attackPower: 80, knockbackPower: 100,
      color: '#CC8855', icon: '💣',
    },
    weapon: {
      name: 'Power Cannon',
      category: 'projectile', damage: 80, knockback: 80,
      range: 8.0, speed: 5.0, cooldown: 3.0,
      trigger: 'onTimer',
      description: 'Launches a heavy orb; high damage and knockback.',
      color: '#FF8833',
    },
  },

  // ── 8. Boomerang → Speed Striker body ────────────────────────────────────
  {
    id: 'wind-hunter',
    name: 'Wind Hunter',
    lore: 'Throws and retrieves. The weapon always comes back.',
    icon: '🪃',
    ball: {
      name: 'Speed Striker',
      radius: BALL_RADIUS, mass: 1.2, maxSpeed: BALL_SPEED,
      friction: 0.10, restitution: 0.5, spinSpeed: 4.0,
      durability: 60, attackPower: 50, knockbackPower: 30,
      color: '#88EE88', icon: '🪃',
    },
    weapon: {
      name: 'Boomerang',
      category: 'projectile', damage: 50, knockback: 30,
      range: 6.0, speed: 8.0, cooldown: 2.0,
      trigger: 'onTimer',
      description: 'Throws and returns; can hit twice.',
      color: '#AACC44',
    },
  },

  // ── 9. Shockwave → Berserker body ────────────────────────────────────────
  {
    id: 'shockmaster',
    name: 'Shockmaster',
    lore: 'When cornered, it explodes in a burst of pure fury.',
    icon: '💥',
    ball: {
      name: 'Berserker',
      radius: BALL_RADIUS, mass: 3.5, maxSpeed: BALL_SPEED,
      friction: 0.20, restitution: 0.4, spinSpeed: 2.8,
      durability: 120, attackPower: 65, knockbackPower: 70,
      color: '#FF6644', icon: '💥',
    },
    weapon: {
      name: 'Shockwave',
      category: 'aoe', damage: 30, knockback: 100,
      range: 3.0, speed: 0, cooldown: 5.0,
      trigger: 'onLowHP',
      description: 'When HP < 30%, emits a radial blast.',
      color: '#FF44FF',
    },
  },

  // ── 10. Magnet Beam → Magnet Core body ───────────────────────────────────
  {
    id: 'magnet-lord',
    name: 'Magnet Lord',
    lore: 'Draws the enemy close, then dominates them.',
    icon: '🔵',
    ball: {
      name: 'Magnet Core',
      radius: BALL_RADIUS, mass: 2.8, maxSpeed: BALL_SPEED,
      friction: 0.10, restitution: 0.4, spinSpeed: 2.0,
      durability: 90, attackPower: 55, knockbackPower: 80,
      color: '#44DDCC', icon: '🔵',
    },
    weapon: {
      name: 'Magnet Beam',
      category: 'utility', damage: 0, knockback: 0,
      range: 5.0, speed: 0, cooldown: 1.0,
      trigger: 'onCollision',
      description: 'Pulls the opponent closer on hit (no damage).',
      color: '#44FFAA',
    },
  },

  // ── 11. Repulsor → Balanced Duo body ─────────────────────────────────────
  {
    id: 'force-field',
    name: 'Force Field',
    lore: 'Uses shock-push to control the battlefield.',
    icon: '⚖️',
    ball: {
      name: 'Balanced Duo',
      radius: BALL_RADIUS, mass: 3.0, maxSpeed: BALL_SPEED,
      friction: 0.15, restitution: 0.4, spinSpeed: 2.5,
      durability: 100, attackPower: 60, knockbackPower: 60,
      color: '#8888EE', icon: '⚖️',
    },
    weapon: {
      name: 'Repulsor',
      category: 'utility', damage: 20, knockback: 120,
      range: 3.0, speed: 0, cooldown: 4.0,
      trigger: 'onCollision',
      description: 'Shock-push on impact: strong outward force.',
      color: '#FFFF44',
    },
  },

  // ── 12. Grenade Bomb → Glass Cannon body ─────────────────────────────────
  {
    id: 'bomb-expert',
    name: 'Bomb Expert',
    lore: 'Dies in one hit, but takes you with it.',
    icon: '🧨',
    ball: {
      name: 'Glass Cannon',
      radius: BALL_RADIUS, mass: 1.0, maxSpeed: BALL_SPEED,
      friction: 0.05, restitution: 0.6, spinSpeed: 5.0,
      durability: 30, attackPower: 100, knockbackPower: 20,
      color: '#AAFFAA', icon: '🧨',
    },
    weapon: {
      name: 'Grenade Bomb',
      category: 'projectile', damage: 100, knockback: 100,
      range: 5.0, speed: 6.0, cooldown: 4.0,
      trigger: 'onTimer',
      description: 'Lobs a bomb that explodes on contact or after 2s.',
      color: '#44AA44',
    },
  },
];
