import type { AttackConfig } from '../../models/types';
import type { AttackHandler } from './types';
import { meleeHandler }      from './melee';
import { shieldHandler }     from './shield';
import { projectileHandler } from './projectile';
import { aoeHandler }        from './aoe';
import { utilityHandler }    from './utility';
import { summonHandler }     from './summon';

export type { AttackHandler, AttackHandlerCtx } from './types';

export const ATTACK_HANDLERS: Record<AttackConfig['type'], AttackHandler> = {
  melee:      meleeHandler,
  shield:     shieldHandler,
  projectile: projectileHandler,
  aoe:        aoeHandler,
  utility:    utilityHandler,
  summon:     summonHandler,
};
