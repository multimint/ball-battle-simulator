import type { BallAbility } from '../models/types';

export function isAbilityBerserk(ability: BallAbility | undefined, hpFrac: number): boolean {
  if (!ability || ability.trigger !== 'onLowHP') return false;
  return hpFrac < ability.params.threshold;
}
