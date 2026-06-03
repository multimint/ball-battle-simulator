import type { AudioEvent, HitSoundKey } from '../audio/fightAudioSynthesizer';
import type { AbilitySoundKey } from '../audio/types';
import { BOUNCE_COOLDOWN_MS, ABILITY_AUDIO_COOLDOWN_MS } from '../constants/gameConstants';

export class AudioEmitter {
  private events: AudioEvent[] = [];
  koSimTime = -1; // sim time (ms) when KO occurred; -1 = not yet

  private abilityAudioCooldownA = -Infinity;
  private abilityAudioCooldownB = -Infinity;
  onLowHPAudioFiredA = false;
  onLowHPAudioFiredB = false;
  private ballBounceCooldown = -Infinity;
  private wallBounceCooldown = -Infinity;
  private parryCooldown = -Infinity;

  getEvents(): AudioEvent[] {
    return this.events;
  }

  emitHit(hitStyle: HitSoundKey, intensity: number, timeMs: number): void {
    this.events.push({ timeMs, type: 'hit', hitStyle, intensity });
  }

  emitLaser(hitStyle: HitSoundKey, timeMs: number): void {
    this.events.push({ timeMs, type: 'laserFire', hitStyle, intensity: 1.0 });
    this.events.push({ timeMs, type: 'laserHit',  hitStyle, intensity: 1.0 });
  }

  emitBulletFire(hitStyle: HitSoundKey, timeMs: number): void {
    this.events.push({ timeMs, type: 'bulletFire', hitStyle, intensity: 1.0 });
  }

  /** Emits ability audio with cooldown / deduplication. Returns true if emitted. */
  emitAbility(team: 'A' | 'B', abilityStyle: AbilitySoundKey, trigger: string, timeMs: number): boolean {
    if (trigger === 'onLowHP') {
      const alreadyFired = team === 'A' ? this.onLowHPAudioFiredA : this.onLowHPAudioFiredB;
      if (alreadyFired) return false;
      this.events.push({ timeMs, type: 'ability', abilityStyle, intensity: 1.0 });
      if (team === 'A') this.onLowHPAudioFiredA = true;
      else              this.onLowHPAudioFiredB = true;
      return true;
    }
    const cooldown = team === 'A' ? this.abilityAudioCooldownA : this.abilityAudioCooldownB;
    if (timeMs - cooldown < ABILITY_AUDIO_COOLDOWN_MS) return false;
    this.events.push({ timeMs, type: 'ability', abilityStyle, intensity: 1.0 });
    if (team === 'A') this.abilityAudioCooldownA = timeMs;
    else              this.abilityAudioCooldownB = timeMs;
    return true;
  }

  emitBallBounce(hitStyle: HitSoundKey, timeMs: number): boolean {
    if (timeMs - this.ballBounceCooldown < BOUNCE_COOLDOWN_MS) return false;
    this.events.push({ timeMs, type: 'bounce', hitStyle, intensity: 0.6 });
    this.ballBounceCooldown = timeMs;
    return true;
  }

  emitWallBounce(hitStyle: HitSoundKey, timeMs: number): boolean {
    if (timeMs - this.wallBounceCooldown < BOUNCE_COOLDOWN_MS) return false;
    this.events.push({ timeMs, type: 'bounce', hitStyle, intensity: 0.3 });
    this.wallBounceCooldown = timeMs;
    return true;
  }

  /** Emits an ability-hit sound with no cooldown — for mid-ability impact moments. */
  emitAbilityHit(abilityStyle: AbilitySoundKey, timeMs: number): void {
    this.events.push({ timeMs, type: 'ability', abilityStyle, intensity: 1.0 });
  }

  emitParry(timeMs: number): void {
    if (timeMs - this.parryCooldown < 80) return;
    this.events.push({ timeMs, type: 'parry', intensity: 1.0 });
    this.parryCooldown = timeMs;
  }

  emitKO(timeMs: number): void {
    this.koSimTime = timeMs;
    this.events.push({ timeMs, type: 'ko', intensity: 1.0 });
  }
}
