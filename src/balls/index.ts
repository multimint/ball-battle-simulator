import type { SpritePainter } from '../sprites/spriteDefinitions';
import { quickFlail } from './quickflail';
import { hawkeye } from './hawkeye';
import { bloodAxe } from './bloodaxe';

export type { BallDefinition } from './types';

/**
 * All registered balls. Add a new entry here after creating its module.
 * Order determines the display order in the fighter selector.
 */
export const BALL_DEFINITIONS = [quickFlail, hawkeye, bloodAxe] as const;

/** Sprite painters keyed by ball icon id — merged into SPRITE_PAINTERS by spriteDefinitions.ts. */
export const BALL_SPRITE_PAINTERS = {
  lightning: quickFlail.painter,
  crosshair: hawkeye.painter,
  flame:     bloodAxe.painter,
} satisfies Record<string, SpritePainter>;

/** Drop-in replacement for the old FIGHTER_PRESETS array. */
export const FIGHTER_PRESETS = BALL_DEFINITIONS.map((b) => ({
  id:     b.id,
  name:   b.name,
  lore:   b.lore,
  icon:   b.ball.icon!,
  ball:   b.ball,
  weapon: b.weapon,
}));
