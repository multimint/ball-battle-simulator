// Standalone audio type definitions — no imports, no circular dependencies.
// Both models/types.ts and balls/types.ts import from here.

/** Built-in hit sounds. Add custom sounds via registerHitSound() — no union edit needed. */
export type HitSoundKey = 'thunderous' | 'swift' | 'arcane' | (string & {});
/** Built-in ability sounds. Add custom sounds via registerAbilitySound() — no union edit needed. */
export type AbilitySoundKey = 'berserk' | 'sharp' | 'frenzy' | 'forge' | 'shadowslash' | (string & {});

export interface AudioProfile {
  hitStyle: HitSoundKey;
  abilityStyle: AbilitySoundKey;
}
