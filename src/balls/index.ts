import type { SpritePainter } from '../sprites/spriteDefinitions';
import { quickFlail } from './quickflail';
import { hawkeye } from './hawkeye';
import { bloodAxe } from './bloodaxe';

export type { BallDefinition } from './types';

/**
 * All registered balls. To add a new ball: import its module and append it here.
 * Order determines the display order in the fighter selector.
 */
export const BALL_DEFINITIONS = [quickFlail, hawkeye, bloodAxe] as const;

// Guard against accidental duplicate IDs at startup.
const ids = BALL_DEFINITIONS.map((b) => b.id);
if (new Set(ids).size !== ids.length) {
  throw new Error(`Duplicate ball IDs detected: ${ids.join(', ')}`);
}

/** Ball sprite painters auto-derived from BALL_DEFINITIONS — never edit manually. */
export const BALL_SPRITE_PAINTERS: Record<string, SpritePainter> = Object.fromEntries(
  BALL_DEFINITIONS.map((b): [string, SpritePainter] => [b.ball.icon, b.painter])
);

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
