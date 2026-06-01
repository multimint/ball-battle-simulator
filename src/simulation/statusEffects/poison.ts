import type { StatusEffectHandler } from './types';

export const poisonHandler: StatusEffectHandler = {
  tick(effect, hp, team, delta) {
    hp[team] = Math.max(0, hp[team] - (effect.magnitude / 1000) * delta);
  },
};
