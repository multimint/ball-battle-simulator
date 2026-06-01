import { applyKnockback } from '../../utils/physics';
import type { AttackHandler } from './types';

export const shieldHandler: AttackHandler = {
  resolve({ weapon, attack, attacker, defender, dir, targetTeam, hitAngle, damage, particles, effects }) {
    applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.8);
    if (attack.damage > 0) damage(targetTeam, Math.max(1, Math.round(attack.damage * 0.2)));
    effects.pushWeaponEffect('shield', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#AAAAFF', 18, { radius: (attacker.circleRadius ?? 25) + 14 });
    particles.spawnBurst(attacker.position.x, attacker.position.y, weapon.color ?? '#AAAAFF', 6);
  },
};
