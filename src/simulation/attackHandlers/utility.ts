import { applyKnockback } from '../../utils/physics';
import type { AttackHandler } from './types';

export const utilityHandler: AttackHandler = {
  emitsAudio: false,
  resolve({ weapon, attack, attacker, defender, dir, targetTeam, damage, particles, effects }) {
    if (weapon.utilityBehavior === 'pull') {
      applyKnockback(defender, -dir.x, -dir.y, 80);
      if (attack.damage > 0) damage(targetTeam, attack.damage);
      particles.spawnBurst(
        (attacker.position.x + defender.position.x) / 2,
        (attacker.position.y + defender.position.y) / 2,
        weapon.color ?? '#44FFAA', 6,
      );
    } else if (weapon.utilityBehavior === 'push-both') {
      applyKnockback(defender, dir.x,  dir.y,  attack.knockback * 1.3);
      applyKnockback(attacker, -dir.x, -dir.y, attack.knockback * (weapon.selfKnockbackFrac ?? 0.4));
      damage(targetTeam, attack.damage);
      effects.pushWeaponEffect('explosion', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FFFF44', 18, { radius: 55 });
    }
  },
};
