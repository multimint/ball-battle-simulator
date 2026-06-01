import type { StatusEffectHandler } from './types';

export const weakenHandler: StatusEffectHandler = {
  outDmgMult(effect) {
    return 1 - effect.magnitude;
  },
};
