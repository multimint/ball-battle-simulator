import type { BallStats, WeaponStats } from '../models/types';
import type { SpritePainter } from '../sprites/spriteDefinitions';

/**
 * A self-contained ball definition — everything needed to add a fighter
 * lives in one place: physics stats, weapon, ability, and sprite painter.
 *
 * To add a new ball: copy src/balls/_template.ts, fill in the values, then
 * register it in src/balls/index.ts. Nothing else needs to change.
 */
export interface BallDefinition {
  id: string;
  name: string;
  lore: string;
  painter: SpritePainter;
  ball: BallStats;
  weapon: WeaponStats;
}
