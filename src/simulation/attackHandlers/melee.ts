import { applyKnockback } from '../../utils/physics';
import { getHitMultipliers } from '../WeaponHitProcessor';
import type { AttackHandler } from './types';

export const meleeHandler: AttackHandler = {
  resolve({ weapon, attack, defender, dir, targetTeam, damage, particles }) {
    const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
    applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
    damage(targetTeam, attack.damage * dmgMult);
    particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#CC6633', 8);
  },
};
