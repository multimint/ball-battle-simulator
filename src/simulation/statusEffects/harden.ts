import type { StatusEffectHandler } from './types';

export const hardenHandler: StatusEffectHandler = {
  inDmgMult(effect) {
    return 1 - effect.magnitude;
  },
};
