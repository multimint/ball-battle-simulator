import { applyKnockback } from '../../utils/physics';
import type { AttackHandler } from './types';

export const aoeHandler: AttackHandler = {
  resolve({ weapon, attack, attacker, defender, dir, targetTeam, damage, particles, effects }) {
    applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.5);
    damage(targetTeam, attack.damage);
    effects.pushWeaponEffect('shockwave', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FF44FF', 25, { radius: weapon.range * 30 });
    particles.spawnBurst(attacker.position.x, attacker.position.y, weapon.color ?? '#FF44FF', 15);
  },
};
