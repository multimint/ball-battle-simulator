import { applyKnockback } from '../../utils/physics';
import type { AttackHandler } from './types';

export const summonHandler: AttackHandler = {
  resolve({ attack, attacker, defender, dir, spawnUnit }) {
    spawnUnit(attacker);
    if (attack.knockback > 0) {
      applyKnockback(defender, dir.x, dir.y, attack.knockback);
    }
  },
  emitsAudio: false,
};
