import type { StatusEffectHandler } from './types';
import { burnHandler }       from './burn';
import { poisonHandler }     from './poison';
import { freezeHandler }     from './freeze';
import { rageHandler }       from './rage';
import { hardenHandler }     from './harden';
import { speedBoostHandler } from './speedBoost';
import { weakenHandler }     from './weaken';
import { lifestealHandler }  from './lifesteal';
import { shieldHandler }     from './shield';
import { forgeHeatHandler }  from './forgeHeat';

export type { StatusEffectHandler } from './types';

/**
 * Open runtime registry. New balls add a custom effect without editing this file:
 *   import { registerStatusEffect } from '../simulation/statusEffects';
 *   registerStatusEffect('myEffect', { speedMult: (e) => 1 - e.magnitude });
 */
export const STATUS_HANDLERS: Record<string, StatusEffectHandler> = {
  burn:       burnHandler,
  poison:     poisonHandler,
  freeze:     freezeHandler,
  rage:       rageHandler,
  harden:     hardenHandler,
  speedBoost: speedBoostHandler,
  weaken:     weakenHandler,
  lifesteal:  lifestealHandler,
  shield:     shieldHandler,
  forgeHeat:  forgeHeatHandler,
};

export function registerStatusEffect(key: string, handler: StatusEffectHandler): void {
  STATUS_HANDLERS[key] = handler;
}
