import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS } from './constants';

const painter: SpritePainter = (ctx) => {
  ctx.fillStyle = '#F7C430';
  ctx.beginPath();
  ctx.moveTo(17, 1);
  ctx.lineTo(6, 13);
  ctx.lineTo(12, 13);
  ctx.lineTo(6, 23);
  ctx.lineTo(20, 11);
  ctx.lineTo(14, 11);
  ctx.closePath();
  ctx.fill();
};

export const quickFlail: BallDefinition = {
  id: 'quick-flail',
  name: 'Quick Flail',
  lore: 'Lands dozens of rapid blows — each hit feeds its momentum, turning speed into unstoppable fury.',
  painter,
  ball: {
    name: 'Quickstrike',
    radius: BALL_RADIUS, mass: 2.8, maxSpeed: 5.5,
    friction: 0.1, restitution: 0.5, spinSpeed: 4.5,
    durability: 50, attackPower: 2, knockbackPower: 35,
    color: '#44CC22', icon: 'lightning',
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
        statusIcon: 'lightning',
        hitFlash: true,
        hitFlashColor: '#44FF22',
        hitFlashTarget: 'self',
        trailOnTrigger: true,
        trailColor: '#44FF44',
        trailRadiusFrac: 0.6,
        trailAlpha: 0.6,
        trailTtl: 10,
        trailCount: 3,
        trailScatterFrac: 0.5,
        tickTrailEnabled: true,
        tickTrailConditionEffect: 'speedBoost',
        tickTrailConditionMinStacks: 2,
        tickTrailSpawnChance: 0.75,
        tickTrailAtWeapon: true,
        tickTrailColor: '#44FF44',
        tickTrailRadiusFrac: 0.45,
        tickTrailAlpha: 0.55,
        tickTrailTtl: 8,
        hudLabel: 'faster',
      },
    },
  },
  weapon: {
    name: 'Long Sword',
    range: 1.5, speed: 6.75, trigger: 'onCollision',
    description: 'Long blade that orbits fast — land enough hits and momentum takes over.',
    color: '#33BB55',
    effectLabel: 'spear',
    attacks: [{ type: 'melee', cooldown: 0.7, damage: 10, knockback: 40 }],
  },
  audioProfile: { hitStyle: 'swift', abilityStyle: 'frenzy' } satisfies AudioProfile,
};
