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
    kbMult: (weapon as WeaponStats & { kbMult?: number }).kbMult ?? 1.0,
    dmgMult: (weapon as WeaponStats & { dmgMult?: number }).dmgMult ?? 1.0,
  };
}

/** Melee weapon effect label used to pick the correct animation. */
export function getMeleeEffectLabel(weaponName: string): string {
  if (weaponName === 'Heavy Hammer') return 'hammer';
  if (weaponName === 'Long Spear' || weaponName === 'Long Sword') return 'spear';
  if (weaponName === 'Chain Flail') return 'flail';
  return 'sword';
}
