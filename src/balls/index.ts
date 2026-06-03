import type { SpritePainter } from '../sprites/spriteDefinitions';
import { quickFlail } from './quickflail';
import { hawkeye } from './hawkeye';
import { bloodAxe } from './bloodaxe';
import { revenant } from './revenant';
import { ironwright } from './ironwright';
import { shinobi } from './shinobi';

export type { BallDefinition } from './types';

/**
 * All registered balls. To add a new ball: import its module and append it here.
 * Order determines the display order in the fighter selector.
 */
export const BALL_DEFINITIONS = [quickFlail, hawkeye, bloodAxe, revenant, ironwright, shinobi] as const;

// Guard against accidental duplicate IDs at startup.
const ids = BALL_DEFINITIONS.map((b) => b.id);
if (new Set(ids).size !== ids.length) {
  throw new Error(`Duplicate ball IDs detected: ${ids.join(', ')}`);
}

/** Sprite painters keyed by ball icon id — merged into SPRITE_PAINTERS by spriteDefinitions.ts. */
export const BALL_SPRITE_PAINTERS = {
  lightning:          quickFlail.painter,
  crosshair:          hawkeye.painter,
  flame:              bloodAxe.painter,
  specter:            revenant.painter,
  'ironwright-anvil': ironwright.painter,
  'shinobi-icon':     shinobi.painter,
} satisfies Record<string, SpritePainter>;

/** Flat fighter preset objects derived from ball definitions — used by UI and store. */
export const FIGHTER_PRESETS = BALL_DEFINITIONS.map((b) => ({
  id:           b.id,
  name:         b.name,
  lore:         b.lore,
  icon:         b.ball.icon,
  ball:         b.ball,
  weapon:       b.weapon,
  audioProfile: b.audioProfile,
}));
