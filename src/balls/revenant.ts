import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS, BALL_SPEED } from './constants';
import type { StatusEffect, StatusRow } from '../models/types';

// ── Ball icon: spectral skull with green wisp eye ─────────────────────────────
const painter: SpritePainter = (ctx) => {
  // Outer violet glow
  ctx.fillStyle = '#7B3FAA';
  ctx.beginPath();
  ctx.arc(12, 12, 10, 0, Math.PI * 2);
  ctx.fill();
  // Dark void core
  ctx.fillStyle = '#2A0A40';
  ctx.beginPath();
  ctx.arc(12, 12, 7.5, 0, Math.PI * 2);
  ctx.fill();
  // Green wisp eye
  ctx.fillStyle = '#3FB68B';
  ctx.beginPath();
  ctx.arc(12, 11, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Bright pupil
  ctx.fillStyle = '#AAFFCC';
  ctx.beginPath();
  ctx.arc(12, 10.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Small orbiting wisp dot (decorative)
  ctx.fillStyle = '#3FB68B';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(18, 8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

export const revenant: BallDefinition = {
  id: 'revenant',
  name: 'Revenant',
  lore: 'It does not fight. It summons what fights for it.',
  painter,

  ball: {
    name: 'Spectral Form',
    radius: BALL_RADIUS,
    mass: 3.0,
    maxSpeed: BALL_SPEED * 1.5,
    friction: 0.13,
    restitution: 0.45,
    spinSpeed: 2.5,
    durability: 66,
    color: '#5B2A86',
    icon: 'specter',

    ability: {
      id: 'soul-surge',
      name: 'Soul Surge',
      description:
        'Every 16 s, all alive Wisps enter Banshee state — hurling toward the enemy in a lethal burst. A Banshee that reaches the enemy deals up to 10 damage on contact; anything else shatters it.',
      trigger: 'onTimer',
      params: {
        intervalMs: 16_000,
        trailOnTrigger: true,
        trailColor: '#D4FF88',
        trailRadiusFrac: 0.6,
        trailAlpha: 0.55,
        trailTtl: 10,
        trailCount: 3,
        hitFlash: true,
        hitFlashColor: '#AAFFAA',
        hitFlashTarget: 'self',
        hudLabel: 'soul surge',
      },
      getHudRows(
        _effects: StatusEffect[],
        _hpFrac: number,
        timerFrac = 0,
      ): StatusRow[] {
        const pct = Math.round(timerFrac * 100);
        return [
          { label: 'soul surge', value: pct >= 100 ? 'READY' : `${pct}%` },
        ];
      },
    },
  },

  weapon: {
    name: 'Spirit Staff',
    range: 1.8,
    speed: 8.0,
    trigger: 'onCollision',
    description:
      'Conjures a Wisp drone every 2.5 s. On proximity, the staff tip blasts the enemy away with arcane force — no damage, pure repulsion.',
    color: '#9B70D0',
    icon: 'weapon-spirit-staff',
    attacks: [
      {
        type: 'summon',
        cooldown: 2.5,
        damage: 0,
        knockback: 0,
        summonHp: 12,
        summonRadius: 18,
        summonSpeed: 25,
        summonMaxCount: 3,
        summonMass: 1,
        summonNormalColor: '#3FB68B',
        summonContactDamage: 4,
        summonContactCooldownMs: 600,
        summonChargedColor: '#D4FF88',
        summonChargedDamage: 10,
      },
      {
        type: 'melee',
        cooldown: 0.8,
        damage: 0,
        knockback: 1000,
      },
    ],
  },

  audioProfile: {
    hitStyle: 'arcane',
    abilityStyle: 'frenzy',
  } satisfies AudioProfile,
};
