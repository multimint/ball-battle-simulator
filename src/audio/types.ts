// Standalone audio type definitions — no imports, no circular dependencies.
// Both models/types.ts and balls/types.ts import from here.

export type HitSoundKey = 'thunderous' | 'swift' | 'arcane';
export type AbilitySoundKey = 'berserk' | 'sharp' | 'frenzy';

export interface AudioProfile {
  hitStyle: HitSoundKey;
  abilityStyle: AbilitySoundKey;
}
