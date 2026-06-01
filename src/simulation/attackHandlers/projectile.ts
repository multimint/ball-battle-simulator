import { applyKnockback } from '../../utils/physics';
import { getHitMultipliers } from '../WeaponHitProcessor';
import type { AttackHandler } from './types';

export const projectileHandler: AttackHandler = {
  resolve({ weapon, attack, attacker, defender, dir, targetTeam, hitAngle, damage, particles, effects }) {
    const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
    if (weapon.hitEffect === 'explosion') {
      effects.pushWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AA44', 20, { radius: weapon.hitEffectRadius ?? 70 });
    } else if (weapon.hitEffect === 'laser' && attack.hitscan) {
      effects.pushWeaponEffect('laser', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#44AAFF', 22, { x2: defender.position.x, y2: defender.position.y });
      effects.pushWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AAFF', 18, { radius: 55 });
      effects.applyScreenShake(8, 14);
      effects.applyScreenFlash(0.45, weapon.color ?? '#4488FF', 8);
      effects.applyHitFlash(targetTeam, 0.9, '#FFFFFF', 8);
      effects.applySlowMotion();
    }
    applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
    damage(targetTeam, attack.damage * dmgMult);
    particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#FFF', attack.hitscan ? 22 : 8);
  },
};
