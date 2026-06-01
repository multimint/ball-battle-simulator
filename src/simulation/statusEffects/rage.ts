import type { StatusEffectHandler } from './types';

export const rageHandler: StatusEffectHandler = {
  outDmgMult(effect) {
    return 1 + effect.magnitude;
  },
};
