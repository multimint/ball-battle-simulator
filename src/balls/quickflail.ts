import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS } from './constants';
import type { StatusEffect, StatusRow } from '../models/types';

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
    radius: BALL_RADIUS,
    mass: 2.8,
    maxSpeed: 5.5,
    friction: 0.1,
    restitution: 0.5,
    spinSpeed: 4.5,
    durability: 60,
    color: '#44CC22',
    icon: 'lightning',
    ability: {
      id: 'quickstrike-momentum',
      name: 'Momentum',
      description:
        'Each landed hit stacks +30% speed and +20% blade length (up to 6×) — stacks persist as long as you keep landing hits.',
      trigger: 'onHitDealt',
      params: {
        statusEffect: 'speedBoost',
        statusTarget: 'self',
        statusDuration: 999999999,
        statusMagnitude: 0.3,
        stackBehavior: 'stack',
        maxStacks: 6,
        statusIcon: 'lightning',
        rangePerStack: 0.2,
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
        hudLabel: 'momentum',
      },
      getHudRows(effects: StatusEffect[]): StatusRow[] {
        const stacks = effects.find(e => e.type === 'speedBoost')?.stacks ?? 0;
        const mult = 1 + stacks * 0.3;
        return [{ label: 'momentum', value: `×${mult.toFixed(1)}` }];
      },
    },
  },
  weapon: {
    name: 'Long Sword',
    range: 1.5,
    speed: 6.75,
    trigger: 'onCollision',
    hitReachMult: 1.8,
    description:
      'Long blade that orbits fast — land enough hits and momentum takes over.',
    color: '#33BB55',
    icon: 'weapon-long-sword',
    effectLabel: 'spear',
    attacks: [{ type: 'melee', cooldown: 0.7, damage: 4, knockback: 40 }],
    drawShape: (ctx, color, r) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.strokeStyle = '#7A5C2E';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, 0);
      ctx.lineTo(r * 0.05, 0);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r * 0.05, -r * 0.55);
      ctx.lineTo(r * 0.05, r * 0.55);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(r * 0.05, r * 0.14);
      ctx.lineTo(r * 0.05, -r * 0.14);
      ctx.lineTo(r * 1.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF55';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
  },
  audioProfile: {
    hitStyle: 'swift',
    abilityStyle: 'frenzy',
  } satisfies AudioProfile,
};
