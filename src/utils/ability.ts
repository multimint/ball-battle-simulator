import type { BallAbility } from '../models/types';

export function getAbilityThreshold(ability: BallAbility | undefined): number {
  return Number(ability?.params?.threshold ?? 0.3);
}

export function isAbilityBerserk(ability: BallAbility | undefined, hpFrac: number): boolean {
  if (!ability || ability.trigger !== 'onLowHP') return false;
  return hpFrac < getAbilityThreshold(ability);
}
