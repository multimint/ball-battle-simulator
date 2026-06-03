import type { StatusEffectType } from '../../models/types';
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

export const STATUS_HANDLERS: Record<StatusEffectType, StatusEffectHandler> = {
  burn:       burnHandler,
  poison:     poisonHandler,
  freeze:     freezeHandler,
  rage:       rageHandler,
  harden:     hardenHandler,
  speedBoost: speedBoostHandler,
  weaken:     weakenHandler,
  lifesteal:  lifestealHandler,  // consumed in HitProcessor damage() closure
  shield:     shieldHandler,     // consumed in StatusEffectManager.consumeShield()
  forgeHeat:  forgeHeatHandler,  // stacking outgoing damage for Ironwright
};
