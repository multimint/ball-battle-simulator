import type { StatusEffectHandler } from './types';

export const burnHandler: StatusEffectHandler = {
  tick(effect, hp, team, delta) {
    hp[team] = Math.max(0, hp[team] - (effect.magnitude * effect.stacks / 1000) * delta);
  },
};
