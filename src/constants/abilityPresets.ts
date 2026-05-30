import type { BallAbility } from '../models/types';

export const ABILITY_PRESETS: Record<string, BallAbility> = {
  'quickstrike-momentum': {
    id: 'quickstrike-momentum',
    name: 'Momentum',
    description: 'Each landed hit boosts speed by 50% for 0.8s — keep hitting to maintain the rush.',
    trigger: 'onHitDealt',
    params: {
      // Primary status
      statusEffect: 'speedBoost',
      statusTarget: 'self',
      statusDuration: 999999999,
      statusMagnitude: 0.3,
      stackBehavior: 'stack',
      maxStacks: 5,
      statusColor: '#44FF44',
      statusIcon: '⚡',
      // Screen flash on hit
      hitFlash: true,
      hitFlashColor: '#44FF22',
      hitFlashTarget: 'self',
      // Trail burst spawned at ball position on each hit
      trailOnTrigger: true,
      trailColor: '#44FF44',
      trailRadiusFrac: 0.6,
      trailAlpha: 0.6,
      trailTtl: 10,
      trailCount: 3,
      trailScatterFrac: 0.5,
      // Tick-driven orbit trail when speedBoost stacks >= 2
      tickTrailEnabled: true,
      tickTrailConditionEffect: 'speedBoost',
      tickTrailConditionMinStacks: 2,
      tickTrailSpawnChance: 0.75,
      tickTrailAtWeapon: true,
      tickTrailColor: '#44FF44',
      tickTrailRadiusFrac: 0.45,
      tickTrailAlpha: 0.55,
      tickTrailTtl: 8,
      // HUD display
      hudLabel: 'faster',
    },
  },

  'bloodrage-fury': {
    id: 'bloodrage-fury',
    name: 'Bloodrage',
    description: 'Goes berserk below 30% HP — +50% damage and +40% speed.',
    trigger: 'onLowHP',
    params: {
      threshold: 0.3,
      // Primary status: rage (damage boost)
      statusEffect: 'rage',
      statusTarget: 'self',
      statusDuration: 3000,
      statusMagnitude: 0.5,
      stackBehavior: 'refresh',
      maxStacks: 1,
      statusColor: '#FF4400',
      statusIcon: '💢',
      // Second status: speedBoost alongside rage
      secondStatusEffect: 'speedBoost',
      secondStatusDuration: 3000,
      secondStatusMagnitude: 0.7,
      secondStatusBehavior: 'refresh',
      secondStatusMaxStacks: 1,
      secondStatusColor: '#FF8800',
      secondStatusIcon: '⚡',
      // Screen flash
      hitFlash: true,
      hitFlashColor: '#CC0000',
      hitFlashTarget: 'self',
      // Trail emitted every frame while below threshold
      trailOnTrigger: true,
      trailColor: '#FF2200',
      trailRadiusFrac: 0.8,
      trailAlpha: 0.55,
      trailTtl: 12,
      trailSpawnChance: 0.7,
      // HUD display
      hudLabel: 'berserk',
    },
  },
};
