import type { BallAbility } from '../models/types';

export const ABILITY_PRESETS: Record<string, BallAbility> = {
  'quickstrike-momentum': {
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
      statusIcon: '⚡',
      hitFlash: true,
      hitFlashColor: '#44FF22',
      hitFlashTarget: 'self',
    },
  },

  'bloodrage-fury': {
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
      statusIcon: '💢',
      speedBoostDuration: 3000,
      speedBoostMagnitude: 0.7,
      speedBoostColor: '#FF8800',
      speedBoostIcon: '⚡',
      hitFlash: true,
      hitFlashColor: '#CC0000',
      hitFlashTarget: 'self',
    },
  },
};
