import type { WeaponStats } from '../models/types';

export const WEAPON_PRESETS: WeaponStats[] = [
  {
    name: 'Heavy Hammer',
    range: 1.0, speed: 3.0, trigger: 'onCollision',
    description: 'Slow swing; very high knockback on collision.',
    color: '#CC6633', icon: 'weapon-heavy-hammer',
    kbMult: 1.6, dmgMult: 1.2, effectLabel: 'hammer',
    attacks: [{ type: 'melee', cooldown: 2.0, damage: 16, knockback: 100 }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.rect(r * 0.2, -r * 0.75, r * 0.8, r * 1.5);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r * 0.2, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
  },
  {
    name: 'Swift Sword',
    range: 1.0, speed: 6.0, trigger: 'onSpeed',
    description: 'Fast slash at top speed; moderate knockback.',
    color: '#66AAFF', icon: 'weapon-swift-sword',
    attacks: [{ type: 'melee', cooldown: 1.0, damage: 10, knockback: 40 }],
  },
  {
    name: 'Long Spear',
    range: 2.0, speed: 4.0, trigger: 'onCollision',
    description: 'Stab with extended reach.',
    color: '#996633', icon: 'weapon-long-spear',
    kbMult: 0.9, effectLabel: 'spear',
    attacks: [{ type: 'melee', cooldown: 1.5, damage: 12, knockback: 30 }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, 0);
      ctx.lineTo(r * 0.7, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -r * 0.5);
      ctx.lineTo(r * 1.4, 0);
      ctx.lineTo(r * 0.7, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  },
  {
    name: 'Chain Flail',
    range: 2.0, speed: 5.0, trigger: 'onTimer',
    description: 'Spins unpredictably; spawns orbital hitbox every 0.5s.',
    color: '#888888', icon: 'weapon-chain-flail',
    kbMult: 0.7, dmgMult: 0.8, effectLabel: 'flail',
    attacks: [{ type: 'melee', cooldown: 0.5, damage: 8, knockback: 40 }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
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
      ctx.shadowBlur = 0;
    },
  },
  {
    name: 'Defender Shield',
    range: 1.0, speed: 0, trigger: 'onCollision',
    description: 'No damage, but reflects enemy hit with 2× knockback.',
    color: '#AAAAFF', icon: 'weapon-defender-shield',
    attacks: [{ type: 'shield', cooldown: 0, damage: 0, knockback: 100 }],
  },
  {
    name: 'Energy Laser',
    range: 10.0, speed: 10.0, trigger: 'onTimer',
    description: 'Fires a fast beam toward the opponent every 3s.',
    color: '#FF4444', icon: 'weapon-energy-laser', projectileIcon: 'proj-orb',
    hitEffect: 'laser',
    attacks: [{ type: 'projectile', cooldown: 3.0, damage: 12, knockback: 50, aimAtEnemy: true }],
  },
  {
    name: 'Power Cannon',
    range: 8.0, speed: 5.0, trigger: 'onTimer',
    description: 'Launches a heavy orb; high damage and knockback.',
    color: '#FF8833', icon: 'weapon-power-cannon', projectileIcon: 'proj-orb',
    kbMult: 1.5, dmgMult: 1.1,
    attacks: [{ type: 'projectile', cooldown: 3.0, damage: 16, knockback: 80, aimAtEnemy: true }],
  },
  {
    name: 'Boomerang',
    range: 6.0, speed: 8.0, trigger: 'onTimer',
    description: 'Throws and returns; can hit twice.',
    color: '#AACC44', icon: 'weapon-boomerang', projectileIcon: 'proj-boomerang',
    attacks: [{ type: 'projectile', cooldown: 2.0, damage: 10, knockback: 30, aimAtEnemy: true }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI * 0.8, Math.PI * 0.8);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, -Math.PI * 0.8, Math.PI * 0.8);
      ctx.strokeStyle = color + '88';
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
  },
  {
    name: 'Shockwave',
    range: 3.0, speed: 0, trigger: 'onLowHP',
    description: 'When HP < 30%, emits a radial blast.',
    color: '#FF44FF', icon: 'weapon-shockwave',
    attacks: [{ type: 'aoe', cooldown: 5.0, damage: 6, knockback: 100 }],
  },
  {
    name: 'Magnet Beam',
    range: 5.0, speed: 0, trigger: 'onCollision',
    description: 'Pulls the opponent closer on hit (no damage).',
    color: '#44FFAA', icon: 'weapon-magnet-beam',
    utilityBehavior: 'pull',
    attacks: [{ type: 'utility', cooldown: 1.0, damage: 0, knockback: 0 }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.8);
      ctx.lineTo(r * 0.7, -r * 0.8);
      ctx.arc(r * 0.7, 0, r * 0.8, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-r * 0.4, r * 0.8);
      ctx.stroke();
      ctx.fillStyle = '#FF4444';
      ctx.beginPath();
      ctx.arc(-r * 0.4, -r * 0.8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4444FF';
      ctx.beginPath();
      ctx.arc(-r * 0.4, r * 0.8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  },
  {
    name: 'Repulsor',
    range: 3.0, speed: 0, trigger: 'onCollision',
    description: 'Shock-push on impact: strong outward force.',
    color: '#FFFF44', icon: 'weapon-repulsor',
    utilityBehavior: 'push-both', selfKnockbackFrac: 0.4,
    attacks: [{ type: 'utility', cooldown: 4.0, damage: 4, knockback: 120 }],
  },
  {
    name: 'Grenade Bomb',
    range: 5.0, speed: 6.0, trigger: 'onTimer',
    description: 'Lobs a bomb that explodes on contact or after 2s.',
    color: '#44AA44', icon: 'weapon-grenade-bomb', projectileIcon: 'proj-bomb',
    kbMult: 1.2, dmgMult: 1.3, hitEffect: 'explosion', hitEffectRadius: 70,
    attacks: [{ type: 'projectile', cooldown: 4.0, damage: 20, knockback: 100, aimAtEnemy: true }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFAA22';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.75);
      ctx.quadraticCurveTo(r * 0.4, -r * 1.1, r * 0.2, -r * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#FFEE44';
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 1.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  },
];
