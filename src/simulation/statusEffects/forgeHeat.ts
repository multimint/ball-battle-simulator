import type { StatusEffectHandler } from './types';

export const forgeHeatHandler: StatusEffectHandler = {
  outDmgMult(effect) {
    return 1 + effect.magnitude * effect.stacks;
  },
};
