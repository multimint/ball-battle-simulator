import type { StatusEffectHandler } from './types';

export const freezeHandler: StatusEffectHandler = {
  speedMult(effect) {
    return 1 - effect.magnitude * effect.stacks;
  },
};
