import type { BallDefinition } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS, BALL_SPEED } from './constants';

const painter: SpritePainter = (ctx) => {
  ctx.fillStyle = '#FF6B35';
  ctx.beginPath();
  ctx.moveTo(12, 22);
  ctx.bezierCurveTo(6, 22, 3, 17, 3, 13);
  ctx.bezierCurveTo(3, 9, 7, 7, 8, 4);
  ctx.bezierCurveTo(9, 2, 12, 2, 12, 2);
  ctx.bezierCurveTo(12, 2, 15, 2, 16, 4);
  ctx.bezierCurveTo(17, 7, 21, 9, 21, 13);
  ctx.bezierCurveTo(21, 17, 18, 22, 12, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFD166';
  ctx.beginPath();
  ctx.moveTo(12, 19);
  ctx.bezierCurveTo(9.5, 19, 8.5, 17, 8.5, 15);
  ctx.bezierCurveTo(8.5, 13, 10, 12, 10, 10);
  ctx.bezierCurveTo(10, 9, 12, 9, 12, 9);
  ctx.bezierCurveTo(12, 9, 14, 9, 14, 10);
  ctx.bezierCurveTo(14, 12, 15.5, 13, 15.5, 15);
  ctx.bezierCurveTo(15.5, 17, 14.5, 19, 12, 19);
  ctx.closePath();
  ctx.fill();
};

export const bloodAxe: BallDefinition = {
  id: 'blood-axe',
  name: 'Blood Axe',
  lore: 'The more it bleeds, the harder it hits.',
  painter,
  ball: {
    name: 'Bloodrage',
    radius: BALL_RADIUS, mass: 3.0, maxSpeed: BALL_SPEED,
    friction: 0.15, restitution: 0.4, spinSpeed: 2.5,
    durability: 70, attackPower: 13, knockbackPower: 60,
    color: '#CC2200', icon: 'flame',
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
        statusIcon: 'burst',
        secondStatusEffect: 'speedBoost',
        secondStatusDuration: 3000,
        secondStatusMagnitude: 0.7,
        secondStatusBehavior: 'refresh',
        secondStatusMaxStacks: 1,
        secondStatusColor: '#FF8800',
        secondStatusIcon: 'lightning',
        hitFlash: true,
        hitFlashColor: '#CC0000',
        hitFlashTarget: 'self',
        trailOnTrigger: true,
        trailColor: '#FF2200',
        trailRadiusFrac: 0.8,
        trailAlpha: 0.55,
        trailTtl: 12,
        trailSpawnChance: 0.7,
        hudLabel: 'berserk',
      },
    },
  },
  weapon: {
    name: 'War Axe',
    range: 1.0, speed: 4.0, trigger: 'onCollision',
    description: 'Slow, devastating swing. Each hit lands with crushing force.',
    color: '#884400',
    attacks: [{ type: 'melee', cooldown: 0.8, damage: 9, knockback: 55 }],
  },
};
