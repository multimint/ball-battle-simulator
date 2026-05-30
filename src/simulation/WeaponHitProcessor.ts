import type { WeaponStats, AttackConfig } from '../models/types';

export interface HitMultipliers {
  kbMult: number;
  dmgMult: number;
}

/**
 * Returns the knockback and damage multipliers for a weapon hit.
 * Weapon-specific balance values live in weaponPresets (kbMult, dmgMult fields).
 * Falls back to 1.0 for weapons that don't override either multiplier.
 */
export function getHitMultipliers(weapon: WeaponStats, _attack: AttackConfig): HitMultipliers {
  return {
    kbMult: weapon.kbMult ?? 1.0,
    dmgMult: weapon.dmgMult ?? 1.0,
  };
}

/** Melee weapon effect label — reads effectLabel from preset, falls back to 'sword'. */
export function getMeleeEffectLabel(weapon: WeaponStats): string {
  return weapon.effectLabel ?? 'sword';
}
