import type { StatusEffectHandler } from './types';

export const speedBoostHandler: StatusEffectHandler = {
  speedMult(effect) {
    const bonus = effect.magnitude * effect.stacks + (effect.stacks > 3 ? effect.magnitude * (effect.stacks - 3) : 0);
    return 1 + bonus;
  },
};
