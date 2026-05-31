import type { SPRITE_PAINTERS } from './spriteDefinitions';

/**
 * Automatically derived from the keys of SPRITE_PAINTERS.
 * To add a new sprite key: add the painter to a ball module (src/balls/<name>.ts)
 * and register it in BALL_SPRITE_PAINTERS in src/balls/index.ts.
 * No manual union editing needed.
 */
export type SpriteKey = keyof typeof SPRITE_PAINTERS;
