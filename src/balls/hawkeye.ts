import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS } from './constants';

const painter: SpritePainter = (ctx) => {
  ctx.strokeStyle = '#00BFA5';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(12, 12, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, 1);   ctx.lineTo(12, 6);   ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, 18);  ctx.lineTo(12, 23);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, 12);   ctx.lineTo(6, 12);   ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18, 12);  ctx.lineTo(23, 12);  ctx.stroke();
  ctx.fillStyle = '#00BFA5';
  ctx.beginPath(); ctx.arc(12, 12, 2, 0, Math.PI * 2); ctx.fill();
};

export const hawkeye: BallDefinition = {
  id: 'hawkeye',
  name: 'Hawkeye',
  lore: 'A precision strike unit built for calculated repositioning and surgical laser fire.',
  painter,
  ball: {
    name: 'Marksman',
    radius: BALL_RADIUS, mass: 3.0, maxSpeed: 5.0,
    friction: 0.12, restitution: 0.45, spinSpeed: 3.5,
    durability: 60, attackPower: 11, knockbackPower: 50,
    color: '#4488CC', icon: 'crosshair',
  },
  weapon: {
    name: 'Energy Laser',
    range: 10.0, speed: 4.0, trigger: 'onTimer',
    description: 'Fires 3-way split bullets every 1.5s; charges a full-power laser beam every 10s.',
    color: '#4488CC',
    hitEffect: 'laser',
    attacks: [
      { type: 'projectile', cooldown: 3,    damage: 3,  knockback: 20, aimAtEnemy: true, bulletCount: 3, bulletSpeed: 1.0 },
      { type: 'projectile', cooldown: 10.0, damage: 15, knockback: 65, aimAtEnemy: true, hitscan: true, audioHint: 'laser' },
    ],
  },
  audioProfile: { hitStyle: 'arcane', abilityStyle: 'sharp' } satisfies AudioProfile,
};
