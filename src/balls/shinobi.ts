import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS, BALL_SPEED } from './constants';
import type { StatusEffect, StatusRow } from '../models/types';

const painter: SpritePainter = (ctx) => {
  // Near-black face — deep shadow base
  ctx.fillStyle = '#080818';
  ctx.beginPath();
  ctx.arc(12, 12, 10, 0, Math.PI * 2);
  ctx.fill();

  // Bright indigo headband — color identity stripe
  ctx.fillStyle = '#3D5AFE';
  ctx.fillRect(5, 8, 14, 3);

  // Dark mask cloth — clearly distinct from the base
  ctx.fillStyle = '#12103C';
  ctx.fillRect(2, 11, 20, 5);

  // Crimson slit eyes — maximum contrast on dark mask
  ctx.fillStyle = '#FF1744';
  ctx.fillRect(4, 12, 5, 2);
  ctx.fillRect(15, 12, 5, 2);

  // White highlight glint in each eye
  ctx.fillStyle = '#FFCDD2';
  ctx.fillRect(4, 12, 2, 1);
  ctx.fillRect(15, 12, 2, 1);

  // White crescent moon — sharp bright accent
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(12, 5, 3, Math.PI * 0.8, Math.PI * 0.2, true);
  ctx.stroke();
};

export const shinobi: BallDefinition = {
  id: 'shinobi',
  name: 'Shinobi',
  lore: 'A shadow assassin who strikes from the dark and vanishes before retaliation.',

  painter,

  ball: {
    name: 'Shadow Body',
    radius: BALL_RADIUS,
    mass: 3.0,
    maxSpeed: BALL_SPEED * 1.22, // 6.7 — swift
    friction: 0.12,
    restitution: 0.45,
    spinSpeed: 3.5,
    durability: 60,
    color: '#1A237E',
    icon: 'shinobi-icon',

    ability: {
      id: 'shadowstep',
      name: 'Shadowstep',
      description:
        'Every 7.5 s: stops time, dashes through the enemy dealing 10 damage, and leaves two slash marks.',
      trigger: 'onTimer',
      params: {
        intervalMs: 7500,
        // Bright white flash to punctuate the start of time stop
        hitScreenFlash: true,
        hitScreenFlashColor: '#FFFFFF',
        hitScreenFlashAlpha: 0.55,
        hitScreenFlashTtl: 6,
        // Dash-through config
        dashThroughEnemy: true,
        dashDamage: 10,
        dashColor: '#3F51B5',
        dashSlashColor: '#90CAF9',
        dashSecondarySlashColor: '#5C6BC0',
        dashAbilityHitStyle: 'shadowslash',
        dashStartHold: 6,
        dashMoveFrames: 12,
        dashTotalFrames: 60,
        dashFreezeColor: '#080820',
        dashFreezeAlpha: 0.72,
        // Trail burst at vanish point (executeDashThrough also adds path-trail)
        trailOnTrigger: true,
        trailColor: '#3F51B5',
        trailRadiusFrac: 0.5,
        trailAlpha: 0.8,
        trailTtl: 20,
        trailCount: 10,
        hudLabel: 'shadowstep',
      },

      getHudRows(
        _effects: StatusEffect[],
        _hpFrac: number,
        timerFrac = 0,
      ): StatusRow[] {
        const pct = Math.round(timerFrac * 100);
        return [
          { label: 'shadowstep', value: pct >= 100 ? 'READY' : `${pct}%` },
        ];
      },
    },
  },

  weapon: {
    name: 'Shadow Arms',
    range: 1.6,
    speed: 3.5,
    trigger: 'onTimer',
    description:
      'Bouncing shurikens that ricochet 5 times + a close-range katana slash.',
    color: '#5C6BC0',
    icon: 'weapon-shuriken',
    projectileIcon: 'proj-shuriken',
    projectileOrbitFixed: true,
    effectLabel: 'sword',
    attacks: [
      {
        // Orbit-direction shuriken — fires in weapon spin direction, bounces off walls
        type: 'projectile',
        cooldown: 2,
        damage: 1,
        knockback: 15,
        bulletCount: 1,
        bulletSpeed: 1.5,
        maxBounces: 10,
        expireBurstCount: 14,
        bulletTtl: 10000,
      },
      {
        // Katana slash — orbit melee when in proximity
        type: 'melee',
        cooldown: 1.5,
        damage: 5,
        knockback: 38,
      },
    ],
  },

  audioProfile: {
    hitStyle: 'swift',
    abilityStyle: 'shadowslash',
  } satisfies AudioProfile,
};
